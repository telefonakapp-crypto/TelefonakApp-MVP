-- ============================================================
-- Phase 2A — Smartwatch listing attribute foundation
--
-- Schema only. Does NOT:
--   - attach sizes/connectivity to models
--   - deactivate placeholder watch storage/colors
--   - change phone or smartwatch catalog rows
--   - change listing creation APIs
--
-- Safe to apply multiple times (idempotent).
-- Must run AFTER catalog_schema.sql (listings, models exist).
-- ============================================================

BEGIN;

-- ── 1. Case size lookup ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS watch_case_sizes (
    id          SERIAL PRIMARY KEY,
    size_mm     NUMERIC(4,1) NOT NULL,
    label       VARCHAR(20)  NOT NULL,
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (size_mm),
    UNIQUE (label)
);

CREATE INDEX IF NOT EXISTS idx_watch_case_sizes_sort
    ON watch_case_sizes (sort_order, size_mm);

-- Per-model supported case sizes (junction)
CREATE TABLE IF NOT EXISTS model_watch_case_sizes (
    id            SERIAL PRIMARY KEY,
    model_id      INTEGER  NOT NULL REFERENCES models(id)           ON DELETE CASCADE,
    case_size_id  INTEGER  NOT NULL REFERENCES watch_case_sizes(id) ON DELETE RESTRICT,
    is_active     BOOLEAN  NOT NULL DEFAULT TRUE,
    sort_order    INTEGER  NOT NULL DEFAULT 0,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (model_id, case_size_id)
);

CREATE INDEX IF NOT EXISTS idx_model_watch_case_sizes_model
    ON model_watch_case_sizes (model_id);
CREATE INDEX IF NOT EXISTS idx_model_watch_case_sizes_active
    ON model_watch_case_sizes (model_id, is_active);

-- ── 2. Connectivity lookup ───────────────────────────────────
CREATE TABLE IF NOT EXISTS watch_connectivities (
    id          SERIAL PRIMARY KEY,
    slug        VARCHAR(50)  NOT NULL,
    name_en     VARCHAR(80)  NOT NULL,
    name_ar     VARCHAR(80),
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_watch_connectivities_active_sort
    ON watch_connectivities (is_active, sort_order);

-- Per-model supported connectivity options (junction)
CREATE TABLE IF NOT EXISTS model_watch_connectivities (
    id                SERIAL PRIMARY KEY,
    model_id          INTEGER  NOT NULL REFERENCES models(id)                ON DELETE CASCADE,
    connectivity_id   INTEGER  NOT NULL REFERENCES watch_connectivities(id)  ON DELETE RESTRICT,
    is_active         BOOLEAN  NOT NULL DEFAULT TRUE,
    sort_order        INTEGER  NOT NULL DEFAULT 0,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (model_id, connectivity_id)
);

CREATE INDEX IF NOT EXISTS idx_model_watch_connectivities_model
    ON model_watch_connectivities (model_id);
CREATE INDEX IF NOT EXISTS idx_model_watch_connectivities_active
    ON model_watch_connectivities (model_id, is_active);

-- Shared connectivity vocabulary only. Not attached to models.
INSERT INTO watch_connectivities (slug, name_en, name_ar, sort_order, is_active) VALUES
    ('gps',            'GPS',              'جي بي إس',           0, TRUE),
    ('gps_cellular',   'GPS + Cellular',   'جي بي إس + خلوي',    1, TRUE),
    ('bluetooth',      'Bluetooth',        'بلوتوث',             2, TRUE),
    ('bluetooth_lte',  'Bluetooth + LTE',  'بلوتوث + LTE',       3, TRUE),
    ('lte',            'LTE',              'LTE',                4, TRUE)
ON CONFLICT (slug) DO UPDATE
    SET name_en    = EXCLUDED.name_en,
        name_ar    = EXCLUDED.name_ar,
        sort_order = EXCLUDED.sort_order,
        is_active  = EXCLUDED.is_active;

-- ── 3. Compound unique keys for listing ownership FKs ────────
DO $$ BEGIN
    ALTER TABLE model_watch_case_sizes
        ADD CONSTRAINT uq_model_watch_case_sizes_id_model UNIQUE (id, model_id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE model_watch_connectivities
        ADD CONSTRAINT uq_model_watch_connectivities_id_model UNIQUE (id, model_id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- ── 4. Listing columns ───────────────────────────────────────
ALTER TABLE listings
    ADD COLUMN IF NOT EXISTS model_watch_case_size_id INTEGER
        REFERENCES model_watch_case_sizes(id) ON DELETE RESTRICT;

ALTER TABLE listings
    ADD COLUMN IF NOT EXISTS model_watch_connectivity_id INTEGER
        REFERENCES model_watch_connectivities(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_listings_watch_case_size
    ON listings (model_watch_case_size_id);
CREATE INDEX IF NOT EXISTS idx_listings_watch_connectivity
    ON listings (model_watch_connectivity_id);

-- Compound FKs: a listing cannot reference a size/connectivity row
-- that belongs to a different model. NULL listing columns are allowed
-- (phone listings, and watches until Phase 2C seed).
DO $$ BEGIN
    ALTER TABLE listings
        ADD CONSTRAINT fk_listings_watch_case_size_model
        FOREIGN KEY (model_watch_case_size_id, model_id)
        REFERENCES model_watch_case_sizes(id, model_id)
        ON DELETE RESTRICT
        DEFERRABLE INITIALLY DEFERRED;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE listings
        ADD CONSTRAINT fk_listings_watch_connectivity_model
        FOREIGN KEY (model_watch_connectivity_id, model_id)
        REFERENCES model_watch_connectivities(id, model_id)
        ON DELETE RESTRICT
        DEFERRABLE INITIALLY DEFERRED;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- ── 5. Legacy storage_id may be NULL for watches with no
--       buyer-facing storage choice. Phone listings keep their values.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'listings'
          AND column_name  = 'storage_id'
          AND is_nullable  = 'NO'
    ) THEN
        ALTER TABLE listings ALTER COLUMN storage_id DROP NOT NULL;
    END IF;
END $$;

COMMIT;
