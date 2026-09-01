-- ============================================================
-- Seller "seen" state for received offers
--
-- Unread for the Offers tab badge means:
--   seller_id = current user
--   status = 'pending'
--   seller_seen_at IS NULL
--
-- New / updated pending offers leave seller_seen_at NULL.
-- Viewing a received offer (or accepting/rejecting it) sets the timestamp.
-- ============================================================

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS seller_seen_at TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS idx_offers_seller_unread
  ON offers (seller_id)
  WHERE status = 'pending' AND seller_seen_at IS NULL;
