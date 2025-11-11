-- Add custom_html field to label_settings for custom HTML templates
ALTER TABLE public.label_settings
ADD COLUMN custom_html TEXT;