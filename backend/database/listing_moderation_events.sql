-- Append-only moderation activity (distinct from current listings.status).
-- Used for monthly Resubmissions / Updates history that must survive later
-- approve/decline of the live tip.

CREATE TABLE IF NOT EXISTS listing_moderation_events (
  id                     BIGSERIAL PRIMARY KEY,
  event_type             VARCHAR(32) NOT NULL,
  listing_id             INTEGER NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  previous_listing_id    INTEGER NULL REFERENCES listings(id) ON DELETE SET NULL,
  root_listing_id        INTEGER NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  user_id                INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  previous_status        VARCHAR(20),
  new_status             VARCHAR(20) NOT NULL,
  price                  DECIMAL(10,2),
  decline_reason         TEXT,
  moderated_by_admin_id  INTEGER NULL REFERENCES admins(id) ON DELETE SET NULL,
  occurred_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata               JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT listing_moderation_events_type_check
    CHECK (event_type IN (
      'created',
      'pending',
      'declined',
      'resubmitted',
      'approved',
      'updated'
    ))
);

CREATE INDEX IF NOT EXISTS idx_listing_moderation_events_occurred
  ON listing_moderation_events (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_listing_moderation_events_type_occurred
  ON listing_moderation_events (event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_listing_moderation_events_listing
  ON listing_moderation_events (listing_id);

CREATE INDEX IF NOT EXISTS idx_listing_moderation_events_root
  ON listing_moderation_events (root_listing_id);

-- Reconstruct resubmission events from existing declined → new-revision rows.
-- Do not invent update events: approved → updated was previously in-place.
INSERT INTO listing_moderation_events (
  event_type,
  listing_id,
  previous_listing_id,
  root_listing_id,
  user_id,
  previous_status,
  new_status,
  price,
  decline_reason,
  occurred_at
)
SELECT
  'resubmitted',
  child.id,
  child.previous_listing_id,
  child.root_listing_id,
  child.user_id,
  'declined',
  'resubmitted',
  child.price,
  parent.decline_reason,
  COALESCE(child.resubmitted_at, child.created_at)
FROM listings child
JOIN listings parent ON parent.id = child.previous_listing_id
WHERE child.previous_listing_id IS NOT NULL
  AND parent.status = 'declined'
  AND NOT EXISTS (
    SELECT 1
    FROM listing_moderation_events existing
    WHERE existing.event_type = 'resubmitted'
      AND existing.listing_id = child.id
  );
