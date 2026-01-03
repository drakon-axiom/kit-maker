-- Add default bottle size column to SKUs
ALTER TABLE public.skus 
ADD COLUMN default_bottle_size_ml integer DEFAULT 10;

-- Add comment for clarity
COMMENT ON COLUMN public.skus.default_bottle_size_ml IS 'Default bottle size in ml for volume calculations (e.g., 10, 30, 50, 100)';