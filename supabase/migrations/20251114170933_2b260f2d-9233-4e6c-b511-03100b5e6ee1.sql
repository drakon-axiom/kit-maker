-- Create categories table for product organization
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add category and bundle fields to skus
ALTER TABLE public.skus
ADD COLUMN category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
ADD COLUMN is_bundle BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN pack_size INTEGER DEFAULT 1,
ADD COLUMN bundle_product_price NUMERIC DEFAULT 0,
ADD COLUMN bundle_packaging_price NUMERIC DEFAULT 0,
ADD COLUMN bundle_labeling_price NUMERIC DEFAULT 0,
ADD COLUMN bundle_inserts_price NUMERIC DEFAULT 0,
ADD COLUMN inserts_optional BOOLEAN DEFAULT true;

-- Create customer category access control
CREATE TABLE public.customer_category_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(customer_id, category_id)
);

-- Create customer product access control
CREATE TABLE public.customer_product_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES public.skus(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(customer_id, sku_id)
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_category_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_product_access ENABLE ROW LEVEL SECURITY;

-- RLS Policies for categories
CREATE POLICY "Authenticated users can view categories"
ON public.categories FOR SELECT
TO authenticated
USING (is_authenticated_user());

CREATE POLICY "Admins can manage categories"
ON public.categories FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for customer_category_access
CREATE POLICY "Admins can manage category access"
ON public.customer_category_access FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view category access"
ON public.customer_category_access FOR SELECT
TO authenticated
USING (is_authenticated_user());

-- RLS Policies for customer_product_access
CREATE POLICY "Admins can manage product access"
ON public.customer_product_access FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view product access"
ON public.customer_product_access FOR SELECT
TO authenticated
USING (is_authenticated_user());

-- Add updated_at trigger for categories
CREATE TRIGGER update_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();