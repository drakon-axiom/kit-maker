-- Drop the old restrictive check constraint
ALTER TABLE public.sku_sizes DROP CONSTRAINT sku_sizes_size_ml_check;

-- Add a new constraint allowing sizes between 1 and 10000 ml
ALTER TABLE public.sku_sizes ADD CONSTRAINT sku_sizes_size_ml_check CHECK (size_ml >= 1 AND size_ml <= 10000);