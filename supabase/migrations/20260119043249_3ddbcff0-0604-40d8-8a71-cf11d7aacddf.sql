-- Add archived column to sales_orders
ALTER TABLE public.sales_orders 
ADD COLUMN archived boolean NOT NULL DEFAULT false;

-- Add index for faster filtering
CREATE INDEX idx_sales_orders_archived ON public.sales_orders(archived);

-- Add archived_at timestamp for tracking when orders were archived
ALTER TABLE public.sales_orders 
ADD COLUMN archived_at timestamp with time zone;