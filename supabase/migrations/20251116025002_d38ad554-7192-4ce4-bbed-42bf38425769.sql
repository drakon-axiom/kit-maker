-- Create saved_addresses table for multiple shipping/billing addresses
CREATE TABLE IF NOT EXISTS public.saved_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  address_type TEXT NOT NULL CHECK (address_type IN ('shipping', 'billing', 'both')),
  label TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'USA',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE UNIQUE,
  email_order_status BOOLEAN NOT NULL DEFAULT true,
  email_payment_received BOOLEAN NOT NULL DEFAULT true,
  email_shipment_updates BOOLEAN NOT NULL DEFAULT true,
  email_quote_approved BOOLEAN NOT NULL DEFAULT true,
  email_quote_expiring BOOLEAN NOT NULL DEFAULT true,
  email_marketing BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quote_actions table to track quote accept/reject history
CREATE TABLE IF NOT EXISTS public.quote_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  so_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('accepted', 'rejected', 'expired')),
  action_by UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for saved_addresses
CREATE POLICY "Customers can view their own addresses"
  ON public.saved_addresses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = saved_addresses.customer_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can manage their own addresses"
  ON public.saved_addresses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = saved_addresses.customer_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all addresses"
  ON public.saved_addresses FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for notification_preferences
CREATE POLICY "Customers can view their own preferences"
  ON public.notification_preferences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = notification_preferences.customer_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can manage their own preferences"
  ON public.notification_preferences FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = notification_preferences.customer_id
      AND c.user_id = auth.uid()
    )
  );

-- RLS Policies for quote_actions
CREATE POLICY "Customers can view their quote actions"
  ON public.quote_actions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sales_orders so
      JOIN customers c ON c.id = so.customer_id
      WHERE so.id = quote_actions.so_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all quote actions"
  ON public.quote_actions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Customers can create quote actions for their orders"
  ON public.quote_actions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_orders so
      JOIN customers c ON c.id = so.customer_id
      WHERE so.id = quote_actions.so_id
      AND c.user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX idx_saved_addresses_customer_id ON public.saved_addresses(customer_id);
CREATE INDEX idx_notification_preferences_customer_id ON public.notification_preferences(customer_id);
CREATE INDEX idx_quote_actions_so_id ON public.quote_actions(so_id);

-- Create trigger for updated_at
CREATE TRIGGER update_saved_addresses_updated_at
  BEFORE UPDATE ON public.saved_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();