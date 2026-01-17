-- Add UPDATE policy for admin/operator on archive table to support upsert
CREATE POLICY "Admin/operator can update archived applications"
ON public.wholesale_applications_archive
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'operator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'operator')
  )
);