-- Create junction table for SKU to multiple categories
CREATE TABLE public.sku_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku_id UUID NOT NULL REFERENCES public.skus(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sku_id, category_id)
);

-- Enable RLS
ALTER TABLE public.sku_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage sku categories"
ON public.sku_categories FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view sku categories"
ON public.sku_categories FOR SELECT
USING (is_authenticated_user());

-- Migrate existing category_id data to the new junction table
INSERT INTO public.sku_categories (sku_id, category_id)
SELECT id, category_id FROM public.skus WHERE category_id IS NOT NULL;

-- Create index for performance
CREATE INDEX idx_sku_categories_sku_id ON public.sku_categories(sku_id);
CREATE INDEX idx_sku_categories_category_id ON public.sku_categories(category_id);