-- Create a function to validate order status transitions
CREATE OR REPLACE FUNCTION public.validate_order_status_transition(
  _order_id uuid,
  _new_status order_status
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_status order_status;
  _has_batches boolean;
  _all_batches_complete boolean;
  _has_deposit_invoice boolean;
  _has_final_invoice boolean;
  _deposit_paid boolean;
  _label_required boolean;
  _result jsonb;
  _warnings text[] := '{}';
  _blockers text[] := '{}';
BEGIN
  -- Get current order state
  SELECT 
    status,
    label_required,
    EXISTS(SELECT 1 FROM production_batches WHERE so_id = _order_id),
    NOT EXISTS(SELECT 1 FROM production_batches WHERE so_id = _order_id AND status != 'complete'),
    EXISTS(SELECT 1 FROM invoices WHERE so_id = _order_id AND type = 'deposit'),
    EXISTS(SELECT 1 FROM invoices WHERE so_id = _order_id AND type = 'final'),
    deposit_status = 'paid'
  INTO
    _current_status,
    _label_required,
    _has_batches,
    _all_batches_complete,
    _has_deposit_invoice,
    _has_final_invoice,
    _deposit_paid
  FROM sales_orders
  WHERE id = _order_id;

  -- If same status, no validation needed
  IF _current_status = _new_status THEN
    RETURN jsonb_build_object(
      'valid', true,
      'current_status', _current_status,
      'warnings', '[]'::jsonb,
      'blockers', '[]'::jsonb
    );
  END IF;

  -- Validate status transitions
  CASE _new_status
    WHEN 'in_production' THEN
      IF NOT _has_batches THEN
        _warnings := array_append(_warnings, 'No production batches exist for this order');
      END IF;
      IF _current_status NOT IN ('in_queue', 'on_hold_materials', 'on_hold_internal') THEN
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
      IF _label_required AND _current_status NOT IN ('in_labeling', 'packed') THEN
        _warnings := array_append(_warnings, 'Order requires labeling but current status is ' || _current_status);
      END IF;
      IF NOT _all_batches_complete THEN
        _blockers := array_append(_blockers, 'All production batches must be complete before packing');
      END IF;

    WHEN 'packed' THEN
      IF _current_status NOT IN ('in_packing', 'awaiting_invoice') THEN
        _warnings := array_append(_warnings, 'Unusual transition from ' || _current_status);
      END IF;

    WHEN 'awaiting_invoice' THEN
      IF _current_status != 'packed' THEN
        _warnings := array_append(_warnings, 'Order should be packed before creating invoice');
      END IF;

    WHEN 'awaiting_payment' THEN
      IF NOT _has_final_invoice THEN
        _blockers := array_append(_blockers, 'Final invoice must be created before marking as awaiting payment');
      END IF;
      IF _current_status NOT IN ('awaiting_invoice', 'invoiced') THEN
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

    WHEN 'shipped' THEN
      IF NOT EXISTS(SELECT 1 FROM shipments WHERE so_id = _order_id) THEN
        _blockers := array_append(_blockers, 'Shipment record must be created before marking as shipped');
      END IF;
      IF _current_status != 'ready_to_ship' THEN
        _warnings := array_append(_warnings, 'Order should be in ready_to_ship status before shipping');
      END IF;

    ELSE
      -- Allow other transitions with no specific validation
      NULL;
  END CASE;

  -- Build result
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
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.validate_order_status_transition(uuid, order_status) TO authenticated;