-- Create function to handle new customer signup
create or replace function public.handle_customer_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Insert customer record
  insert into public.customers (user_id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email
  );
  
  -- Assign customer role
  insert into public.user_roles (user_id, role)
  values (new.id, 'customer'::app_role);
  
  return new;
end;
$$;

-- Create trigger for automatic customer signup
create trigger on_customer_signup
  after insert on auth.users
  for each row
  execute function public.handle_customer_signup();