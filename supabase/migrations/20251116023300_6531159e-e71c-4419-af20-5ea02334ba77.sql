-- Enable realtime for order_comments table
ALTER TABLE public.order_comments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_comments;