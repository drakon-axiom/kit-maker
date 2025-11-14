-- Add customer role to app_role enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'customer') THEN
    ALTER TYPE app_role ADD VALUE 'customer';
  END IF;
END $$;