-- Update the auto_advance_to_packing_on_payment function to advance to ready_to_ship instead of in_packing
-- since packing should already be done by the time final payment comes in
CREATE OR REPLACE FUNCTION public.auto_advance_to_ready_to_ship_on_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  order_id uuid;
  current_order_status order_status;
BEGIN
  -- When invoice is marked as paid
  IF NEW.status = 'paid' AND OLD.status != 'paid' AND NEW.type = 'final' THEN
    -- Get the order ID and current status
    SELECT so.id, so.status INTO order_id, current_order_status 
    FROM sales_orders so 
    WHERE so.id = NEW.so_id;
    
    -- If order is awaiting_invoice or awaiting_payment, advance to ready_to_ship
    IF current_order_status IN ('awaiting_invoice', 'awaiting_payment') THEN
      UPDATE sales_orders
      SET status = 'ready_to_ship'
      WHERE id = order_id;
      
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
        jsonb_build_object('status', current_order_status, 'reason', 'final_payment_received'),
        jsonb_build_object('status', 'ready_to_ship'),
        NULL
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Drop the old trigger if it exists
DROP TRIGGER IF EXISTS on_invoice_paid_advance_order ON invoices;

-- Create new trigger for invoice payment
CREATE TRIGGER on_invoice_paid_advance_order
  AFTER UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION auto_advance_to_ready_to_ship_on_payment();