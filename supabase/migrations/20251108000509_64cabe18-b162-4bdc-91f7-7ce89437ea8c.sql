-- Add label_required field to sales_orders table
ALTER TABLE public.sales_orders 
ADD COLUMN label_required BOOLEAN NOT NULL DEFAULT false;