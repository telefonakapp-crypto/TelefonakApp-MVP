-- Add battery_percentage column to listings table
-- This script adds the battery_percentage field to existing databases

-- Add battery_percentage column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'listings' 
        AND column_name = 'battery_percentage'
    ) THEN
        ALTER TABLE listings 
        ADD COLUMN battery_percentage INTEGER 
        CHECK (battery_percentage >= 70 AND battery_percentage <= 100);
        
        COMMENT ON COLUMN listings.battery_percentage IS 'Battery health percentage, range: 70-100%';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'listings' AND column_name = 'battery_percentage';

