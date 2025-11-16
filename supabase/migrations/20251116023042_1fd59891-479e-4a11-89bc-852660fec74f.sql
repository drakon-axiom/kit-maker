-- Create order comments table for customer-admin communication
CREATE TABLE public.order_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  so_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  comment TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_comments ENABLE ROW LEVEL SECURITY;

-- Policies for order comments
CREATE POLICY "Admins can manage all comments"
  ON public.order_comments
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Customers can view non-internal comments on their orders"
  ON public.order_comments
  FOR SELECT
  USING (
    NOT is_internal 
    AND EXISTS (
      SELECT 1 FROM sales_orders so
      JOIN customers c ON c.id = so.customer_id
      WHERE so.id = order_comments.so_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can create comments on their orders"
  ON public.order_comments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_orders so
      JOIN customers c ON c.id = so.customer_id
      WHERE so.id = order_comments.so_id
      AND c.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- Create index for faster queries
CREATE INDEX idx_order_comments_so_id ON public.order_comments(so_id);
CREATE INDEX idx_order_comments_created_at ON public.order_comments(created_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_order_comments_updated_at
  BEFORE UPDATE ON public.order_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();