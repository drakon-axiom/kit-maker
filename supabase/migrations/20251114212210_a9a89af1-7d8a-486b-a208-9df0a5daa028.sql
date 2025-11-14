-- Drop the overly permissive policy that lets all authenticated users see all SKUs
DROP POLICY IF EXISTS "Authenticated users can view skus" ON public.skus;

-- Create separate policies for admins and operators to view all SKUs
CREATE POLICY "Admins can view all skus"
ON public.skus
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Operators can view all skus"
ON public.skus
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'operator'::app_role));

-- The existing "Customers can view SKUs they have access to" policy remains
-- This ensures customers only see SKUs they've been granted explicit access to