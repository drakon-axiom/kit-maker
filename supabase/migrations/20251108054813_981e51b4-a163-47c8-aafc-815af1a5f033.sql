-- Remove size_ml column from skus table
ALTER TABLE public.skus 
DROP COLUMN IF EXISTS size_ml;

-- Drop the constraint if it exists
ALTER TABLE public.skus
DROP CONSTRAINT IF EXISTS valid_size_ml;

-- Create sku_sizes table for variants
CREATE TABLE public.sku_sizes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku_id uuid NOT NULL REFERENCES public.skus(id) ON DELETE CASCADE,
  size_ml integer NOT NULL CHECK (size_ml IN (3, 5, 10, 20, 30, 50, 100)),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(sku_id, size_ml)
);

-- Enable RLS
ALTER TABLE public.sku_sizes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view sku sizes" 
ON public.sku_sizes 
FOR SELECT 
USING (is_authenticated_user());

CREATE POLICY "Admins can manage sku sizes" 
ON public.sku_sizes 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for better performance
CREATE INDEX idx_sku_sizes_sku_id ON public.sku_sizes(sku_id);