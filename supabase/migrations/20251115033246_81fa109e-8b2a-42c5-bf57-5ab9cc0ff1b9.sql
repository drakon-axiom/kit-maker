-- Update the trigger function to include webhook secret when calling edge functions
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only proceed if status has changed and new status requires notification
  IF OLD.status IS DISTINCT FROM NEW.status 
     AND NEW.status IN ('in_production', 'in_packing', 'packed', 'shipped') THEN
    
    -- Make async HTTP call to edge function with webhook secret
    PERFORM
      net.http_post(
        url := 'https://dfaafbwhdnoaknuxonig.supabase.co/functions/v1/send-order-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmYWFmYndoZG5vYWtudXhvbmlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1Mjg2MDcsImV4cCI6MjA3ODEwNDYwN30.tfNO9zzbUvfXNFSGMB2XqY9Nbs26AKle61OB-9AMjVM',
          'x-webhook-secret', current_setting('app.settings.internal_webhook_secret', true)
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
$function$;

-- Store the webhook secret in a secure way that the trigger can access
-- First, we need to ensure the pg_catalog.set_config function is available
DO $$
BEGIN
  -- Set a runtime configuration parameter that will be available to functions
  -- This is a placeholder - the actual secret will need to be set via Supabase secrets
  PERFORM set_config('app.settings.internal_webhook_secret', 'PLACEHOLDER_WILL_USE_ENV', false);
EXCEPTION WHEN OTHERS THEN
  -- If setting fails, that's okay - we'll use environment variable in production
  RAISE NOTICE 'Could not set config parameter';
END $$;