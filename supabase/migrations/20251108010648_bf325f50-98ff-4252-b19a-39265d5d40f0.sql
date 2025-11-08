-- Create function to automatically update order status based on conditions
CREATE OR REPLACE FUNCTION public.auto_update_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  old_status order_status;
  new_status order_status;
BEGIN
  old_status := NEW.status;
  
  -- Rule 1: If deposit becomes paid and status is deposit_due, move to in_queue
  IF NEW.deposit_status = 'paid' AND NEW.status = 'deposit_due' THEN
    new_status := 'in_queue';
    NEW.status := new_status;
    
    -- Log the automated status change
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
      jsonb_build_object('status', old_status, 'reason', 'deposit_paid'),
      jsonb_build_object('status', new_status),
      NULL  -- NULL actor means automated
    );
  END IF;
  
  -- Rule 2: If deposit not required and status is draft, can move directly to in_queue when saved
  IF NOT NEW.deposit_required AND NEW.status = 'draft' AND OLD.status = 'draft' 
     AND NEW.updated_at > OLD.updated_at THEN
    -- Only if the order has line items
    IF EXISTS (SELECT 1 FROM sales_order_lines WHERE so_id = NEW.id) THEN
      new_status := 'quoted';
      NEW.status := new_status;
      
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
        jsonb_build_object('status', old_status, 'reason', 'no_deposit_required'),
        jsonb_build_object('status', new_status),
        NULL
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on sales_orders for automatic status updates
DROP TRIGGER IF EXISTS trigger_auto_update_order_status ON public.sales_orders;
CREATE TRIGGER trigger_auto_update_order_status
  BEFORE UPDATE ON public.sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_order_status();

-- Create function to update order status when production batch completes
CREATE OR REPLACE FUNCTION public.auto_update_order_on_batch_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  order_id uuid;
  all_batches_complete boolean;
BEGIN
  -- Only proceed if batch status changed to completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    order_id := NEW.so_id;
    
    -- Check if all batches for this order are completed
    SELECT NOT EXISTS (
      SELECT 1 
      FROM production_batches 
      WHERE so_id = order_id 
      AND status != 'completed'
    ) INTO all_batches_complete;
    
    -- If all batches complete, update order to packed
    IF all_batches_complete THEN
      UPDATE sales_orders 
      SET status = 'packed'
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
        jsonb_build_object('status', 'in_production', 'reason', 'all_batches_completed'),
        jsonb_build_object('status', 'packed'),
        NULL
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for production batch completion
DROP TRIGGER IF EXISTS trigger_auto_update_order_on_batch_complete ON public.production_batches;
CREATE TRIGGER trigger_auto_update_order_on_batch_complete
  AFTER UPDATE ON public.production_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_order_on_batch_complete();