-- Add contact information fields to brands table
ALTER TABLE brands 
ADD COLUMN contact_email text,
ADD COLUMN contact_phone text,
ADD COLUMN contact_address text;