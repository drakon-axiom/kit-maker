-- Add size_ml column to skus table
ALTER TABLE public.skus 
ADD COLUMN size_ml integer;

-- Add a check constraint to ensure only valid sizes
ALTER TABLE public.skus
ADD CONSTRAINT valid_size_ml CHECK (size_ml IN (3, 5, 10, 20, 30, 50, 100));