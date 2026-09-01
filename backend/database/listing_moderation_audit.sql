-- Track who moderated a listing and when (approve / decline).
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS approved_or_rejected_at TIMESTAMP NULL;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS moderated_by_admin_id INTEGER NULL
    REFERENCES admins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_listings_moderated_by_admin
  ON listings (moderated_by_admin_id)
  WHERE moderated_by_admin_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_approved_or_rejected_at
  ON listings (approved_or_rejected_at DESC NULLS LAST);
