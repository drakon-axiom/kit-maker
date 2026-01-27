-- Add BTCPay Server configuration columns to brands table
ALTER TABLE public.brands 
ADD COLUMN IF NOT EXISTS btcpay_server_url text,
ADD COLUMN IF NOT EXISTS btcpay_store_id text,
ADD COLUMN IF NOT EXISTS btcpay_api_key text;