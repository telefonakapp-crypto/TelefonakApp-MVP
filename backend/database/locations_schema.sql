-- ============================================================
-- Jordan locations (cities + areas) for marketplace filtering
-- ============================================================

CREATE TABLE IF NOT EXISTS cities (
    id          SERIAL PRIMARY KEY,
    slug        VARCHAR(50)  UNIQUE NOT NULL,
    name_en     VARCHAR(100) NOT NULL,
    name_ar     VARCHAR(100),
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS areas (
    id          SERIAL PRIMARY KEY,
    city_id     INTEGER      NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    slug        VARCHAR(80)  NOT NULL,
    name_en     VARCHAR(100) NOT NULL,
    name_ar     VARCHAR(100),
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (city_id, slug)
);

ALTER TABLE listings
    ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL;

ALTER TABLE listings
    ADD COLUMN IF NOT EXISTS area_id INTEGER REFERENCES areas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cities_active_sort ON cities(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_areas_city         ON areas(city_id);
CREATE INDEX IF NOT EXISTS idx_areas_active_sort  ON areas(city_id, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_listings_city      ON listings(city_id);
CREATE INDEX IF NOT EXISTS idx_listings_area      ON listings(area_id);
CREATE INDEX IF NOT EXISTS idx_listings_condition ON listings(condition_id);
CREATE INDEX IF NOT EXISTS idx_listings_battery   ON listings(battery_percentage);
CREATE INDEX IF NOT EXISTS idx_listings_status_created ON listings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_status_price   ON listings(status, price);
CREATE INDEX IF NOT EXISTS idx_models_brand_category   ON models(brand_id, category_id);
