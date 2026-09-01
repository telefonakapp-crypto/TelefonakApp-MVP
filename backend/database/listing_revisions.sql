-- Listing revision architecture: immutable moderation snapshots.
--
-- Each logical listing is a chain of rows sharing root_listing_id.
-- previous_listing_id points at the immediate parent revision.
-- revision_number is 1 for the original, then 2, 3, ...
-- Declined rows are never mutated to resubmitted/approved; a new row is inserted.

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS previous_listing_id INTEGER NULL,
  ADD COLUMN IF NOT EXISTS revision_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS root_listing_id INTEGER NULL;

-- Existing rows become single-revision roots (no reconstructable history).
UPDATE listings
SET revision_number = 1,
    previous_listing_id = NULL,
    root_listing_id = id
WHERE root_listing_id IS NULL;

ALTER TABLE listings
  ALTER COLUMN root_listing_id SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE listings
    ADD CONSTRAINT listings_previous_listing_id_fkey
    FOREIGN KEY (previous_listing_id) REFERENCES listings(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE listings
    ADD CONSTRAINT listings_root_listing_id_fkey
    FOREIGN KEY (root_listing_id) REFERENCES listings(id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_listings_previous_listing_id
  ON listings (previous_listing_id);

CREATE INDEX IF NOT EXISTS idx_listings_root_listing_id
  ON listings (root_listing_id);

CREATE INDEX IF NOT EXISTS idx_listings_root_revision
  ON listings (root_listing_id, revision_number);

-- On create, default root_listing_id to the new row's own id when omitted.
-- SERIAL assigns NEW.id before BEFORE INSERT, so self-rooting is safe here.
CREATE OR REPLACE FUNCTION listings_default_revision_fields()
RETURNS trigger AS $$
BEGIN
  IF NEW.revision_number IS NULL THEN
    NEW.revision_number := 1;
  END IF;

  IF NEW.root_listing_id IS NULL THEN
    IF NEW.id IS NULL THEN
      NEW.id := nextval(pg_get_serial_sequence('listings', 'id'));
    END IF;
    NEW.root_listing_id := NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_listings_default_revision_fields ON listings;
CREATE TRIGGER trg_listings_default_revision_fields
  BEFORE INSERT ON listings
  FOR EACH ROW
  EXECUTE PROCEDURE listings_default_revision_fields();
