-- Add quote link token to sales_orders for shareable quote approval links
ALTER TABLE sales_orders 
ADD COLUMN IF NOT EXISTS quote_link_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex');

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_sales_orders_quote_link_token ON sales_orders(quote_link_token);

-- Create RLS policy to allow public access to quotes via token
CREATE POLICY "Anyone can view quote with valid token"
ON sales_orders
FOR SELECT
USING (quote_link_token IS NOT NULL);