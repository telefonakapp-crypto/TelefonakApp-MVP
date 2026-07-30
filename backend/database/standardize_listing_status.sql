-- Migration: Standardize listing status workflow
-- Valid statuses: pending, approved, declined, sold, hidden, deleted
-- 'hidden' is set by the seller (approved ⇄ hidden) and keeps the listing out
-- of every public read while leaving the row untouched.
-- Removes legacy status value: active

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_status_check;

UPDATE listings SET status = 'approved' WHERE status = 'active';

UPDATE listings SET status = 'pending'
WHERE status IS NULL
   OR status NOT IN ('pending', 'approved', 'declined', 'sold', 'hidden', 'deleted');

ALTER TABLE listings ALTER COLUMN status SET DEFAULT 'pending';

DO $$ BEGIN
    ALTER TABLE listings ADD CONSTRAINT listings_status_check
        CHECK (status IN ('pending', 'approved', 'declined', 'sold', 'hidden', 'deleted'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
