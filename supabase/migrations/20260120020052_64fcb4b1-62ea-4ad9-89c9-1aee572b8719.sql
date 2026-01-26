-- Create box_presets table for saved box sizes
CREATE TABLE public.box_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  length_inches NUMERIC NOT NULL,
  width_inches NUMERIC NOT NULL,
  height_inches NUMERIC NOT NULL,
  weight_oz NUMERIC,
  is_default BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.box_presets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage box presets"
ON public.box_presets
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view box presets"
ON public.box_presets
FOR SELECT
USING (is_authenticated_user());

-- Add updated_at trigger
CREATE TRIGGER update_box_presets_updated_at
BEFORE UPDATE ON public.box_presets
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Add default carrier settings to settings table
INSERT INTO public.settings (key, value, description)
VALUES 
  ('shipstation_carrier_code', 'ups', 'Default ShipStation carrier code (e.g., ups, fedex, usps)'),
  ('shipstation_service_code', 'ups_ground', 'Default ShipStation service code')
ON CONFLICT (key) DO NOTHING;

-- Insert some common box presets
INSERT INTO public.box_presets (name, length_inches, width_inches, height_inches, weight_oz, is_default)
VALUES 
  ('Small Box', 8, 6, 4, 8, false),
  ('Medium Box', 12, 10, 6, 16, true),
  ('Large Box', 18, 14, 8, 24, false),
  ('Extra Large Box', 24, 18, 12, 32, false);