-- Update the auto_update_order_on_batch_complete function to go to in_packing/in_labeling first
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
        next_status := 'in_packing';
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

-- Create trigger to auto-advance to awaiting_invoice when order is packed
CREATE OR REPLACE FUNCTION public.auto_advance_to_awaiting_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- When order moves to packed status, advance to awaiting_invoice
  IF NEW.status = 'packed' AND OLD.status != 'packed' THEN
    NEW.status := 'awaiting_invoice';
    
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
      NEW.id,
      'auto_status_change',
      jsonb_build_object('status', 'packed', 'reason', 'packing_complete'),
      jsonb_build_object('status', 'awaiting_invoice'),
      NULL
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Drop old trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_advance_to_awaiting_invoice ON sales_orders;
CREATE TRIGGER trigger_advance_to_awaiting_invoice
  BEFORE UPDATE OF status ON sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_advance_to_awaiting_invoice();