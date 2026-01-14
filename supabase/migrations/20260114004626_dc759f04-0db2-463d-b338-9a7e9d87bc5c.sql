-- Add brand_id to email_templates to allow brand-specific templates
ALTER TABLE public.email_templates 
ADD COLUMN brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX idx_email_templates_brand_id ON public.email_templates(brand_id);

-- Add comment
COMMENT ON COLUMN public.email_templates.brand_id IS 'Optional brand-specific template. NULL means global/default template.';