-- Remove webhook secret dependency from database trigger
-- Use JWT-based authentication instead for internal edge function calls

CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  customer_sms_phone text;
  customer_sms_enabled boolean;
  customer_sms_order_status boolean;
  service_role_key text;
BEGIN
  -- Only proceed if status has changed and new status requires notification
  IF OLD.status IS DISTINCT FROM NEW.status 
     AND NEW.status IN ('in_production', 'in_packing', 'packed', 'shipped') THEN
    
    -- Get service role key from environment (set at trigger creation)
    service_role_key := current_setting('app.supabase_service_role_key', true);
    
    -- Make async HTTP call to email notification edge function
    -- Using service role key for JWT authentication instead of webhook secret
    PERFORM
      net.http_post(
        url := 'https://dfaafbwhdnoaknuxonig.supabase.co/functions/v1/send-order-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
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
            'Authorization', 'Bearer ' || service_role_key
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

-- Set the service role key for the trigger to use
-- This is done once during deployment and persists for the session
SELECT set_config(
  'app.supabase_service_role_key',
  current_setting('env.SUPABASE_SERVICE_ROLE_KEY', true),
  false
);