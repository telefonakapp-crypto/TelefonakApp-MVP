-- ============================================================
-- Marketplace search performance (partial ILIKE on brand/model)
-- pg_trgm helps brand/model name searches; unaccent enables accent-insensitive match.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_brands_name_trgm ON brands USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_models_name_trgm  ON models USING gin (name gin_trgm_ops);
