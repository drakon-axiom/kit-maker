-- Add INSERT policy for settings table to allow admins to add new settings
CREATE POLICY "Only admins can insert settings" 
ON public.settings 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));