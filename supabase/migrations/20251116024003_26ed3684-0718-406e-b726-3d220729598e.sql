-- Create payment_transactions table to track all payments
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  so_id UUID NOT NULL REFERENCES public.sales_orders(id),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('deposit', 'final')),
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  payment_method TEXT NOT NULL DEFAULT 'stripe',
  stripe_payment_intent TEXT,
  stripe_session_id TEXT,
  customer_email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Admins can view all payment transactions
CREATE POLICY "Admins can view all payment transactions"
  ON public.payment_transactions
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Customers can view their own payment transactions
CREATE POLICY "Customers can view their own payment transactions"
  ON public.payment_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sales_orders so
      JOIN customers c ON c.id = so.customer_id
      WHERE so.id = payment_transactions.so_id
      AND c.user_id = auth.uid()
    )
  );

-- Create index for faster queries
CREATE INDEX idx_payment_transactions_so_id ON public.payment_transactions(so_id);
CREATE INDEX idx_payment_transactions_created_at ON public.payment_transactions(created_at DESC);