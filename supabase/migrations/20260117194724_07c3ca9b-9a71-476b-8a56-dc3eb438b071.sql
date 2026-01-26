-- Add DELETE policy for admins on wholesale_applications
CREATE POLICY "Admins can delete applications"
ON public.wholesale_applications
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));