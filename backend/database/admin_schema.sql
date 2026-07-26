-- Add admin role to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Update listings status constraint to include new statuses
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

-- Step 3: Update any invalid statuses to 'active' (temporary fix for any rows that might have invalid status)
UPDATE listings SET status = 'active' WHERE status IS NULL OR status NOT IN ('active', 'sold', 'deleted', 'pending', 'approved', 'declined');

-- Step 4: Add the new constraint with all allowed statuses
ALTER TABLE listings ADD CONSTRAINT listings_status_check 
    CHECK (status IN ('pending', 'approved', 'declined', 'active', 'sold', 'deleted'));

-- Step 5: Update existing 'active' listings to 'approved' (for backward compatibility)
-- This happens after the constraint is updated, so 'approved' is now valid
UPDATE listings SET status = 'approved' WHERE status = 'active';

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL, -- 'listing_approved', 'listing_declined', 'listing_edited', etc.
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);

