-- ============================================================
-- Favorites (saved listings)
-- One favorite per user per listing, enforced at the DB level.
-- Favorites are removed automatically when the user or the
-- listing row is permanently deleted (ON DELETE CASCADE).
-- ============================================================

CREATE TABLE IF NOT EXISTS favorites (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER   NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    listing_id INTEGER   NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT favorites_user_listing_unique UNIQUE (user_id, listing_id)
);

-- The UNIQUE constraint already indexes (user_id, listing_id), which serves
-- "list my favorites" and "is this listing favorited" lookups.
-- This index covers the reverse direction (FK cascade + per-listing lookups).
CREATE INDEX IF NOT EXISTS idx_favorites_listing ON favorites (listing_id);
