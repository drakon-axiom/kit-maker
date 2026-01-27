-- Phase 1: Add consolidated_total column to sales_orders
ALTER TABLE public.sales_orders
ADD COLUMN IF NOT EXISTS consolidated_total numeric DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.sales_orders.consolidated_total IS 'Stores the combined total of parent order + all linked add-ons when consolidation is triggered at fulfillment';

-- Add setting for auto-consolidation behavior
INSERT INTO public.settings (key, value, description)
VALUES ('auto_consolidate_on_packing', 'true', 'Automatically consolidate add-ons when parent enters in_packing status')
ON CONFLICT (key) DO NOTHING;

-- Create trigger function to sync add-on statuses when parent status changes
CREATE OR REPLACE FUNCTION public.sync_addon_statuses()
RETURNS TRIGGER AS $$
DECLARE
  addon_record RECORD;
  synced_statuses text[] := ARRAY['in_packing', 'packed', 'awaiting_invoice', 'awaiting_payment', 'ready_to_ship', 'shipped', 'cancelled'];
BEGIN
  -- Only proceed if this is a parent order and status changed to a synced status
  IF NEW.status::text = ANY(synced_statuses) AND (OLD.status IS NULL OR NEW.status != OLD.status) THEN
    -- Update all linked add-on orders to match parent status
    FOR addon_record IN 
      SELECT oa.addon_so_id 
      FROM order_addons oa 
      WHERE oa.parent_so_id = NEW.id
    LOOP
      UPDATE sales_orders
      SET status = NEW.status
      WHERE id = addon_record.addon_so_id
        AND status != NEW.status;
      
      -- Log the sync
      INSERT INTO public.audit_log (
        entity,
        entity_id,
        action,
        before,
        after,
        actor_id
      ) VALUES (
        'sales_order',
        addon_record.addon_so_id,
        'addon_status_sync',
        jsonb_build_object('reason', 'parent_status_changed'),
        jsonb_build_object('status', NEW.status, 'parent_order_id', NEW.id),
        NULL
      );
    END LOOP;
    
    -- Calculate and store consolidated_total when entering packing
    IF NEW.status = 'in_packing' THEN
      UPDATE sales_orders
      SET consolidated_total = (
        SELECT COALESCE(NEW.subtotal, 0) + COALESCE(SUM(so.subtotal), 0)
        FROM order_addons oa
        JOIN sales_orders so ON so.id = oa.addon_so_id
        WHERE oa.parent_so_id = NEW.id
      )
      WHERE id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS sync_addon_statuses_trigger ON sales_orders;
CREATE TRIGGER sync_addon_statuses_trigger
  AFTER UPDATE ON sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_addon_statuses();