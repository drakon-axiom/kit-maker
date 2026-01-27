-- Add shipstation_order_id column to shipments table to track ShipStation order reference
ALTER TABLE public.shipments
ADD COLUMN IF NOT EXISTS shipstation_order_id text;