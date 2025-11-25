-- Create workflow completions table to track labor time and costs
CREATE TABLE IF NOT EXISTS public.workflow_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.production_batches(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL REFERENCES auth.users(id),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  elapsed_seconds INTEGER NOT NULL,
  labor_rate_per_hour NUMERIC(10, 2) NOT NULL,
  labor_cost NUMERIC(10, 2) NOT NULL,
  steps_completed INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX idx_workflow_completions_batch_id ON public.workflow_completions(batch_id);
CREATE INDEX idx_workflow_completions_operator_id ON public.workflow_completions(operator_id);
CREATE INDEX idx_workflow_completions_completed_at ON public.workflow_completions(completed_at DESC);

-- Enable RLS
ALTER TABLE public.workflow_completions ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can manage all workflow completions
CREATE POLICY "Admins can manage workflow completions"
  ON public.workflow_completions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Operators can view their own workflow completions
CREATE POLICY "Operators can view their own workflow completions"
  ON public.workflow_completions
  FOR SELECT
  USING (
    has_role(auth.uid(), 'operator'::app_role) 
    AND operator_id = auth.uid()
  );

-- Policy: Operators can insert their own workflow completions
CREATE POLICY "Operators can insert their own workflow completions"
  ON public.workflow_completions
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'operator'::app_role) 
    AND operator_id = auth.uid()
  );

-- Policy: Authenticated users can view workflow completions
CREATE POLICY "Authenticated users can view workflow completions"
  ON public.workflow_completions
  FOR SELECT
  USING (is_authenticated_user());