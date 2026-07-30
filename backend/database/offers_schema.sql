-- ============================================================
-- Offers / bids
--
-- A buyer has at most one pending offer per listing (enforced by the
-- partial unique index below). Resolved offers are kept as history, so a
-- buyer whose offer was rejected can make a new one later.
-- ============================================================

CREATE TABLE IF NOT EXISTS offers (
    id            SERIAL PRIMARY KEY,
    listing_id    INTEGER       NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    buyer_id      INTEGER       NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    seller_id     INTEGER       NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    offered_price DECIMAL(10,2) NOT NULL CHECK (offered_price > 0),
    status        VARCHAR(20)   NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT offers_no_self_offer CHECK (buyer_id <> seller_id)
);

-- "One active offer per buyer per listing", and the conflict target the
-- create endpoint upserts on.
CREATE UNIQUE INDEX IF NOT EXISTS offers_one_pending_per_buyer
    ON offers (listing_id, buyer_id)
    WHERE status = 'pending';

-- Serves GET /api/offers/received
CREATE INDEX IF NOT EXISTS idx_offers_seller_created
    ON offers (seller_id, created_at DESC);

-- Serves GET /api/offers/sent
CREATE INDEX IF NOT EXISTS idx_offers_buyer_created
    ON offers (buyer_id, created_at DESC);

-- The unique index above only covers pending rows, so resolved offers still
-- need this for per-listing lookups and the FK cascade.
CREATE INDEX IF NOT EXISTS idx_offers_listing
    ON offers (listing_id);
