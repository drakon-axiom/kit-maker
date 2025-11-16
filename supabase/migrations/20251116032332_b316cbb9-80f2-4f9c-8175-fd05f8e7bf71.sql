-- Add comment_type to order_comments table
ALTER TABLE public.order_comments 
ADD COLUMN comment_type text DEFAULT 'comment' CHECK (comment_type IN ('comment', 'cancellation_request', 'modification_request'));

-- Add modification_details column to store what changes are requested
ALTER TABLE public.order_comments
ADD COLUMN modification_details jsonb;

-- Add status for tracking request state
ALTER TABLE public.order_comments
ADD COLUMN request_status text CHECK (request_status IN ('pending', 'approved', 'rejected'));

-- Add admin response fields
ALTER TABLE public.order_comments
ADD COLUMN admin_response text;

ALTER TABLE public.order_comments
ADD COLUMN resolved_by uuid REFERENCES auth.users(id);

ALTER TABLE public.order_comments
ADD COLUMN resolved_at timestamptz;

-- Create index for faster queries on request types
CREATE INDEX idx_order_comments_type_status ON public.order_comments(comment_type, request_status) WHERE comment_type IN ('cancellation_request', 'modification_request');

-- Update existing cancellation request comments to have proper type
UPDATE public.order_comments 
SET comment_type = 'cancellation_request',
    request_status = 'pending'
WHERE comment LIKE '%requested cancellation%' OR comment LIKE '%cancel%request%';