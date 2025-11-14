-- Create customer access requests table
CREATE TABLE public.customer_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_access_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Customers can view their own requests"
  ON public.customer_access_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.customers
      WHERE customers.id = customer_access_requests.customer_id
      AND customers.user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can create their own requests"
  ON public.customer_access_requests
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.customers
      WHERE customers.id = customer_access_requests.customer_id
      AND customers.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all requests"
  ON public.customer_access_requests
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_customer_access_requests_updated_at
  BEFORE UPDATE ON public.customer_access_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();