-- Create brands table for multi-tenant branding
CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '222.2 84% 4.9%',
  primary_foreground TEXT NOT NULL DEFAULT '210 40% 98%',
  secondary_color TEXT NOT NULL DEFAULT '210 40% 96.1%',
  secondary_foreground TEXT NOT NULL DEFAULT '222.2 47.4% 11.2%',
  accent_color TEXT NOT NULL DEFAULT '210 40% 96.1%',
  accent_foreground TEXT NOT NULL DEFAULT '222.2 47.4% 11.2%',
  background_color TEXT NOT NULL DEFAULT '0 0% 100%',
  foreground_color TEXT NOT NULL DEFAULT '222.2 84% 4.9%',
  card_color TEXT NOT NULL DEFAULT '0 0% 100%',
  muted_color TEXT NOT NULL DEFAULT '210 40% 96.1%',
  is_default BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add brand_id to customers table
ALTER TABLE public.customers
ADD COLUMN brand_id UUID REFERENCES public.brands(id);

-- Create index for brand lookups
CREATE INDEX idx_customers_brand_id ON public.customers(brand_id);

-- Insert default brands
INSERT INTO public.brands (name, slug, is_default, primary_color, primary_foreground) VALUES
  ('Axiom Collective', 'axiom-collective', TRUE, '222.2 84% 4.9%', '210 40% 98%'),
  ('Nexus Aminos', 'nexus-aminos', FALSE, '221.2 83.2% 53.3%', '210 40% 98%'),
  ('The Bac Water Store', 'bac-water-store', FALSE, '142.1 76.2% 36.3%', '355.7 100% 97.3%');

-- Enable RLS on brands
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- Brands are viewable by everyone (needed for branding)
CREATE POLICY "Brands are viewable by everyone"
  ON public.brands
  FOR SELECT
  USING (active = TRUE);

-- Only admins can manage brands
CREATE POLICY "Admins can manage brands"
  ON public.brands
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Update trigger for brands
CREATE TRIGGER update_brands_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();