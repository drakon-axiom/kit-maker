
-- Migrate existing data to new statuses
UPDATE public.sales_orders SET status = 'on_hold', hold_reason = 'customer' WHERE status = 'on_hold_customer';
UPDATE public.sales_orders SET status = 'on_hold', hold_reason = 'internal' WHERE status = 'on_hold_internal';
UPDATE public.sales_orders SET status = 'on_hold', hold_reason = 'materials' WHERE status = 'on_hold_materials';
UPDATE public.sales_orders SET status = 'awaiting_payment' WHERE status = 'invoiced';
UPDATE public.sales_orders SET status = 'awaiting_payment' WHERE status = 'payment_due';
UPDATE public.sales_orders SET status = 'awaiting_invoice' WHERE status = 'packed';
UPDATE public.sales_orders SET status = 'stocked' WHERE status = 'ready_to_stock';

-- Update validate_order_status_transition
CREATE OR REPLACE FUNCTION public.validate_order_status_transition(_order_id uuid, _new_status order_status)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _current_status order_status;
  _has_batches boolean;
  _all_batches_complete boolean;
  _has_deposit_invoice boolean;
  _has_final_invoice boolean;
  _deposit_paid boolean;
  _label_required boolean;
  _is_internal boolean;
  _result jsonb;
  _warnings text[] := '{}';
  _blockers text[] := '{}';
BEGIN
  SELECT 
    status, label_required, is_internal,
    EXISTS(SELECT 1 FROM production_batches WHERE so_id = _order_id),
    NOT EXISTS(SELECT 1 FROM production_batches WHERE so_id = _order_id AND status != 'complete'),
    EXISTS(SELECT 1 FROM invoices WHERE so_id = _order_id AND type = 'deposit'),
    EXISTS(SELECT 1 FROM invoices WHERE so_id = _order_id AND type = 'final'),
    deposit_status = 'paid'
  INTO
    _current_status, _label_required, _is_internal,
    _has_batches, _all_batches_complete,
    _has_deposit_invoice, _has_final_invoice, _deposit_paid
  FROM sales_orders
  WHERE id = _order_id;

  IF _current_status = _new_status THEN
    RETURN jsonb_build_object('valid', true, 'current_status', _current_status, 'warnings', '[]'::jsonb, 'blockers', '[]'::jsonb);
  END IF;

  CASE _new_status
    WHEN 'in_production' THEN
      IF NOT _has_batches THEN
        _warnings := array_append(_warnings, 'No production batches exist for this order');
      END IF;
      IF _current_status NOT IN ('in_queue', 'on_hold') THEN
        _warnings := array_append(_warnings, 'Unusual transition from ' || _current_status);
      END IF;

    WHEN 'in_labeling' THEN
      IF NOT _all_batches_complete THEN
        _blockers := array_append(_blockers, 'All production batches must be complete before labeling');
      END IF;
      IF NOT _label_required THEN
        _warnings := array_append(_warnings, 'Order does not require labeling');
      END IF;

    WHEN 'in_packing' THEN
      IF _label_required AND _current_status != 'in_labeling' THEN
        _warnings := array_append(_warnings, 'Order requires labeling but current status is ' || _current_status);
      END IF;
      IF NOT _all_batches_complete THEN
        _blockers := array_append(_blockers, 'All production batches must be complete before packing');
      END IF;

    WHEN 'awaiting_invoice' THEN
      IF _current_status != 'in_packing' THEN
        _warnings := array_append(_warnings, 'Order should be in packing before invoicing');
      END IF;

    WHEN 'awaiting_payment' THEN
      IF NOT _has_final_invoice THEN
        _blockers := array_append(_blockers, 'Final invoice must be created before marking as awaiting payment');
      END IF;
      IF _current_status != 'awaiting_invoice' THEN
        _warnings := array_append(_warnings, 'Unusual transition from ' || _current_status);
      END IF;

    WHEN 'deposit_due' THEN
      IF NOT _has_deposit_invoice THEN
        _warnings := array_append(_warnings, 'No deposit invoice exists');
      END IF;

    WHEN 'in_queue' THEN
      IF NOT _deposit_paid AND _current_status = 'deposit_due' THEN
        _warnings := array_append(_warnings, 'Deposit has not been marked as paid');
      END IF;

    WHEN 'ready_to_ship' THEN
      IF _is_internal THEN
        _blockers := array_append(_blockers, 'Internal orders should use stocked status instead');
      END IF;

    WHEN 'shipped' THEN
      IF NOT EXISTS(SELECT 1 FROM shipments WHERE so_id = _order_id) THEN
        _blockers := array_append(_blockers, 'Shipment record must be created before marking as shipped');
      END IF;
      IF _current_status != 'ready_to_ship' THEN
        _warnings := array_append(_warnings, 'Order should be in ready_to_ship status before shipping');
      END IF;

    WHEN 'stocked' THEN
      IF NOT _is_internal THEN
        _blockers := array_append(_blockers, 'Only internal orders can be marked as stocked');
      END IF;
      IF _current_status != 'in_packing' THEN
        _warnings := array_append(_warnings, 'Order should be in packing before stocking');
      END IF;

    WHEN 'on_hold' THEN
      NULL;

    ELSE
      NULL;
  END CASE;

  _result := jsonb_build_object(
    'valid', array_length(_blockers, 1) IS NULL,
    'current_status', _current_status,
    'new_status', _new_status,
    'warnings', to_jsonb(_warnings),
    'blockers', to_jsonb(_blockers),
    'requires_override', array_length(_warnings, 1) > 0 OR array_length(_blockers, 1) > 0
  );

  RETURN _result;
