-- Add quote expiration date to sales_orders
ALTER TABLE sales_orders 
ADD COLUMN quote_expires_at timestamp with time zone;

-- Add index for efficient querying of expiring quotes
CREATE INDEX idx_sales_orders_quote_expires_at 
ON sales_orders(quote_expires_at) 
WHERE status = 'quoted';

-- Add a new order status for expired quotes
-- Note: This uses existing order_status enum, we'll handle expired quotes by checking the date