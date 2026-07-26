-- Migration: Add bilingual support for listings
-- Adds Arabic description fields and marks for auto-translated content

-- Add new columns for bilingual descriptions
ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS description_en TEXT,
ADD COLUMN IF NOT EXISTS description_ar TEXT,
ADD COLUMN IF NOT EXISTS description_ar_is_auto_translated BOOLEAN DEFAULT FALSE;

-- Migrate existing description data to description_en
UPDATE listings 
SET description_en = description 
WHERE description IS NOT NULL AND description_en IS NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_listings_description_en ON listings USING gin(to_tsvector('english', description_en));
CREATE INDEX IF NOT EXISTS idx_listings_description_ar ON listings USING gin(to_tsvector('english', description_ar));

-- Note: The old 'description' column is kept for backward compatibility
-- It can be removed in a future migration after all data is migrated
-- ALTER TABLE listings DROP COLUMN description; -- Run this in future if needed

