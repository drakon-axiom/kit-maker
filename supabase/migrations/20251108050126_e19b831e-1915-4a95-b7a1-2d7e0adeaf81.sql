-- Create pricing tiers table
CREATE TABLE public.sku_pricing_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku_id UUID NOT NULL REFERENCES public.skus(id) ON DELETE CASCADE,
  min_quantity INTEGER NOT NULL,
  max_quantity INTEGER NULL, -- NULL means unlimited (100+)
  price_per_kit NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_quantity_range CHECK (min_quantity > 0 AND (max_quantity IS NULL OR max_quantity >= min_quantity))
);

-- Enable RLS
ALTER TABLE public.sku_pricing_tiers ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view pricing tiers" 
ON public.sku_pricing_tiers 
FOR SELECT 
USING (is_authenticated_user());

CREATE POLICY "Admins can manage pricing tiers" 
ON public.sku_pricing_tiers 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_sku_pricing_tiers_updated_at
BEFORE UPDATE ON public.sku_pricing_tiers
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create index for faster lookups
CREATE INDEX idx_sku_pricing_tiers_sku_id ON public.sku_pricing_tiers(sku_id);

-- Insert default tiers for existing SKUs
INSERT INTO public.sku_pricing_tiers (sku_id, min_quantity, max_quantity, price_per_kit)
SELECT 
  id,
  5,
  10,
  price_per_kit
FROM public.skus;

INSERT INTO public.sku_pricing_tiers (sku_id, min_quantity, max_quantity, price_per_kit)
SELECT 
  id,
  11,
  25,
  price_per_kit * 0.95
FROM public.skus;

INSERT INTO public.sku_pricing_tiers (sku_id, min_quantity, max_quantity, price_per_kit)
SELECT 
  id,
  26,
  50,
  price_per_kit * 0.90
FROM public.skus;

INSERT INTO public.sku_pricing_tiers (sku_id, min_quantity, max_quantity, price_per_kit)
SELECT 
  id,
  51,
  99,
  price_per_kit * 0.85
FROM public.skus;

INSERT INTO public.sku_pricing_tiers (sku_id, min_quantity, max_quantity, price_per_kit)
SELECT 
  id,
  100,
  NULL,
  price_per_kit * 0.80
FROM public.skus;