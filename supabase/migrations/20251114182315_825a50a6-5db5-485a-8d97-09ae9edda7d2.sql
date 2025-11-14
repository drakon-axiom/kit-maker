-- Add user_id to customers table to link with auth users
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);

-- RLS policies for customers to access their own data
CREATE POLICY "Customers can view their own profile"
ON public.customers
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Customers can update their own profile"
ON public.customers
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- RLS policies for customers to view their own orders
CREATE POLICY "Customers can view their own orders"
ON public.sales_orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = sales_orders.customer_id
    AND customers.user_id = auth.uid()
  )
);

-- RLS policies for customers to create orders
CREATE POLICY "Customers can create orders for themselves"
ON public.sales_orders
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = sales_orders.customer_id
    AND customers.user_id = auth.uid()
  )
);

-- RLS policies for customers to view order lines
CREATE POLICY "Customers can view their order lines"
ON public.sales_order_lines
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sales_orders so
    JOIN public.customers c ON c.id = so.customer_id
    WHERE so.id = sales_order_lines.so_id
    AND c.user_id = auth.uid()
  )
);

-- RLS policies for customers to create order lines
CREATE POLICY "Customers can create order lines for their orders"
ON public.sales_order_lines
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sales_orders so
    JOIN public.customers c ON c.id = so.customer_id
    WHERE so.id = sales_order_lines.so_id
    AND c.user_id = auth.uid()
  )
);

-- RLS policies for customers to view SKUs they have access to
CREATE POLICY "Customers can view SKUs they have access to"
ON public.skus
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customer_product_access cpa
    JOIN public.customers c ON c.id = cpa.customer_id
    WHERE cpa.sku_id = skus.id
    AND c.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.customer_category_access cca
    JOIN public.customers c ON c.id = cca.customer_id
    WHERE cca.category_id = skus.category_id
    AND c.user_id = auth.uid()
  )
);

-- Helper function for customers
CREATE OR REPLACE FUNCTION public.is_customer()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'customer'
  )
$$;