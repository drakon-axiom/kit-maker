
-- Step 1: Add new enum values and hold_reason column only
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'on_hold';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'stocked';
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS hold_reason text;
