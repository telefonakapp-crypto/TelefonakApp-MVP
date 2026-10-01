-- ============================================================
-- Listing sale_type + auctions + bids
--
-- Additive schema only. Does NOT:
--   - change listings.status or listings_status_check
--   - change listing_source or revision behavior
--   - change offers / favorites / notifications
--   - create workers, schedulers, or application logic
--
-- Safe to apply multiple times (idempotent).
-- Must run AFTER listings, users, and listing_revisions exist.
-- ============================================================

BEGIN;

-- ── 1. listings.sale_type ───────────────────────────────────
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS sale_type VARCHAR(20) NOT NULL DEFAULT 'normal';

UPDATE listings
SET sale_type = 'normal'
WHERE sale_type IS NULL OR sale_type = '';

DO $$ BEGIN
  ALTER TABLE listings
    ADD CONSTRAINT listings_sale_type_check
    CHECK (sale_type IN ('normal', 'bid'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_listings_sale_type_status
  ON listings (sale_type, status);

-- ── 2. listing_auctions (winning_bid_id FK added after bids) ─
CREATE TABLE IF NOT EXISTS listing_auctions (
    id                       SERIAL PRIMARY KEY,
    listing_id               INTEGER      NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
    starting_price           DECIMAL(10,2) NOT NULL,
    duration_hours           INTEGER      NOT NULL,
    starts_at                TIMESTAMP    NULL,
    original_ends_at         TIMESTAMP    NULL,
    ends_at                  TIMESTAMP    NULL,
    auction_status           VARCHAR(20)  NOT NULL DEFAULT 'pending_start',
    extension_used           BOOLEAN      NOT NULL DEFAULT FALSE,
    winning_bid_id           INTEGER      NULL,
    extension_notice_sent_at TIMESTAMP    NULL,
    created_at               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT listing_auctions_listing_id_key UNIQUE (listing_id),
    CONSTRAINT listing_auctions_starting_price_check
      CHECK (starting_price > 0),
    CONSTRAINT listing_auctions_duration_hours_check
      CHECK (duration_hours IN (
        24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144, 156, 168
      )),
    CONSTRAINT listing_auctions_status_check
      CHECK (auction_status IN (
        'pending_start', 'live', 'ended', 'cancelled', 'completed'
      )),
    CONSTRAINT listing_auctions_schedule_check
      CHECK (
        (
          auction_status = 'pending_start'
          AND starts_at IS NULL
          AND original_ends_at IS NULL
          AND ends_at IS NULL
          AND winning_bid_id IS NULL
          AND extension_used = FALSE
        )
        OR (
          auction_status IN ('live', 'ended', 'cancelled', 'completed')
          AND starts_at IS NOT NULL
          AND original_ends_at IS NOT NULL
          AND ends_at IS NOT NULL
          AND ends_at >= original_ends_at
          AND (ends_at - starts_at) <= INTERVAL '168 hours'
        )
      ),
    CONSTRAINT listing_auctions_winner_status_check
      CHECK (
        winning_bid_id IS NULL
        OR auction_status IN ('ended', 'completed')
      ),
    CONSTRAINT listing_auctions_extension_check
      CHECK (
        extension_used = TRUE
        OR ends_at IS NOT DISTINCT FROM original_ends_at
      )
);

CREATE INDEX IF NOT EXISTS idx_listing_auctions_live_ends
  ON listing_auctions (ends_at)
  WHERE auction_status = 'live';

CREATE OR REPLACE FUNCTION update_listing_auctions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_listing_auctions_timestamp ON listing_auctions;
CREATE TRIGGER update_listing_auctions_timestamp
    BEFORE UPDATE ON listing_auctions
    FOR EACH ROW
    EXECUTE FUNCTION update_listing_auctions_updated_at();

-- ── 3. bids (append-only history) ───────────────────────────
CREATE TABLE IF NOT EXISTS bids (
    id         SERIAL PRIMARY KEY,
    listing_id INTEGER       NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
    auction_id INTEGER       NOT NULL REFERENCES listing_auctions(id) ON DELETE RESTRICT,
    bidder_id  INTEGER       NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    seller_id  INTEGER       NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount     DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT bids_no_self_bid CHECK (bidder_id <> seller_id)
);

CREATE INDEX IF NOT EXISTS idx_bids_auction_amount
  ON bids (auction_id, amount DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bids_listing_created
  ON bids (listing_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bids_bidder_created
  ON bids (bidder_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bids_seller_created
  ON bids (seller_id, created_at DESC);

-- ── 4. winning_bid_id FK (bid row must already exist) ───────
DO $$ BEGIN
  ALTER TABLE listing_auctions
    ADD CONSTRAINT listing_auctions_winning_bid_id_fkey
    FOREIGN KEY (winning_bid_id) REFERENCES bids(id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
