-- Allow the shared notifications table to target Admin Web staff (admins)
-- without a second notification store. Customer rows keep user_id;
-- staff rows use admin_id. Exactly one recipient must be set.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS admin_id INTEGER REFERENCES admins(id) ON DELETE CASCADE;

ALTER TABLE notifications
  ALTER COLUMN user_id DROP NOT NULL;

-- Backfill safety: nothing should have both or neither after this migration.
-- Existing customer rows already have user_id set.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_recipient_check'
  ) THEN
    ALTER TABLE notifications
      ADD CONSTRAINT notifications_recipient_check
      CHECK (
        (user_id IS NOT NULL AND admin_id IS NULL)
        OR (user_id IS NULL AND admin_id IS NOT NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_admin_created
  ON notifications (admin_id, created_at DESC)
  WHERE admin_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_admin_unread
  ON notifications (admin_id)
  WHERE admin_id IS NOT NULL AND is_read = FALSE;
