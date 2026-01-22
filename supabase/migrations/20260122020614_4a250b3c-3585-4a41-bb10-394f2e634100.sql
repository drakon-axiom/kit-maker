-- Change shipstation_shipment_id from bigint to text for v2 API compatibility
ALTER TABLE public.shipments 
ALTER COLUMN shipstation_shipment_id TYPE text 
USING shipstation_shipment_id::text;