-- Add internal order support to sales_orders
ALTER TABLE sales_orders 
  ADD COLUMN is_internal BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN brand_id UUID REFERENCES brands(id),
  ALTER COLUMN customer_id DROP NOT NULL;

-- Add new order status for internal orders
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'ready_to_stock';

-- Update RLS policies to allow internal orders
DROP POLICY IF EXISTS "Admins can manage orders" ON sales_orders;
CREATE POLICY "Admins can manage orders"
  ON sales_orders
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow viewing internal orders
DROP POLICY IF EXISTS "Authenticated users can view orders" ON sales_orders;
CREATE POLICY "Authenticated users can view orders"
  ON sales_orders
  FOR SELECT
  USING (
    is_authenticated_user() AND 
    (is_internal = true OR customer_id IS NOT NULL)
  );

-- Update order lines RLS for internal orders
DROP POLICY IF EXISTS "Admins can manage order lines" ON sales_order_lines;
CREATE POLICY "Admins can manage order lines"
  ON sales_order_lines
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can view order lines" ON sales_order_lines;
CREATE POLICY "Authenticated users can view order lines"
  ON sales_order_lines
  FOR SELECT
  USING (
    is_authenticated_user() AND 
    EXISTS (
      SELECT 1 FROM sales_orders so 
      WHERE so.id = sales_order_lines.so_id 
      AND (so.is_internal = true OR so.customer_id IS NOT NULL)
    )
  );

-- Create index for faster internal order queries
CREATE INDEX IF NOT EXISTS idx_sales_orders_internal ON sales_orders(is_internal);
CREATE INDEX IF NOT EXISTS idx_sales_orders_brand ON sales_orders(brand_id);