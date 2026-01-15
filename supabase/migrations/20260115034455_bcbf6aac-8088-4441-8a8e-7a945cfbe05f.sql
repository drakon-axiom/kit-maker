-- Update the handle_customer_signup function to assign the default brand
CREATE OR REPLACE FUNCTION public.handle_customer_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_brand_id uuid;
BEGIN
  -- Get the default brand ID
  SELECT id INTO default_brand_id FROM public.brands WHERE is_default = true LIMIT 1;
  
  -- Insert customer record with default brand
  INSERT INTO public.customers (user_id, name, email, brand_id)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    default_brand_id
  );
  
  -- Assign customer role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'customer'::app_role);
  
  RETURN new;
END;
$$;

-- Update existing customers without a brand to use the default brand
UPDATE public.customers 
SET brand_id = (SELECT id FROM public.brands WHERE is_default = true LIMIT 1)
WHERE brand_id IS NULL;