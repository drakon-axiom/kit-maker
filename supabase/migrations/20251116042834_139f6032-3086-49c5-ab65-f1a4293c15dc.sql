-- Update trigger function to send both email and SMS notifications
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  webhook_secret text;
  customer_sms_phone text;
  customer_sms_enabled boolean;
  customer_sms_order_status boolean;
BEGIN
  -- Only proceed if status has changed and new status requires notification
  IF OLD.status IS DISTINCT FROM NEW.status 
     AND NEW.status IN ('in_production', 'in_packing', 'packed', 'shipped') THEN
    
    -- Get the webhook secret from settings
    SELECT value INTO webhook_secret
    FROM settings
    WHERE key = 'internal_webhook_secret'
    LIMIT 1;
    
    -- Make async HTTP call to email notification edge function
    PERFORM
      net.http_post(
        url := 'https://dfaafbwhdnoaknuxonig.supabase.co/functions/v1/send-order-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmYWFmYndoZG5vYWtudXhvbmlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1Mjg2MDcsImV4cCI6MjA3ODEwNDYwN30.tfNO9zzbUvfXNFSGMB2XqY9Nbs26AKle61OB-9AMjVM',
          'x-webhook-secret', webhook_secret
        ),
        body := jsonb_build_object(
          'orderId', NEW.id,
          'newStatus', NEW.status,
          'oldStatus', OLD.status
        )
      );
    
    -- Check SMS preferences
    SELECT 
      np.sms_enabled, 
      np.sms_phone_number,
      np.sms_order_status
    INTO 
      customer_sms_enabled,
      customer_sms_phone,
      customer_sms_order_status
    FROM notification_preferences np
    WHERE np.customer_id = NEW.customer_id;
    
    -- Send SMS if enabled and preferences allow
    IF customer_sms_enabled AND customer_sms_order_status AND customer_sms_phone IS NOT NULL THEN
      PERFORM
        net.http_post(
          url := 'https://dfaafbwhdnoaknuxonig.supabase.co/functions/v1/send-sms-notification',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmYWFmYndoZG5vYWtudXhvbmlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1Mjg2MDcsImV4cCI6MjA3ODEwNDYwN30.tfNO9zzbUvfXNFSGMB2XqY9Nbs26AKle61OB-9AMjVM',
            'x-webhook-secret', webhook_secret
          ),
          body := jsonb_build_object(
            'orderId', NEW.id,
            'newStatus', NEW.status,
            'phoneNumber', customer_sms_phone,
            'eventType', 'order_status'
          )
        );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;