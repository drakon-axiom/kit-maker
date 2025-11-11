-- Create label_settings table for customizable label templates
CREATE TABLE public.label_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label_type TEXT NOT NULL CHECK (label_type IN ('order', 'shipping', 'batch')),
  
  -- Size settings (in inches)
  size_width DECIMAL NOT NULL DEFAULT 4,
  size_height DECIMAL NOT NULL DEFAULT 6,
  
  -- Display options
  show_qr_code BOOLEAN NOT NULL DEFAULT true,
  show_logo BOOLEAN NOT NULL DEFAULT false,
  logo_url TEXT,
  logo_position TEXT NOT NULL DEFAULT 'top' CHECK (logo_position IN ('top', 'bottom', 'left', 'right')),
  
  -- Field visibility for order labels
  show_customer_email BOOLEAN NOT NULL DEFAULT true,
  show_customer_phone BOOLEAN NOT NULL DEFAULT true,
  show_status BOOLEAN NOT NULL DEFAULT true,
  show_total_bottles BOOLEAN NOT NULL DEFAULT true,
  show_date BOOLEAN NOT NULL DEFAULT true,
  
  -- Field visibility for shipping labels
  show_tracking_number BOOLEAN NOT NULL DEFAULT true,
  show_carrier BOOLEAN NOT NULL DEFAULT true,
  
  -- Field visibility for batch labels
  show_batch_quantity BOOLEAN NOT NULL DEFAULT true,
  show_order_reference BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Only one setting per label type
  UNIQUE(label_type)
);

-- Enable RLS
ALTER TABLE public.label_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view label settings"
  ON public.label_settings FOR SELECT
  USING (is_authenticated_user());

CREATE POLICY "Admins can manage label settings"
  ON public.label_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default settings for all label types
INSERT INTO public.label_settings (label_type, size_width, size_height) VALUES
  ('order', 4, 6),
  ('shipping', 4, 6),
  ('batch', 4, 3);

-- Create trigger for updated_at
CREATE TRIGGER update_label_settings_updated_at
  BEFORE UPDATE ON public.label_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();