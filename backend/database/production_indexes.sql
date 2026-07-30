-- Production hardening indexes for Admin Web / marketplace hot paths.
-- Idempotent.

CREATE INDEX IF NOT EXISTS idx_listings_user_status
  ON listings (user_id, status);

CREATE INDEX IF NOT EXISTS idx_users_created_at
  ON users (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listing_images_listing_order
  ON listing_images (listing_id, display_order);

CREATE INDEX IF NOT EXISTS idx_offers_status
  ON offers (status);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created
  ON audit_logs (action, created_at DESC);
