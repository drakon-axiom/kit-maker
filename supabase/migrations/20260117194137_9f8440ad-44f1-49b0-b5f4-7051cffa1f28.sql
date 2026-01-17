-- Add INSERT policy for admin/operator to archive applications
CREATE POLICY "Admin/operator can insert archived applications"
ON public.wholesale_applications_archive
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'operator')
  )
);