-- Fix the security definer view by making it security invoker
-- This ensures the view uses the permissions of the querying user, not the creator
ALTER VIEW public.public_quotes SET (security_invoker = on);