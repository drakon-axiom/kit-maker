-- Add address fields and notes to customers table
ALTER TABLE public.customers 
ADD COLUMN shipping_address_line1 text,
ADD COLUMN shipping_address_line2 text,
ADD COLUMN shipping_city text,
ADD COLUMN shipping_state text,
ADD COLUMN shipping_zip text,
ADD COLUMN shipping_country text DEFAULT 'USA',
ADD COLUMN billing_address_line1 text,
ADD COLUMN billing_address_line2 text,
ADD COLUMN billing_city text,
ADD COLUMN billing_state text,
ADD COLUMN billing_zip text,
ADD COLUMN billing_country text DEFAULT 'USA',
ADD COLUMN billing_same_as_shipping boolean DEFAULT true,
ADD COLUMN notes text;