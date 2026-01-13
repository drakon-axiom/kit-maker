-- Add SMTP configuration fields to brands table for per-brand email sending
ALTER TABLE public.brands
ADD COLUMN smtp_host text,
ADD COLUMN smtp_port integer DEFAULT 465,
ADD COLUMN smtp_user text,
ADD COLUMN smtp_password text;

-- Add a comment explaining these fields
COMMENT ON COLUMN public.brands.smtp_host IS 'SMTP server hostname (e.g., smtp.protonmail.ch)';
COMMENT ON COLUMN public.brands.smtp_port IS 'SMTP port (465 for TLS, 587 for STARTTLS)';
COMMENT ON COLUMN public.brands.smtp_user IS 'SMTP username/email for authentication';
COMMENT ON COLUMN public.brands.smtp_password IS 'SMTP password for authentication';