-- Add PayPal Checkout fields to brands table
ALTER TABLE public.brands
ADD COLUMN paypal_checkout_enabled boolean DEFAULT false,
ADD COLUMN paypal_client_id text;