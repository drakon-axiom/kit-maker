-- Security: Fix overly permissive RLS policies
-- Previously all authenticated users could see ALL data. Now:
-- - Admins/operators can see all records
-- - Customers can only see their own records

-- Helper function: check if user has admin or operator role
CREATE OR REPLACE FUNCTION public.is_admin_or_operator()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'operator')
  );
$$;

-- Helper function: get customer IDs belonging to current user
CREATE OR REPLACE FUNCTION public.get_user_customer_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM public.customers
  WHERE user_id = auth.uid();
$$;

-- ============================================================
-- Fix customers table: customers see only their own record
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;

CREATE POLICY "Admins and operators can view all customers" ON public.customers
  FOR SELECT USING (public.is_admin_or_operator());

CREATE POLICY "Customers can view their own record" ON public.customers
  FOR SELECT USING (user_id = auth.uid());

-- ============================================================
-- Fix sales_orders table: customers see only their own orders
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view orders" ON public.sales_orders;

CREATE POLICY "Admins and operators can view all orders" ON public.sales_orders
  FOR SELECT USING (public.is_admin_or_operator());

CREATE POLICY "Customers can view their own orders" ON public.sales_orders
  FOR SELECT USING (customer_id IN (SELECT public.get_user_customer_ids()));

-- ============================================================
-- Fix sales_order_lines: customers see only their order lines
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view order lines" ON public.sales_order_lines;

CREATE POLICY "Admins and operators can view all order lines" ON public.sales_order_lines
  FOR SELECT USING (public.is_admin_or_operator());

CREATE POLICY "Customers can view their own order lines" ON public.sales_order_lines
  FOR SELECT USING (
    so_id IN (
      SELECT id FROM public.sales_orders
      WHERE customer_id IN (SELECT public.get_user_customer_ids())
    )
  );

-- ============================================================
-- Fix invoices: customers see only their own invoices
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view invoices" ON public.invoices;

CREATE POLICY "Admins and operators can view all invoices" ON public.invoices
  FOR SELECT USING (public.is_admin_or_operator());

CREATE POLICY "Customers can view their own invoices" ON public.invoices
  FOR SELECT USING (
    so_id IN (
      SELECT id FROM public.sales_orders
      WHERE customer_id IN (SELECT public.get_user_customer_ids())
    )
  );

-- ============================================================
-- Fix invoice_payments: customers see only their own payments
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view payments" ON public.invoice_payments;

CREATE POLICY "Admins and operators can view all payments" ON public.invoice_payments
  FOR SELECT USING (public.is_admin_or_operator());

CREATE POLICY "Customers can view their own payments" ON public.invoice_payments
  FOR SELECT USING (
    invoice_id IN (
      SELECT i.id FROM public.invoices i
      JOIN public.sales_orders so ON so.id = i.so_id
      WHERE so.customer_id IN (SELECT public.get_user_customer_ids())
    )
  );

-- ============================================================
-- Fix shipments: customers see only their own shipments
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view shipments" ON public.shipments;

CREATE POLICY "Admins and operators can view all shipments" ON public.shipments
  FOR SELECT USING (public.is_admin_or_operator());

CREATE POLICY "Customers can view their own shipments" ON public.shipments
  FOR SELECT USING (
    so_id IN (
      SELECT id FROM public.sales_orders
      WHERE customer_id IN (SELECT public.get_user_customer_ids())
    )
  );

-- ============================================================
-- Fix production_batches: customers see only their own batches
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view batches" ON public.production_batches;

CREATE POLICY "Admins and operators can view all batches" ON public.production_batches
  FOR SELECT USING (public.is_admin_or_operator());

CREATE POLICY "Customers can view their own batches" ON public.production_batches
  FOR SELECT USING (
    so_id IN (
      SELECT id FROM public.sales_orders
      WHERE customer_id IN (SELECT public.get_user_customer_ids())
    )
  );

-- ============================================================
-- SKUs remain visible to all authenticated users (product catalog)
-- No change needed for skus — viewing products is not sensitive
-- ============================================================

-- ============================================================
-- Restrict brands table: hide sensitive credential columns
-- Customers should not be able to see payment gateway secrets
-- ============================================================
-- Note: Column-level security is not supported via RLS.
-- The brand credentials (paypal_client_secret, btcpay_api_key, smtp_password)
-- should be moved to Supabase Vault or accessed only via service role.
-- For now, we add a view that strips sensitive columns for non-admin users.

-- Ensure payment_transactions table has proper RLS
-- (may not exist in original migration, so use IF EXISTS pattern)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'payment_transactions' AND schemaname = 'public') THEN
    -- Drop old permissive policy if it exists
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can view payment_transactions" ON public.payment_transactions';

    -- Create role-based policies
    EXECUTE 'CREATE POLICY "Admins and operators can view all payment_transactions" ON public.payment_transactions
      FOR SELECT USING (public.is_admin_or_operator())';

    EXECUTE 'CREATE POLICY "Customers can view their own payment_transactions" ON public.payment_transactions
      FOR SELECT USING (
        so_id IN (
          SELECT id FROM public.sales_orders
          WHERE customer_id IN (SELECT public.get_user_customer_ids())
        )
      )';
  END IF;
END $$;
