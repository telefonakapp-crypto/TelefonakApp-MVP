-- ============================================================
-- Notification center
--
-- The table itself is created in admin_schema.sql. This script brings
-- existing databases up to the current shape and owns the indexes.
-- ============================================================

-- Earlier versions called the column listing_id.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'notifications' AND column_name = 'listing_id')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'notifications' AND column_name = 'related_listing_id')
    THEN
        ALTER TABLE notifications RENAME COLUMN listing_id TO related_listing_id;
    END IF;
END $$;

ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS related_listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL;

-- Read state and timestamps are never meaningfully unknown.
UPDATE notifications SET is_read = FALSE WHERE is_read IS NULL;
UPDATE notifications SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;

ALTER TABLE notifications ALTER COLUMN is_read SET DEFAULT FALSE;
ALTER TABLE notifications ALTER COLUMN is_read SET NOT NULL;
ALTER TABLE notifications ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE notifications ALTER COLUMN created_at SET NOT NULL;

-- Replace the original indexes: a bare user_id index is redundant with the
-- composite below, and (is_read, created_at) never got used because every
-- query filters by user first.
DROP INDEX IF EXISTS idx_notifications_user;
DROP INDEX IF EXISTS idx_notifications_read;

-- Serves the notification list: WHERE user_id = $1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications (user_id, created_at DESC);

-- Serves the badge count: WHERE user_id = $1 AND is_read = FALSE
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications (user_id)
    WHERE is_read = FALSE;
