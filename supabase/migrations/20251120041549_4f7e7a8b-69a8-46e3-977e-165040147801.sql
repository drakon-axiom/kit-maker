-- Create function to generate sequential order numbers
CREATE OR REPLACE FUNCTION public.generate_order_number(order_prefix text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  max_number int;
  new_number text;
  order_number text;
BEGIN
  -- Find the highest number for this prefix
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(human_uid FROM '[0-9]+$') AS INTEGER
      )
    ),
    0
  ) INTO max_number
  FROM sales_orders
  WHERE human_uid LIKE order_prefix || '-%';
  
  -- Increment and format as 4-digit number
  new_number := LPAD((max_number + 1)::text, 4, '0');
  
  -- Construct the order number
  order_number := order_prefix || '-' || new_number;
  
  RETURN order_number;
END;
$function$;

-- Update existing orders to have proper sequential format
-- This is optional - you can skip this if you want to keep existing order numbers as-is
DO $$
DECLARE
  rec RECORD;
  counter INT := 0;
BEGIN
  -- Update customer orders
  FOR rec IN 
    SELECT id FROM sales_orders 
    WHERE is_internal = false 
    ORDER BY created_at
  LOOP
    counter := counter + 1;
    UPDATE sales_orders 
    SET human_uid = 'SO-' || LPAD(counter::text, 4, '0')
    WHERE id = rec.id;
  END LOOP;
  
  -- Update internal orders
  counter := 0;
  FOR rec IN 
    SELECT id FROM sales_orders 
    WHERE is_internal = true 
    ORDER BY created_at
  LOOP
    counter := counter + 1;
    UPDATE sales_orders 
    SET human_uid = 'INT-' || LPAD(counter::text, 4, '0')
    WHERE id = rec.id;
  END LOOP;
END $$;