-- Create enum for application status
CREATE TYPE application_status AS ENUM ('pending', 'approved', 'rejected');

-- Create wholesale applications table
CREATE TABLE public.wholesale_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  business_type TEXT,
  website TEXT,
  message TEXT,
  status application_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.wholesale_applications ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert applications (public signup)
CREATE POLICY "Anyone can submit wholesale application"
ON public.wholesale_applications
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Admins can view all applications
CREATE POLICY "Admins can view all applications"
ON public.wholesale_applications
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Admins can update applications (for approval/rejection)
CREATE POLICY "Admins can update applications"
ON public.wholesale_applications
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Create index for faster queries
CREATE INDEX idx_wholesale_applications_status ON public.wholesale_applications(status);
CREATE INDEX idx_wholesale_applications_created_at ON public.wholesale_applications(created_at DESC);