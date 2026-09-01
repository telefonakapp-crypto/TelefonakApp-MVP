-- Custom ("Other") listings: persist devices that are not in the manufacturer catalog.
-- Does not insert catalog brands/models. Existing catalog listing rows are unchanged.

ALTER TABLE listings
  ALTER COLUMN model_id DROP NOT NULL;

ALTER TABLE listings
  ALTER COLUMN storage_id DROP NOT NULL;

ALTER TABLE listings
  ALTER COLUMN color_id DROP NOT NULL;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS category_id INTEGER NULL REFERENCES categories(id) ON DELETE RESTRICT;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS listing_source VARCHAR(20) NOT NULL DEFAULT 'catalog';

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS custom_brand_name VARCHAR(80) NULL;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS custom_model_name VARCHAR(120) NULL;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS custom_storage VARCHAR(40) NULL;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS custom_color_name VARCHAR(80) NULL;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS custom_sim_configuration VARCHAR(80) NULL;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS custom_case_size VARCHAR(40) NULL;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS custom_connectivity VARCHAR(80) NULL;

UPDATE listings l
SET category_id = m.category_id
FROM models m
WHERE l.model_id = m.id
  AND l.category_id IS NULL;

UPDATE listings
SET listing_source = 'catalog'
WHERE listing_source IS NULL OR listing_source = '';

DO $$
BEGIN
  ALTER TABLE listings
    ADD CONSTRAINT listings_listing_source_check
    CHECK (listing_source IN ('catalog', 'custom'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE listings
    ADD CONSTRAINT listings_catalog_or_custom_check
    CHECK (
      (
        listing_source = 'catalog'
        AND model_id IS NOT NULL
        AND custom_brand_name IS NULL
        AND custom_model_name IS NULL
        AND custom_storage IS NULL
        AND custom_color_name IS NULL
        AND custom_sim_configuration IS NULL
        AND custom_case_size IS NULL
        AND custom_connectivity IS NULL
      )
      OR (
        listing_source = 'custom'
        AND model_id IS NULL
        AND category_id IS NOT NULL
        AND custom_brand_name IS NOT NULL
        AND custom_model_name IS NOT NULL
        AND model_storage_id IS NULL
        AND model_color_id IS NULL
        AND sim_configuration_id IS NULL
        AND model_watch_case_size_id IS NULL
        AND model_watch_connectivity_id IS NULL
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_listings_listing_source ON listings (listing_source);
CREATE INDEX IF NOT EXISTS idx_listings_category_id ON listings (category_id);
CREATE INDEX IF NOT EXISTS idx_listings_custom_brand_name ON listings (custom_brand_name);
