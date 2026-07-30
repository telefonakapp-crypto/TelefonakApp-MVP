-- ============================================================
-- Listing view counter
--
-- listings.views is the denormalized counter shown to the seller.
-- listing_views holds one row per (listing, viewer) and is only used
-- to enforce the cooldown, so the table stays bounded by the number
-- of distinct viewers instead of growing with every page open.
-- ============================================================

ALTER TABLE listings ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS listing_views (
    id         SERIAL PRIMARY KEY,
    listing_id INTEGER   NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    user_id    INTEGER   REFERENCES users(id) ON DELETE CASCADE,
    ip_address VARCHAR(45),
    viewed_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT listing_views_viewer_present CHECK (user_id IS NOT NULL OR ip_address IS NOT NULL)
);

-- Partial unique indexes give the cooldown a single-statement upsert target:
-- authenticated viewers are keyed by user, guests by IP.
CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_views_user
    ON listing_views (listing_id, user_id)
    WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_views_ip
    ON listing_views (listing_id, ip_address)
    WHERE user_id IS NULL;
