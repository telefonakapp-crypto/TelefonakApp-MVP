-- Key/value marketplace settings for Admin Web (extensible without schema changes).
CREATE TABLE IF NOT EXISTS settings (
  key         VARCHAR(100) PRIMARY KEY,
  value       TEXT         NOT NULL,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by  INTEGER      REFERENCES admins(id) ON DELETE SET NULL
);

CREATE OR REPLACE FUNCTION update_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_settings_timestamp ON settings;
CREATE TRIGGER update_settings_timestamp
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_settings_updated_at();

-- Seed defaults only when missing (idempotent).
INSERT INTO settings (key, value) VALUES
  ('marketplace_name', 'Telefonak'),
  ('marketplace_description', 'Jordan''s trusted marketplace for buying and selling used phones.'),
  ('contact_email', 'support@telefonak.com'),
  ('contact_phone', '+962700000000'),
  ('auto_approve_listings', 'false'),
  ('max_images_per_listing', '10'),
  ('max_listing_price', '5000'),
  ('min_listing_price', '1'),
  ('allow_offers', 'true'),
  ('max_active_banners', '5'),
  ('maintenance_mode', 'false')
ON CONFLICT (key) DO NOTHING;
