-- Standardize listing status workflow:
-- pending → approved → sold | deleted
-- pending → declined | deleted
-- approved ⇄ hidden (seller hides/unhides their own listing)
-- Valid statuses only: pending, approved, declined, sold, hidden, deleted
-- Step 1: Drop the existing constraint first (this allows us to update invalid statuses)
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_status_check;

-- Step 2: Add status column if it doesn't exist (should already exist, but just in case)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'listings' AND column_name = 'status') THEN
        ALTER TABLE listings ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
    END IF;
END $$;

-- Step 3: Migrate legacy 'active' status to 'approved'
UPDATE listings SET status = 'approved' WHERE status = 'active';

-- Step 4: Normalize any remaining invalid/null statuses to 'pending'
UPDATE listings SET status = 'pending'
WHERE status IS NULL
   OR status NOT IN ('pending', 'approved', 'declined', 'sold', 'hidden', 'deleted');

-- Step 5: Ensure column default is 'pending' for new listings
ALTER TABLE listings ALTER COLUMN status SET DEFAULT 'pending';

-- Step 6: Enforce the final allowed status set (no 'active')
DO $$ BEGIN
    ALTER TABLE listings ADD CONSTRAINT listings_status_check
        CHECK (status IN ('pending', 'approved', 'declined', 'sold', 'hidden', 'deleted'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create notifications table
-- Column shape for existing databases and the indexes are owned by notifications_schema.sql
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    related_listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL, -- 'listing_approved', 'listing_rejected', 'listing_sold', 'system', ...
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);

