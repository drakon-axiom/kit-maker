-- Add batch_prefix column to skus table for automatic batch number generation
ALTER TABLE public.skus 
ADD COLUMN batch_prefix text;

-- Add comment explaining the batch numbering format
COMMENT ON COLUMN public.skus.batch_prefix IS 'Three-letter prefix for batch numbers. Format: PREFIX-YYMM-XXX (e.g., GTB-2511-001)';

-- Create function to generate batch numbers automatically
CREATE OR REPLACE FUNCTION public.generate_batch_number(sku_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  prefix text;
  year_month text;
  max_index int;
  new_index text;
  batch_number text;
BEGIN
  -- Get the batch prefix for this SKU
  SELECT batch_prefix INTO prefix
  FROM skus
  WHERE code = sku_code;
  
  -- If no prefix found, use the SKU code itself
  IF prefix IS NULL THEN
    prefix := sku_code;
  END IF;
  
  -- Get current year-month in YYMM format
  year_month := TO_CHAR(NOW(), 'YYMM');
  
  -- Find the highest index for this prefix+month
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(human_uid FROM '[0-9]{3}$') AS INTEGER
      )
    ),
    0
  ) INTO max_index
  FROM production_batches
  WHERE human_uid LIKE prefix || '-' || year_month || '-%';
  
  -- Increment and format as 3-digit number
  new_index := LPAD((max_index + 1)::text, 3, '0');
  
  -- Construct the batch number
  batch_number := prefix || '-' || year_month || '-' || new_index;
  
  RETURN batch_number;
END;
$function$;