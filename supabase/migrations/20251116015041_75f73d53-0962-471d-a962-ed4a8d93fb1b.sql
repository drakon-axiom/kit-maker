-- Allow customers to create their own customer profile
CREATE POLICY "Customers can create their own profile"
ON public.customers
FOR INSERT
WITH CHECK (auth.uid() = user_id);