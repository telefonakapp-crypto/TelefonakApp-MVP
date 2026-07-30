-- ============================================================
-- Telefonak Device Catalog Schema
-- Adds: categories, storage_capacities, model_storages,
--       model_colors, spec_definitions, model_spec_values
-- Alters: models (add category_id)
--         listings (add model_storage_id, model_color_id)
-- ============================================================

-- Device categories (Phones, Tablets, Smartwatches, Laptops, Accessories)
CREATE TABLE IF NOT EXISTS categories (
    id          SERIAL PRIMARY KEY,
    slug        VARCHAR(50)  UNIQUE NOT NULL,
    name_en     VARCHAR(100) NOT NULL,
    name_ar     VARCHAR(100),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Link each model to its category
ALTER TABLE models
    ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT;

-- Future-proof storage capacities (covers both storage GB and RAM GB)
CREATE TABLE IF NOT EXISTS storage_capacities (
    id          SERIAL PRIMARY KEY,
    capacity_gb INTEGER      UNIQUE NOT NULL,
    label       VARCHAR(20),
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Per-model supported storage capacities (junction)
CREATE TABLE IF NOT EXISTS model_storages (
    id                  SERIAL PRIMARY KEY,
    model_id            INTEGER  NOT NULL REFERENCES models(id)             ON DELETE CASCADE,
    storage_capacity_id INTEGER  NOT NULL REFERENCES storage_capacities(id) ON DELETE RESTRICT,
    is_active           BOOLEAN  NOT NULL DEFAULT TRUE,
    sort_order          INTEGER  NOT NULL DEFAULT 0,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (model_id, storage_capacity_id)
);

-- Per-model supported colors (junction)
CREATE TABLE IF NOT EXISTS model_colors (
    id            SERIAL PRIMARY KEY,
    model_id      INTEGER       NOT NULL REFERENCES models(id)  ON DELETE CASCADE,
    color_id      INTEGER       NOT NULL REFERENCES colors(id)  ON DELETE RESTRICT,
    -- Marketing color name override (e.g. "Quite Black" instead of "Black")
    official_name VARCHAR(100),
    -- Hex override for this model's specific color swatch (e.g. slightly different shade)
    hex_override  VARCHAR(7),
    is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
    sort_order    INTEGER       NOT NULL DEFAULT 0,
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (model_id, color_id)
);

-- Flexible spec key registry (release_year, screen_size, battery, etc.)
CREATE TABLE IF NOT EXISTS spec_definitions (
    id            SERIAL PRIMARY KEY,
    key           VARCHAR(100)  UNIQUE NOT NULL,
    label_en      VARCHAR(100)  NOT NULL,
    label_ar      VARCHAR(100),
    data_type     VARCHAR(20)   NOT NULL DEFAULT 'string'
                  CHECK (data_type IN ('string','number','boolean','enum')),
    unit          VARCHAR(20),
    -- NULL means spec applies to all categories
    category_id   INTEGER       REFERENCES categories(id) ON DELETE SET NULL,
    is_filterable BOOLEAN       NOT NULL DEFAULT FALSE,
    is_required   BOOLEAN       NOT NULL DEFAULT FALSE,
    sort_order    INTEGER       NOT NULL DEFAULT 0,
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Per-model spec values (EAV for flexible device specs)
CREATE TABLE IF NOT EXISTS model_spec_values (
    id                  SERIAL PRIMARY KEY,
    model_id            INTEGER  NOT NULL REFERENCES models(id)             ON DELETE CASCADE,
    spec_definition_id  INTEGER  NOT NULL REFERENCES spec_definitions(id)   ON DELETE CASCADE,
    value_text          TEXT,
    value_number        DECIMAL(10,3),
    value_boolean       BOOLEAN,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (model_id, spec_definition_id)
);

-- SIM configuration lookup (normalized — not a free-text column on listings)
CREATE TABLE IF NOT EXISTS sim_configurations (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50)  UNIQUE NOT NULL,
    description VARCHAR(255),
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add new catalog FK columns to listings (nullable: backfilled in catalog_migration.sql)
ALTER TABLE listings
    ADD COLUMN IF NOT EXISTS model_storage_id INTEGER REFERENCES model_storages(id) ON DELETE RESTRICT;

ALTER TABLE listings
    ADD COLUMN IF NOT EXISTS model_color_id INTEGER REFERENCES model_colors(id) ON DELETE RESTRICT;

-- Nullable so existing listings remain valid until a seller edits them
ALTER TABLE listings
    ADD COLUMN IF NOT EXISTS sim_configuration_id INTEGER REFERENCES sim_configurations(id) ON DELETE RESTRICT;

-- ── Performance indexes ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_models_category         ON models(category_id);
CREATE INDEX IF NOT EXISTS idx_model_storages_model    ON model_storages(model_id);
CREATE INDEX IF NOT EXISTS idx_model_colors_model      ON model_colors(model_id);
CREATE INDEX IF NOT EXISTS idx_model_spec_values_model ON model_spec_values(model_id);
CREATE INDEX IF NOT EXISTS idx_spec_definitions_cat    ON spec_definitions(category_id);
CREATE INDEX IF NOT EXISTS idx_listings_model_storage  ON listings(model_storage_id);
CREATE INDEX IF NOT EXISTS idx_listings_model_color    ON listings(model_color_id);
CREATE INDEX IF NOT EXISTS idx_listings_sim_config     ON listings(sim_configuration_id);
CREATE INDEX IF NOT EXISTS idx_sim_configurations_active_sort ON sim_configurations(is_active, sort_order);
-- Category slug lookups + active/sort scans for GET /categories
CREATE INDEX IF NOT EXISTS idx_categories_slug         ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_active_sort  ON categories(is_active, sort_order);
-- Combined (model_id, is_active) used by the catalog API queries
CREATE INDEX IF NOT EXISTS idx_model_storages_active   ON model_storages(model_id, is_active);
CREATE INDEX IF NOT EXISTS idx_model_colors_active     ON model_colors(model_id, is_active);
-- Price range filter support on the listings search endpoint
CREATE INDEX IF NOT EXISTS idx_listings_price          ON listings(price);

-- ── Data-integrity: compound FKs ─────────────────────────────
-- These unique constraints let listings carry a two-column FK that
-- prevents a listing from referencing a model_storage or model_color
-- that belongs to a different model than listings.model_id.
-- PostgreSQL does not enforce multi-column FKs when any column is NULL,
-- so rows with NULL model_storage_id / model_color_id are still allowed.

DO $$ BEGIN
    ALTER TABLE model_storages
        ADD CONSTRAINT uq_model_storages_id_model UNIQUE (id, model_id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE model_colors
        ADD CONSTRAINT uq_model_colors_id_model UNIQUE (id, model_id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- (model_storage_id, model_id) must match an (id, model_id) pair in model_storages
DO $$ BEGIN
    ALTER TABLE listings
        ADD CONSTRAINT fk_listings_model_storage_model
        FOREIGN KEY (model_storage_id, model_id)
        REFERENCES model_storages(id, model_id)
        ON DELETE RESTRICT
        DEFERRABLE INITIALLY DEFERRED;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- (model_color_id, model_id) must match an (id, model_id) pair in model_colors
DO $$ BEGIN
    ALTER TABLE listings
        ADD CONSTRAINT fk_listings_model_color_model
        FOREIGN KEY (model_color_id, model_id)
        REFERENCES model_colors(id, model_id)
        ON DELETE RESTRICT
        DEFERRABLE INITIALLY DEFERRED;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;
