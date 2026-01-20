-- Add shipstation_shipment_id column to track the ShipStation shipment for voiding
ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS shipstation_shipment_id bigint;

-- Add index for lookups
CREATE INDEX IF NOT EXISTS idx_shipments_shipstation_id ON public.shipments(shipstation_shipment_id) 
WHERE shipstation_shipment_id IS NOT NULL;

-- Add voided_at column to track when labels were voided
ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS voided_at timestamptz;