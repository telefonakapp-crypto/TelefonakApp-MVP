-- Update Conditions Table
-- This script updates the conditions table to the new 4-option format
-- Run this script to migrate existing database

-- First, update the VARCHAR length to accommodate longer condition names (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conditions') THEN
        ALTER TABLE conditions ALTER COLUMN name TYPE VARCHAR(30);
    END IF;
END $$;

-- Insert the new conditions first (if they don't already exist)
INSERT INTO conditions (name) VALUES 
    ('New'),
    ('Used - Like New'),
    ('Used - Good'),
    ('Used - Fair')
ON CONFLICT (name) DO NOTHING;

-- Update existing listings that reference old conditions
-- Map old conditions to new ones before deleting old records
DO $$
DECLARE
    like_new_id INTEGER;
    good_id INTEGER;
    fair_id INTEGER;
    used_good_id INTEGER;
    used_like_new_id INTEGER;
    used_fair_id INTEGER;
BEGIN
    -- Get IDs of old and new conditions
    SELECT id INTO used_like_new_id FROM conditions WHERE name = 'Used - Like New';
    SELECT id INTO used_good_id FROM conditions WHERE name = 'Used - Good';
    SELECT id INTO used_fair_id FROM conditions WHERE name = 'Used - Fair';
    
    -- Update listings from old conditions to new ones
    IF EXISTS (SELECT 1 FROM conditions WHERE name = 'Like New') THEN
        SELECT id INTO like_new_id FROM conditions WHERE name = 'Like New';
        IF used_like_new_id IS NOT NULL AND like_new_id IS NOT NULL THEN
            UPDATE listings SET condition_id = used_like_new_id WHERE condition_id = like_new_id;
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM conditions WHERE name = 'Good') THEN
        SELECT id INTO good_id FROM conditions WHERE name = 'Good';
        IF used_good_id IS NOT NULL AND good_id IS NOT NULL THEN
            UPDATE listings SET condition_id = used_good_id WHERE condition_id = good_id;
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM conditions WHERE name = 'Fair') THEN
        SELECT id INTO fair_id FROM conditions WHERE name = 'Fair';
        IF used_fair_id IS NOT NULL AND fair_id IS NOT NULL THEN
            UPDATE listings SET condition_id = used_fair_id WHERE condition_id = fair_id;
        END IF;
    END IF;
    
    -- Map 'Used' to 'Used - Good' as default
    IF EXISTS (SELECT 1 FROM conditions WHERE name = 'Used') THEN
        SELECT id INTO good_id FROM conditions WHERE name = 'Used';
        IF used_good_id IS NOT NULL AND good_id IS NOT NULL THEN
            UPDATE listings SET condition_id = used_good_id WHERE condition_id = good_id;
        END IF;
    END IF;
END $$;

-- Now delete the old condition records (after all listings have been updated)
DELETE FROM conditions WHERE name IN ('Like New', 'Good', 'Fair', 'Used');

-- Verify the update
SELECT id, name FROM conditions ORDER BY id;

