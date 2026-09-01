-- Updated moderation status: seller edited a previously approved listing.
-- Distinct from resubmitted (which is declined → seller re-submits).
-- Existing rows are not rewritten; approved stays approved.

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_status_check;

DO $$ BEGIN
    ALTER TABLE listings ADD CONSTRAINT listings_status_check
        CHECK (status IN (
          'pending',
          'resubmitted',
          'updated',
          'approved',
          'declined',
          'sold',
          'hidden',
          'deleted'
        ));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_listings_updated_queue
  ON listings (updated_at DESC NULLS LAST)
  WHERE status = 'updated';
