-- Add unique constraint on email in customers table
-- First, handle any existing duplicates by keeping only the most recent one
WITH duplicates AS (
  SELECT id, email, ROW_NUMBER() OVER (PARTITION BY LOWER(email) ORDER BY created_at DESC) as rn
  FROM public.customers
  WHERE email IS NOT NULL AND email != ''
)
UPDATE public.customers 
SET email = CONCAT(email, '_duplicate_', id)
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Add unique constraint on lowercase email to prevent case-insensitive duplicates
CREATE UNIQUE INDEX IF NOT EXISTS customers_email_unique_idx ON public.customers (LOWER(email)) WHERE email IS NOT NULL AND email != '';

-- Also add unique constraint on wholesale_applications to prevent duplicate applications
CREATE UNIQUE INDEX IF NOT EXISTS wholesale_applications_email_unique_idx ON public.wholesale_applications (LOWER(email));

-- Update the handle_customer_signup function to handle duplicates gracefully
CREATE OR REPLACE FUNCTION public.handle_customer_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_brand_id uuid;
  existing_customer_id uuid;
BEGIN
  -- Get the default brand ID
  SELECT id INTO default_brand_id FROM public.brands WHERE is_default = true LIMIT 1;
  
  -- Check if customer with this email already exists
  SELECT id INTO existing_customer_id FROM public.customers WHERE LOWER(email) = LOWER(new.email) LIMIT 1;
  
  IF existing_customer_id IS NOT NULL THEN
    -- Link existing customer to the new user
    UPDATE public.customers 
    SET user_id = new.id,
        name = COALESCE(new.raw_user_meta_data->>'full_name', name)
    WHERE id = existing_customer_id;
  ELSE
    -- Insert new customer record
    INSERT INTO public.customers (user_id, name, email, brand_id)
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'full_name', new.email),
      new.email,
      default_brand_id
    );
  END IF;
  
  -- Assign customer role if not already assigned
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'customer'::app_role)
  ON CONFLICT DO NOTHING;
  
  RETURN new;
END;
$$;