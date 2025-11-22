-- Move extensions from public schema to extensions schema
-- This improves security by separating extensions from user tables

-- The uuid-ossp extension is likely in the public schema
-- Move it to the extensions schema (if not already there)
CREATE SCHEMA IF NOT EXISTS extensions;

-- Drop and recreate extension in proper schema
DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Grant usage on extensions schema
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Update any functions that reference uuid_generate_v4 to use fully qualified name
-- Since this is used in table defaults, we need to ensure the extension is accessible