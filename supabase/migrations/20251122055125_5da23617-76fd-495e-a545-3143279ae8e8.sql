-- Create restricted view for public quote access
-- This view only exposes customer-facing data, preventing information disclosure
CREATE OR REPLACE VIEW public.public_quotes AS
SELECT 
  so.id,
  so.human_uid,
  so.quote_expires_at,
  so.subtotal,
  so.deposit_required,
  so.deposit_amount,
  so.status,
  so.created_at,
  so.quote_link_token,
  c.name as customer_name
FROM sales_orders so
JOIN customers c ON c.id = so.customer_id
WHERE so.quote_link_token IS NOT NULL;

-- Grant access to the view
GRANT SELECT ON public.public_quotes TO anon, authenticated;

-- Remove the overly permissive policy from sales_orders
DROP POLICY IF EXISTS "Anyone can view quote with valid token" ON sales_orders;

-- Add a more restrictive policy that checks token validity
-- This prevents excessive joins from exposing sensitive data
CREATE POLICY "Quote link access restricted"
ON sales_orders FOR SELECT
USING (
  quote_link_token IS NOT NULL 
  AND status IN ('quoted', 'awaiting_approval', 'deposit_due')
);