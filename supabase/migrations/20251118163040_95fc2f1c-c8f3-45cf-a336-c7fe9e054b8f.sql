-- Add domain field to brands table
ALTER TABLE brands ADD COLUMN domain TEXT UNIQUE;

COMMENT ON COLUMN brands.domain IS 'Custom domain for this brand (e.g., nexusaminos.com)';

-- Update existing brands with example domains (you can change these in the UI)
UPDATE brands SET domain = 'portal.axc.llc' WHERE slug = 'axiom-collective';
UPDATE brands SET domain = 'nexusaminos.com' WHERE slug = 'nexus-aminos';
UPDATE brands SET domain = 'bacwaterstore.com' WHERE slug = 'bac-water-store';