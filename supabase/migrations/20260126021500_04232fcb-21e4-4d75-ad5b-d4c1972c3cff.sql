-- Create order_addons table to link parent orders with add-on orders
CREATE TABLE public.order_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_so_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  addon_so_id UUID NOT NULL UNIQUE REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  admin_notes TEXT
);

-- Add parent_order_id self-referential column to sales_orders for easy querying
ALTER TABLE public.sales_orders 
ADD COLUMN parent_order_id UUID REFERENCES public.sales_orders(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX idx_order_addons_parent_so_id ON public.order_addons(parent_so_id);
CREATE INDEX idx_order_addons_addon_so_id ON public.order_addons(addon_so_id);
CREATE INDEX idx_sales_orders_parent_order_id ON public.sales_orders(parent_order_id);

-- Enable RLS
ALTER TABLE public.order_addons ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_addons
CREATE POLICY "Admins can manage all add-ons"
ON public.order_addons
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Customers can view add-ons linked to their orders"
ON public.order_addons
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM sales_orders so
    JOIN customers c ON c.id = so.customer_id
    WHERE (so.id = order_addons.parent_so_id OR so.id = order_addons.addon_so_id)
    AND c.user_id = auth.uid()
  )
);

-- Insert default settings for add-on configuration
INSERT INTO public.settings (key, value, description) VALUES
  ('addon_max_percent', '100', 'Maximum add-on value as percentage of original order (0 = no limit)'),
  ('addon_auto_approve_threshold', '0', 'Auto-approve add-ons below this dollar amount (0 = disabled)'),
  ('addon_cutoff_status', 'in_packing', 'Status after which add-ons are blocked')
ON CONFLICT (key) DO NOTHING;