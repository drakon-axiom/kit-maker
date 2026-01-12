-- Create trigger function to auto-advance order to in_production when batch starts
CREATE OR REPLACE FUNCTION public.auto_advance_order_to_production()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_order_status order_status;
BEGIN
  -- Only proceed if batch status changed to 'wip'
  IF NEW.status = 'wip' AND OLD.status != 'wip' THEN
    -- Get current order status
    SELECT status INTO current_order_status
    FROM sales_orders
    WHERE id = NEW.so_id;
    
    -- If order is in_queue, advance to in_production
    IF current_order_status = 'in_queue' THEN
      UPDATE sales_orders 
      SET status = 'in_production'
      WHERE id = NEW.so_id;
      
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
        jsonb_build_object('status', 'in_queue', 'reason', 'batch_started'),
        jsonb_build_object('status', 'in_production'),
        NULL
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create the trigger on production_batches
DROP TRIGGER IF EXISTS trigger_auto_advance_to_production ON production_batches;
CREATE TRIGGER trigger_auto_advance_to_production
  AFTER UPDATE ON production_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_advance_order_to_production();