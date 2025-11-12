-- Add new order statuses for payment flow
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'awaiting_invoice';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'awaiting_payment';

-- Update the auto_update_order_on_batch_complete function to move to awaiting_invoice instead of in_packing
CREATE OR REPLACE FUNCTION public.auto_update_order_on_batch_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  order_id uuid;
  all_batches_complete boolean;
  order_label_required boolean;
  next_status order_status;
BEGIN
  -- Only proceed if batch status changed to complete
  IF NEW.status = 'complete' AND OLD.status != 'complete' THEN
    order_id := NEW.so_id;
    
    -- Check if all batches for this order are complete
    SELECT NOT EXISTS (
      SELECT 1 
      FROM production_batches 
      WHERE so_id = order_id 
      AND status != 'complete'
    ) INTO all_batches_complete;
    
    -- Get label requirement for the order
    SELECT label_required INTO order_label_required
    FROM sales_orders
    WHERE id = order_id;
    
    -- If all batches complete, update order status based on label requirement
    IF all_batches_complete THEN
      -- Determine next status based on label requirement
      IF order_label_required THEN
        next_status := 'in_labeling';
      ELSE
        next_status := 'awaiting_invoice';
      END IF;
      
      UPDATE sales_orders 
      SET status = next_status
      WHERE id = order_id 
      AND status = 'in_production';
      
      -- Log the change
      INSERT INTO public.audit_log (
        entity,
        entity_id,
        action,
        before,
        after,
        actor_id
      ) VALUES (
        'sales_order',
        order_id,
        'auto_status_change',
        jsonb_build_object(
          'status', 'in_production', 
          'reason', 'all_batches_complete',
          'label_required', order_label_required
        ),
        jsonb_build_object('status', next_status),
        NULL
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger to auto-advance to awaiting_payment when invoice is created
CREATE OR REPLACE FUNCTION public.auto_advance_to_awaiting_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- When a final invoice is created for an order in awaiting_invoice status
  IF NEW.type = 'final' AND TG_OP = 'INSERT' THEN
    UPDATE sales_orders
    SET status = 'awaiting_payment'
    WHERE id = NEW.so_id
    AND status = 'awaiting_invoice';
    
    -- Log the change
    INSERT INTO public.audit_log (
      entity,
      entity_id,
      action,
      before,
      after,
      actor_id
    ) VALUES (
      'sales_order',
      NEW.so_id,
      'auto_status_change',
      jsonb_build_object('status', 'awaiting_invoice', 'reason', 'invoice_created'),
      jsonb_build_object('status', 'awaiting_payment'),
      NULL
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trigger_advance_to_awaiting_payment
  AFTER INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION auto_advance_to_awaiting_payment();

-- Create trigger to auto-advance to in_packing when payment is received
CREATE OR REPLACE FUNCTION public.auto_advance_to_packing_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  order_id uuid;
  invoice_total numeric;
  total_payments numeric;
BEGIN
  -- When invoice is marked as paid
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    -- Get the order ID
    SELECT so_id INTO order_id FROM invoices WHERE id = NEW.id;
    
    -- Update order status to in_packing
    UPDATE sales_orders
    SET status = 'in_packing'
    WHERE id = order_id
    AND status = 'awaiting_payment';
    
    -- Log the change
    INSERT INTO public.audit_log (
      entity,
      entity_id,
      action,
      before,
      after,
      actor_id
    ) VALUES (
      'sales_order',
      order_id,
      'auto_status_change',
      jsonb_build_object('status', 'awaiting_payment', 'reason', 'payment_received'),
      jsonb_build_object('status', 'in_packing'),
      NULL
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trigger_advance_to_packing_on_payment
  AFTER UPDATE OF status ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION auto_advance_to_packing_on_payment();