-- Add PayPal client secret column to brands table for REST API authentication
ALTER TABLE public.brands 
ADD COLUMN IF NOT EXISTS paypal_client_secret text;

COMMENT ON COLUMN public.brands.paypal_client_secret IS 
'PayPal REST API Client Secret - used server-side only for order creation/capture';