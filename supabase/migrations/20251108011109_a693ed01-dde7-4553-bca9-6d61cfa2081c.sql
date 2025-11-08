-- Add new statuses to order_status enum
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'in_labeling';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'in_packing';

-- Update the automation function to handle new statuses
CREATE OR REPLACE FUNCTION public.auto_update_order_on_batch_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  order_id uuid;
  all_batches_complete boolean;
  order_label_required boolean;
  next_status order_status;
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
          'reason', 'all_batches_completed',
          'label_required', order_label_required
        ),
        jsonb_build_object('status', next_status),
        NULL
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;