END;
$function$;

-- Update auto_advance_to_awaiting_invoice
CREATE OR REPLACE FUNCTION public.auto_advance_to_awaiting_invoice()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'packed' AND OLD.status != 'packed' THEN
    NEW.status := 'awaiting_invoice';
    INSERT INTO public.audit_log (entity, entity_id, action, before, after, actor_id)
    VALUES ('sales_order', NEW.id, 'auto_status_change',
      jsonb_build_object('status', 'packed', 'reason', 'packing_complete'),
      jsonb_build_object('status', 'awaiting_invoice'), NULL);
  END IF;
  RETURN NEW;
END;
$function$;

-- Update auto_advance_to_ready_to_ship_on_payment
CREATE OR REPLACE FUNCTION public.auto_advance_to_ready_to_ship_on_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  order_id uuid;
  current_order_status order_status;
  order_is_internal boolean;
  next_status order_status;
BEGIN
  IF NEW.status = 'paid' AND OLD.status != 'paid' AND NEW.type = 'final' THEN
    SELECT so.id, so.status, so.is_internal INTO order_id, current_order_status, order_is_internal
    FROM sales_orders so WHERE so.id = NEW.so_id;
    
    IF current_order_status IN ('awaiting_invoice', 'awaiting_payment') THEN
      IF order_is_internal THEN next_status := 'stocked';
      ELSE next_status := 'ready_to_ship';
      END IF;
      
      UPDATE sales_orders SET status = next_status WHERE id = order_id;
      
      INSERT INTO public.audit_log (entity, entity_id, action, before, after, actor_id)
      VALUES ('sales_order', order_id, 'auto_status_change',
        jsonb_build_object('status', current_order_status, 'reason', 'final_payment_received'),
        jsonb_build_object('status', next_status), NULL);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Update sync_addon_statuses
CREATE OR REPLACE FUNCTION public.sync_addon_statuses()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  addon_record RECORD;
  synced_statuses text[] := ARRAY['in_packing', 'awaiting_invoice', 'awaiting_payment', 'ready_to_ship', 'shipped', 'stocked', 'cancelled'];
BEGIN
  IF NEW.status::text = ANY(synced_statuses) AND (OLD.status IS NULL OR NEW.status != OLD.status) THEN
    FOR addon_record IN 
      SELECT oa.addon_so_id FROM order_addons oa WHERE oa.parent_so_id = NEW.id
    LOOP
      UPDATE sales_orders SET status = NEW.status
      WHERE id = addon_record.addon_so_id AND status != NEW.status;
      
      INSERT INTO public.audit_log (entity, entity_id, action, before, after, actor_id)
      VALUES ('sales_order', addon_record.addon_so_id, 'addon_status_sync',
        jsonb_build_object('reason', 'parent_status_changed'),
        jsonb_build_object('status', NEW.status, 'parent_order_id', NEW.id), NULL);
    END LOOP;
    
    IF NEW.status = 'in_packing' THEN
      UPDATE sales_orders SET consolidated_total = (
        SELECT COALESCE(NEW.subtotal, 0) + COALESCE(SUM(so.subtotal), 0)
        FROM order_addons oa JOIN sales_orders so ON so.id = oa.addon_so_id
        WHERE oa.parent_so_id = NEW.id
      ) WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Update notify_order_status_change
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  customer_sms_phone text;
  customer_sms_enabled boolean;
  customer_sms_order_status boolean;
  service_role_key text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status 
     AND NEW.status IN ('in_production', 'in_packing', 'ready_to_ship', 'shipped', 'stocked') THEN
    
    service_role_key := current_setting('app.supabase_service_role_key', true);
    
    PERFORM net.http_post(
      url := 'https://dfaafbwhdnoaknuxonig.supabase.co/functions/v1/send-order-notification',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_role_key),
      body := jsonb_build_object('orderId', NEW.id, 'newStatus', NEW.status, 'oldStatus', OLD.status)
    );
    
    SELECT np.sms_enabled, np.sms_phone_number, np.sms_order_status
    INTO customer_sms_enabled, customer_sms_phone, customer_sms_order_status
    FROM notification_preferences np WHERE np.customer_id = NEW.customer_id;
    
    IF customer_sms_enabled AND customer_sms_order_status AND customer_sms_phone IS NOT NULL THEN
      PERFORM net.http_post(
        url := 'https://dfaafbwhdnoaknuxonig.supabase.co/functions/v1/send-sms-notification',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_role_key),
        body := jsonb_build_object('orderId', NEW.id, 'newStatus', NEW.status, 'phoneNumber', customer_sms_phone, 'eventType', 'order_status')
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
