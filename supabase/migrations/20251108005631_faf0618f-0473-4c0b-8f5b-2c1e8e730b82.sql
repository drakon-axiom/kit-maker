-- Add new on_hold status variants to the order_status enum
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'on_hold_customer';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'on_hold_internal';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'on_hold_materials';