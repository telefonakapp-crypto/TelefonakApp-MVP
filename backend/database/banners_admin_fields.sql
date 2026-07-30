-- Optional display fields for Admin Web banner management.
-- Mobile public GET does not select these; additive and backward compatible.
ALTER TABLE banners
  ADD COLUMN IF NOT EXISTS subtitle TEXT,
  ADD COLUMN IF NOT EXISTS cta_text VARCHAR(120);
