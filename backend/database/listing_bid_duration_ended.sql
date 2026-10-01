-- Bid duration ended: automatic auction completion removes the listing from
-- the public marketplace while keeping it as seller history.
-- Does not rename or remove existing listing statuses.

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
          'deleted',
          'bid_duration_ended'
        ));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
