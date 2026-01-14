-- Add payment configuration columns to brands table
ALTER TABLE public.brands
ADD COLUMN IF NOT EXISTS stripe_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS cashapp_tag text,
ADD COLUMN IF NOT EXISTS paypal_email text,
ADD COLUMN IF NOT EXISTS wire_bank_name text,
ADD COLUMN IF NOT EXISTS wire_routing_number text,
ADD COLUMN IF NOT EXISTS wire_account_number text;