-- Resubmitted moderation status: seller corrected a declined listing.
-- Same listing row; resubmitted_at drives queue priority without changing created_at.

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_status_check;

DO $$ BEGIN
    ALTER TABLE listings ADD CONSTRAINT listings_status_check
        CHECK (status IN (
          'pending',
          'resubmitted',
          'approved',
          'declined',
          'sold',
          'hidden',
          'deleted'
        ));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS resubmitted_at TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS idx_listings_resubmitted_at
  ON listings (resubmitted_at DESC NULLS LAST)
  WHERE status = 'resubmitted';
