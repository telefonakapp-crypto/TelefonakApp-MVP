-- Ownership registry for marketplace listing image uploads.
-- A listing may only reference images uploaded by the same user (or images
-- already attached to that user's listings / the listing being edited).

CREATE TABLE IF NOT EXISTS listing_image_uploads (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT listing_image_uploads_filename_unique UNIQUE (filename)
);

CREATE INDEX IF NOT EXISTS idx_listing_image_uploads_user
  ON listing_image_uploads (user_id);

-- Backfill ownership from existing listing_images so sellers can still edit
-- listings that used pre-Phase-2 uploads. Filename must match listing-*-*.ext.
INSERT INTO listing_image_uploads (user_id, filename)
SELECT DISTINCT ON (fn.filename)
  l.user_id,
  fn.filename
FROM listing_images li
JOIN listings l ON l.id = li.listing_id
CROSS JOIN LATERAL (
  SELECT regexp_replace(li.image_url, '^.*/', '') AS filename
) fn
WHERE fn.filename ~ '^listing-[A-Za-z0-9._-]+\.(jpe?g|png|webp)$'
ON CONFLICT (filename) DO NOTHING;
