-- Account deactivation metadata (self-serve "Delete Account" + admin disable).
-- The user row is retained; marketplace activity is cleared separately in application code.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deactivation_reason TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_users_deactivated_at
  ON users (deactivated_at)
  WHERE deactivated_at IS NOT NULL;
