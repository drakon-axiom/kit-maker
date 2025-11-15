-- Add labor and overhead cost fields to skus table for bundle pricing
ALTER TABLE public.skus 
ADD COLUMN bundle_labor_price numeric DEFAULT 0,
ADD COLUMN bundle_overhead_price numeric DEFAULT 0;