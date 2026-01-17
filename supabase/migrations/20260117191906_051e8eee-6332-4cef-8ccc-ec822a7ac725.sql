-- Create archived wholesale applications table
CREATE TABLE public.wholesale_applications_archive (
  id uuid PRIMARY KEY,
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  website text,
  business_type text,
  message text,
  shipping_address_line1 text,
  shipping_address_line2 text,
  shipping_city text,
  shipping_state text,
  shipping_zip text,
  shipping_country text,
  billing_address_line1 text,
  billing_address_line2 text,
  billing_city text,
  billing_state text,
  billing_zip text,
  billing_country text,
  billing_same_as_shipping boolean DEFAULT true,
  status public.application_status NOT NULL,
  notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wholesale_applications_archive ENABLE ROW LEVEL SECURITY;

-- Only admins/operators can view archived applications
CREATE POLICY "Admin/operator can view archived applications"
  ON public.wholesale_applications_archive
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

-- Only admins can delete archived applications
CREATE POLICY "Admin can delete archived applications"
  ON public.wholesale_applications_archive
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create index on email for quick lookups
CREATE INDEX idx_wholesale_applications_archive_email ON public.wholesale_applications_archive(email);

-- Add comment explaining purpose
COMMENT ON TABLE public.wholesale_applications_archive IS 'Historical record of processed wholesale applications';