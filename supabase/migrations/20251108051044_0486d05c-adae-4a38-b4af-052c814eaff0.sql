-- Add use_tier_pricing flag to skus table
ALTER TABLE public.skus
ADD COLUMN use_tier_pricing BOOLEAN NOT NULL DEFAULT false;

-- Update existing SKUs to use tier pricing if they have tiers defined
UPDATE public.skus
SET use_tier_pricing = true
WHERE id IN (
  SELECT DISTINCT sku_id 
  FROM public.sku_pricing_tiers
);