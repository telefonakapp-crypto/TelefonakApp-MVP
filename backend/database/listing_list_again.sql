-- ============================================================
-- List Again: distinguish automatic expiration from End Bid,
-- and record the source listing of a re-list.
--
-- Additive only. Does NOT mutate historical listing/auction/bid data
-- beyond filling completion_source on already-terminal auctions.
-- ============================================================

BEGIN;

ALTER TABLE listing_auctions
  ADD COLUMN IF NOT EXISTS completion_source VARCHAR(20) NULL;

-- Conservative backfill: cancelled is explicit; completed auctions that
-- already exist cannot be distinguished, so they are treated as seller-sold
-- (List Again stays off until a future automatic expiration writes 'expired').
UPDATE listing_auctions
SET completion_source = 'cancelled'
WHERE auction_status = 'cancelled'
  AND completion_source IS NULL;

UPDATE listing_auctions
SET completion_source = 'sold'
WHERE auction_status = 'completed'
  AND completion_source IS NULL;

DO $$ BEGIN
  ALTER TABLE listing_auctions
    ADD CONSTRAINT listing_auctions_completion_source_check
    CHECK (
      (
        auction_status IN ('pending_start', 'live', 'ended')
        AND completion_source IS NULL
      )
      OR (
        auction_status = 'completed'
        AND completion_source IN ('expired', 'sold')
      )
      OR (
        auction_status = 'cancelled'
        AND completion_source = 'cancelled'
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS listed_from_listing_id INTEGER NULL;

DO $$ BEGIN
  ALTER TABLE listings
    ADD CONSTRAINT listings_listed_from_listing_id_fkey
    FOREIGN KEY (listed_from_listing_id) REFERENCES listings(id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS listings_listed_from_listing_id_key
  ON listings (listed_from_listing_id)
  WHERE listed_from_listing_id IS NOT NULL;

COMMIT;
