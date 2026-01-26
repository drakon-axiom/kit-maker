-- Create table for order packing details
CREATE TABLE public.order_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  so_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  package_number INTEGER NOT NULL DEFAULT 1,
  length_inches NUMERIC NOT NULL DEFAULT 0,
  width_inches NUMERIC NOT NULL DEFAULT 0,
  height_inches NUMERIC NOT NULL DEFAULT 0,
  weight_oz NUMERIC NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for faster lookups
CREATE INDEX idx_order_packages_so_id ON public.order_packages(so_id);

-- Enable RLS
ALTER TABLE public.order_packages ENABLE ROW LEVEL SECURITY;

-- Admins can manage all packages
CREATE POLICY "Admins can manage packages"
ON public.order_packages
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can view packages
CREATE POLICY "Authenticated users can view packages"
ON public.order_packages
FOR SELECT
USING (is_authenticated_user());

-- Add updated_at trigger
CREATE TRIGGER update_order_packages_updated_at
BEFORE UPDATE ON public.order_packages
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();