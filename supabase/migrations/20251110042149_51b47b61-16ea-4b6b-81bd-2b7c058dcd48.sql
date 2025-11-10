-- Fix search_path for notify_order_status_change function
CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status has changed and new status requires notification
  IF OLD.status IS DISTINCT FROM NEW.status 
     AND NEW.status IN ('in_production', 'in_packing', 'packed', 'shipped') THEN
    
    -- Make async HTTP call to edge function
    PERFORM
      net.http_post(
        url := 'https://dfaafbwhdnoaknuxonig.supabase.co/functions/v1/send-order-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmYWFmYndoZG5vYWtudXhvbmlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1Mjg2MDcsImV4cCI6MjA3ODEwNDYwN30.tfNO9zzbUvfXNFSGMB2XqY9Nbs26AKle61OB-9AMjVM'
        ),
        body := jsonb_build_object(
          'orderId', NEW.id,
          'newStatus', NEW.status,
          'oldStatus', OLD.status
        )
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
