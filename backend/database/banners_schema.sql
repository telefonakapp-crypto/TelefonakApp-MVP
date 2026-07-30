-- ============================================================
-- Marketing banners (Home carousel)
-- Scalable for future Admin Panel management.
-- ============================================================

CREATE TABLE IF NOT EXISTS banners (
    id            SERIAL PRIMARY KEY,
    title         VARCHAR(255) NOT NULL,
    image_url     TEXT         NOT NULL,
    action_type   VARCHAR(32)  NOT NULL DEFAULT 'none'
                  CHECK (action_type IN ('none', 'url', 'screen', 'listing')),
    action_value  TEXT,
    display_order INTEGER      NOT NULL DEFAULT 0,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    starts_at     TIMESTAMP,
    ends_at       TIMESTAMP,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT banners_schedule_check
      CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at <= ends_at)
);

CREATE INDEX IF NOT EXISTS idx_banners_active_order
  ON banners (is_active, display_order);

CREATE INDEX IF NOT EXISTS idx_banners_schedule
  ON banners (is_active, starts_at, ends_at);

CREATE OR REPLACE FUNCTION update_banners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_banners_timestamp ON banners;
CREATE TRIGGER update_banners_timestamp
    BEFORE UPDATE ON banners
    FOR EACH ROW
    EXECUTE FUNCTION update_banners_updated_at();

-- Optional one-time backfill from legacy ads table (keeps Home populated).
-- Only runs when banners is empty and ads exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ads'
  ) AND NOT EXISTS (SELECT 1 FROM banners LIMIT 1) THEN
    INSERT INTO banners (
      title, image_url, action_type, action_value,
      display_order, is_active, starts_at, ends_at, created_at, updated_at
    )
    SELECT
      a.title,
      a.image_url,
      CASE
        WHEN a.link_url IS NOT NULL AND BTRIM(a.link_url) <> '' THEN 'url'
        ELSE 'none'
      END,
      NULLIF(BTRIM(a.link_url), ''),
      COALESCE(a.display_order, 0),
      COALESCE(a.is_active, TRUE),
      NULL,
      a.expires_at,
      COALESCE(a.created_at, CURRENT_TIMESTAMP),
      COALESCE(a.updated_at, CURRENT_TIMESTAMP)
    FROM ads a;
  END IF;
END $$;
