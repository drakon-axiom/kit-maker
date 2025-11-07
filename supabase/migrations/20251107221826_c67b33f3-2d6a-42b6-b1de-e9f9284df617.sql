-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE public.app_role AS ENUM ('admin', 'operator');
CREATE TYPE public.order_status AS ENUM ('draft', 'quoted', 'deposit_due', 'in_queue', 'in_production', 'packed', 'invoiced', 'payment_due', 'ready_to_ship', 'shipped', 'cancelled');
CREATE TYPE public.deposit_status AS ENUM ('unpaid', 'partial', 'paid');
CREATE TYPE public.sell_mode AS ENUM ('kit', 'piece');
CREATE TYPE public.batch_status AS ENUM ('queued', 'wip', 'hold', 'complete');
CREATE TYPE public.workflow_step_type AS ENUM ('produce', 'bottle_cap', 'label', 'pack');
CREATE TYPE public.step_status AS ENUM ('pending', 'wip', 'done');
CREATE TYPE public.invoice_type AS ENUM ('deposit', 'final');
CREATE TYPE public.invoice_status AS ENUM ('unpaid', 'paid');
CREATE TYPE public.payment_method AS ENUM ('cash', 'check', 'ach', 'wire', 'other');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Settings table
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default settings
INSERT INTO public.settings (key, value, description) VALUES
  ('kit_size', '10', 'Default number of bottles per kit'),
  ('default_deposit_percent', '50', 'Default deposit percentage'),
  ('tracking_carriers', 'USPS,FedEx,UPS,DHL,Other', 'Available shipping carriers');

-- Customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  default_terms TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SKUs table
CREATE TABLE public.skus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  label_required BOOLEAN NOT NULL DEFAULT FALSE,
  price_per_kit DECIMAL(10,2) NOT NULL,
  price_per_piece DECIMAL(10,2) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sales Orders table
CREATE TABLE public.sales_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uid TEXT UNIQUE NOT NULL,
  human_uid TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  source_channel TEXT NOT NULL DEFAULT 'email',
  status order_status NOT NULL DEFAULT 'draft',
  deposit_required BOOLEAN NOT NULL DEFAULT FALSE,
  deposit_amount DECIMAL(10,2) DEFAULT 0,
  deposit_status deposit_status NOT NULL DEFAULT 'unpaid',
  promised_date DATE,
  eta_date DATE,
  manual_payment_notes TEXT,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sales Order Lines table
CREATE TABLE public.sales_order_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  so_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES public.skus(id),
  sell_mode sell_mode NOT NULL,
  qty_entered INT NOT NULL,
  bottle_qty INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  line_subtotal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Production Batches table
CREATE TABLE public.production_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uid TEXT UNIQUE NOT NULL,
  human_uid TEXT NOT NULL,
  so_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  status batch_status NOT NULL DEFAULT 'queued',
  priority_index INT NOT NULL DEFAULT 0,
  planned_start TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_finish TIMESTAMPTZ,
  qty_bottle_planned INT NOT NULL,
  qty_bottle_good INT DEFAULT 0,
  qty_bottle_scrap INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Production Batch Items (allocation table)
CREATE TABLE public.production_batch_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES public.production_batches(id) ON DELETE CASCADE,
  so_line_id UUID NOT NULL REFERENCES public.sales_order_lines(id) ON DELETE CASCADE,
  bottle_qty_allocated INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(batch_id, so_line_id)
);

-- Workflow Steps table
CREATE TABLE public.workflow_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES public.production_batches(id) ON DELETE CASCADE,
  step workflow_step_type NOT NULL,
  status step_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  operator_id UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(batch_id, step)
);

-- Invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type invoice_type NOT NULL,
  so_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  invoice_no TEXT UNIQUE NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  status invoice_status NOT NULL DEFAULT 'unpaid',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invoice Payments table
CREATE TABLE public.invoice_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  method payment_method NOT NULL,
  external_ref TEXT,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shipments table
CREATE TABLE public.shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  so_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  carrier TEXT,
  tracking_no TEXT NOT NULL,
  shipped_at TIMESTAMPTZ,
  label_url TEXT,
  notes TEXT,
  share_link_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Log table
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_batch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Security definer function to check if user has any role
CREATE OR REPLACE FUNCTION public.is_authenticated_user()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (public.is_authenticated_user());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies for settings
CREATE POLICY "Authenticated users can view settings" ON public.settings FOR SELECT USING (public.is_authenticated_user());
CREATE POLICY "Only admins can update settings" ON public.settings FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for customers (admin only for modifications)
CREATE POLICY "Authenticated users can view customers" ON public.customers FOR SELECT USING (public.is_authenticated_user());
CREATE POLICY "Admins can manage customers" ON public.customers FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for skus
CREATE POLICY "Authenticated users can view skus" ON public.skus FOR SELECT USING (public.is_authenticated_user());
CREATE POLICY "Admins can manage skus" ON public.skus FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for sales_orders
CREATE POLICY "Authenticated users can view orders" ON public.sales_orders FOR SELECT USING (public.is_authenticated_user());
CREATE POLICY "Admins can manage orders" ON public.sales_orders FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for sales_order_lines
CREATE POLICY "Authenticated users can view order lines" ON public.sales_order_lines FOR SELECT USING (public.is_authenticated_user());
CREATE POLICY "Admins can manage order lines" ON public.sales_order_lines FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for production_batches
CREATE POLICY "Authenticated users can view batches" ON public.production_batches FOR SELECT USING (public.is_authenticated_user());
CREATE POLICY "Admins can manage batches" ON public.production_batches FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Operators can update batch status" ON public.production_batches FOR UPDATE USING (public.has_role(auth.uid(), 'operator'));

-- RLS Policies for production_batch_items
CREATE POLICY "Authenticated users can view batch items" ON public.production_batch_items FOR SELECT USING (public.is_authenticated_user());
CREATE POLICY "Admins can manage batch items" ON public.production_batch_items FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for workflow_steps
CREATE POLICY "Authenticated users can view workflow steps" ON public.workflow_steps FOR SELECT USING (public.is_authenticated_user());
CREATE POLICY "Admins can manage workflow steps" ON public.workflow_steps FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Operators can update workflow steps" ON public.workflow_steps FOR UPDATE USING (public.has_role(auth.uid(), 'operator'));

-- RLS Policies for invoices
CREATE POLICY "Authenticated users can view invoices" ON public.invoices FOR SELECT USING (public.is_authenticated_user());
CREATE POLICY "Admins can manage invoices" ON public.invoices FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for invoice_payments
CREATE POLICY "Authenticated users can view payments" ON public.invoice_payments FOR SELECT USING (public.is_authenticated_user());
CREATE POLICY "Admins can manage payments" ON public.invoice_payments FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for shipments
CREATE POLICY "Authenticated users can view shipments" ON public.shipments FOR SELECT USING (public.is_authenticated_user());
CREATE POLICY "Admins can manage shipments" ON public.shipments FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for audit_log
CREATE POLICY "Admins can view audit log" ON public.audit_log FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert audit log" ON public.audit_log FOR INSERT WITH CHECK (true);

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_skus_updated_at BEFORE UPDATE ON public.skus FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_sales_orders_updated_at BEFORE UPDATE ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_production_batches_updated_at BEFORE UPDATE ON public.production_batches FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();