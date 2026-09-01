-- ============================================================
-- Telefonak Smartwatch Catalog Seed (Phase 1: Apple, Samsung, Huawei)
--
-- Reuses existing categories → brands → models architecture.
-- Safe to run multiple times (idempotent).
-- Does NOT modify phone models or create a parallel catalog.
--
-- Models are commercially recognizable product names only.
-- Size / GPS / LTE / color / strap / edition SKUs are NOT separate models.
--
-- Must run AFTER catalog_schema.sql + catalog_seed.sql.
-- ============================================================

-- Dropdown order for category-scoped model lists.
-- Phone rows stay NULL and keep the existing release_year DESC sort.
ALTER TABLE models
    ADD COLUMN IF NOT EXISTS sort_order INTEGER;

CREATE INDEX IF NOT EXISTS idx_models_brand_category_sort
    ON models (brand_id, category_id, sort_order);

-- Ensure the Smartwatches category exists (already seeded in catalog_seed.sql).
INSERT INTO categories (slug, name_en, name_ar, sort_order, is_active) VALUES
    ('smartwatches', 'Smartwatches', 'ساعات ذكية', 2, TRUE)
ON CONFLICT (slug) DO UPDATE
    SET is_active = TRUE;

-- Brands are global. Apple + Samsung already exist from the phone catalog.
INSERT INTO brands (name) VALUES
    ('Apple'),
    ('Samsung'),
    ('Huawei')
ON CONFLICT (name) DO NOTHING;

-- Upsert a smartwatch model without stealing a same-named phone row.
CREATE OR REPLACE FUNCTION upsert_smartwatch_model(
    p_brand_id INTEGER,
    p_category_id INTEGER,
    p_name VARCHAR,
    p_release_year INTEGER,
    p_sort_order INTEGER
) RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
    v_category_id INTEGER;
BEGIN
    IF p_brand_id IS NULL OR p_category_id IS NULL OR p_name IS NULL THEN
        RETURN NULL;
    END IF;

    INSERT INTO models (brand_id, category_id, name, release_year, sort_order)
    VALUES (p_brand_id, p_category_id, p_name, p_release_year, p_sort_order)
    ON CONFLICT (brand_id, name) DO UPDATE
        SET
            sort_order = EXCLUDED.sort_order,
            release_year = COALESCE(EXCLUDED.release_year, models.release_year),
            category_id = COALESCE(models.category_id, EXCLUDED.category_id)
        WHERE models.category_id IS NULL
           OR models.category_id = EXCLUDED.category_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
        SELECT id, category_id
          INTO v_id, v_category_id
          FROM models
         WHERE brand_id = p_brand_id
           AND name = p_name;

        IF v_category_id IS DISTINCT FROM p_category_id THEN
            RETURN NULL;
        END IF;
    END IF;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Listing create/edit still require model_storage_id + model_color_id.
-- Attach generic watch capacities/colors so the existing form works.
-- These are listing-form options, not separate catalog models.
CREATE OR REPLACE FUNCTION attach_smartwatch_listing_options(p_model_id INTEGER)
RETURNS VOID AS $$
BEGIN
    IF p_model_id IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
    SELECT p_model_id, sc.id, v.ord
    FROM (VALUES (16, 0), (32, 1), (64, 2)) AS v(gb, ord)
    JOIN storage_capacities sc ON sc.capacity_gb = v.gb
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;

    INSERT INTO model_colors (model_id, color_id, sort_order)
    SELECT p_model_id, c.id, v.ord
    FROM (VALUES
        ('Black',  0),
        ('Silver', 1),
        ('Gold',   2),
        ('White',  3)
    ) AS v(color_name, ord)
    JOIN colors c ON c.name = v.color_name
    ON CONFLICT (model_id, color_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    watch_cat INTEGER;
    apple_id  INTEGER;
    sam_id    INTEGER;
    hua_id    INTEGER;
    m         INTEGER;
    rec       RECORD;
BEGIN
    SELECT id INTO watch_cat FROM categories WHERE slug = 'smartwatches';
    SELECT id INTO apple_id  FROM brands WHERE name = 'Apple';
    SELECT id INTO sam_id    FROM brands WHERE name = 'Samsung';
    SELECT id INTO hua_id    FROM brands WHERE name = 'Huawei';

    IF watch_cat IS NULL THEN
        RAISE EXCEPTION 'smartwatches category missing — run catalog_seed.sql first';
    END IF;
    IF apple_id IS NULL OR sam_id IS NULL OR hua_id IS NULL THEN
        RAISE EXCEPTION 'Apple/Samsung/Huawei brand missing';
    END IF;

    -- ============================================================
    -- APPLE  (18 models, family then chronology)
    -- Official names verified via Apple Newsroom / apple.com/watch
    -- Series 11, SE 3, Ultra 3: Apple Newsroom 2025-09
    -- ============================================================
    FOR rec IN
        SELECT * FROM (VALUES
            ('Apple Watch',            2015,  1),
            ('Apple Watch Series 1',   2016,  2),
            ('Apple Watch Series 2',   2016,  3),
            ('Apple Watch Series 3',   2017,  4),
            ('Apple Watch Series 4',   2018,  5),
            ('Apple Watch Series 5',   2019,  6),
            ('Apple Watch Series 6',   2020,  7),
            ('Apple Watch Series 7',   2021,  8),
            ('Apple Watch Series 8',   2022,  9),
            ('Apple Watch Series 9',   2023, 10),
            ('Apple Watch Series 10',  2024, 11),
            ('Apple Watch Series 11',  2025, 12),
            ('Apple Watch SE',         2020, 13),
            ('Apple Watch SE 2',       2022, 14),
            ('Apple Watch SE 3',       2025, 15),
            ('Apple Watch Ultra',      2022, 16),
            ('Apple Watch Ultra 2',    2023, 17),
            ('Apple Watch Ultra 3',    2025, 18)
        ) AS t(model_name, release_year, sort_order)
    LOOP
        m := upsert_smartwatch_model(apple_id, watch_cat, rec.model_name, rec.release_year, rec.sort_order);
        PERFORM attach_smartwatch_listing_options(m);
    END LOOP;

    -- ============================================================
    -- SAMSUNG  (27 models)
    -- Legacy Gear names: Samsung Newsroom Galaxy Watch evolution
    -- Galaxy Watch8 / Watch8 Classic / Watch Ultra: Samsung Newsroom 2025-07
    -- Galaxy Watch9 / Galaxy Watch Ultra2: Samsung Newsroom Unpacked 2026-07
    --   https://news.samsung.com/global/samsung-galaxy-watch-ultra2-and-watch9-your-health-companion-on-the-wrist
    -- Names match phone-catalog convention (no "Samsung" prefix).
    -- Official 2026 spelling is "Galaxy Watch Ultra2" (no space).
    -- ============================================================
    FOR rec IN
        SELECT * FROM (VALUES
            ('Galaxy Gear',              2013,  1),
            ('Gear 2',                   2014,  2),
            ('Gear 2 Neo',               2014,  3),
            ('Gear S',                   2014,  4),
            ('Gear S2',                  2015,  5),
            ('Gear S2 Classic',          2015,  6),
            ('Gear S3',                  2016,  7),
            ('Gear S3 Classic',          2016,  8),
            ('Gear S3 Frontier',         2016,  9),
            ('Gear Sport',               2017, 10),
            ('Galaxy Watch',             2018, 11),
            ('Galaxy Watch Active',      2019, 12),
            ('Galaxy Watch Active2',     2019, 13),
            ('Galaxy Watch3',            2020, 14),
            ('Galaxy Watch4',            2021, 15),
            ('Galaxy Watch4 Classic',    2021, 16),
            ('Galaxy Watch5',            2022, 17),
            ('Galaxy Watch5 Pro',        2022, 18),
            ('Galaxy Watch6',            2023, 19),
            ('Galaxy Watch6 Classic',    2023, 20),
            ('Galaxy Watch FE',          2024, 21),
            ('Galaxy Watch7',            2024, 22),
            ('Galaxy Watch Ultra',       2024, 23),
            ('Galaxy Watch8',            2025, 24),
            ('Galaxy Watch8 Classic',    2025, 25),
            ('Galaxy Watch9',            2026, 26),
            ('Galaxy Watch Ultra2',      2026, 27)
        ) AS t(model_name, release_year, sort_order)
    LOOP
        m := upsert_smartwatch_model(sam_id, watch_cat, rec.model_name, rec.release_year, rec.sort_order);
        PERFORM attach_smartwatch_listing_options(m);
    END LOOP;

    -- ============================================================
    -- HUAWEI  (38 models)
    -- Official consumer.huawei.com pages (UK/global/regional):
    -- WATCH 5, GT 5 / GT 5 Pro, GT 6 / GT 6 Pro, Ultimate 2
    -- FIT 5 / FIT 5 Pro: https://consumer.huawei.com/uk/wearables/watch-fit5/
    -- GT Runner 2: https://consumer.huawei.com/uk/wearables/watch-gt-runner-2/
    -- WATCH Buds 2: https://consumer.huawei.com/en/wearables/watch-buds-2/
    -- GT 2 Pro: https://consumer.huawei.com/ca/wearables/watch-gt2-pro/
    -- FIT SE official marketing name is "HUAWEI WATCH FIT Special Edition";
    -- stored as FIT SE to match the commercially used short name.
    -- ============================================================
    FOR rec IN
        SELECT * FROM (VALUES
            ('HUAWEI WATCH',                2015,  1),
            ('HUAWEI WATCH 2',              2017,  2),
            ('HUAWEI WATCH 2 Classic',      2017,  3),
            ('HUAWEI WATCH 3',              2021,  4),
            ('HUAWEI WATCH 3 Pro',          2021,  5),
            ('HUAWEI WATCH 4',              2023,  6),
            ('HUAWEI WATCH 4 Pro',          2023,  7),
            ('HUAWEI WATCH 5',              2025,  8),
            ('HUAWEI WATCH GT',             2018,  9),
            ('HUAWEI WATCH GT 2',           2019, 10),
            ('HUAWEI WATCH GT 2e',          2020, 11),
            ('HUAWEI WATCH GT 2 Pro',       2020, 12),
            ('HUAWEI WATCH GT 3',           2021, 13),
            ('HUAWEI WATCH GT 3 SE',        2022, 14),
            ('HUAWEI WATCH GT 3 Pro',       2022, 15),
            ('HUAWEI WATCH GT Runner',      2022, 16),
            ('HUAWEI WATCH GT Runner 2',    2026, 17),
            ('HUAWEI WATCH GT Cyber',       2022, 18),
            ('HUAWEI WATCH GT 4',           2023, 19),
            ('HUAWEI WATCH GT 5',           2024, 20),
            ('HUAWEI WATCH GT 5 Pro',       2024, 21),
            ('HUAWEI WATCH GT 6',           2025, 22),
            ('HUAWEI WATCH GT 6 Pro',       2025, 23),
            ('HUAWEI WATCH Ultimate',       2023, 24),
            ('HUAWEI WATCH Ultimate Design',2023, 25),
            ('HUAWEI WATCH Ultimate 2',     2025, 26),
            ('HUAWEI WATCH FIT',            2020, 27),
            ('HUAWEI WATCH FIT 2',          2021, 28),
            ('HUAWEI WATCH FIT SE',         2023, 29),
            ('HUAWEI WATCH FIT 3',          2024, 30),
            ('HUAWEI WATCH FIT 4',          2025, 31),
            ('HUAWEI WATCH FIT 4 Pro',      2025, 32),
            ('HUAWEI WATCH FIT 5',          2026, 33),
            ('HUAWEI WATCH FIT 5 Pro',      2026, 34),
            ('HUAWEI WATCH D',              2021, 35),
            ('HUAWEI WATCH D2',             2024, 36),
            ('HUAWEI WATCH Buds',           2023, 37),
            ('HUAWEI WATCH Buds 2',         2026, 38)
        ) AS t(model_name, release_year, sort_order)
    LOOP
        m := upsert_smartwatch_model(hua_id, watch_cat, rec.model_name, rec.release_year, rec.sort_order);
        PERFORM attach_smartwatch_listing_options(m);
    END LOOP;
END $$;

DROP FUNCTION IF EXISTS attach_smartwatch_listing_options(integer);
DROP FUNCTION IF EXISTS upsert_smartwatch_model(integer, integer, character varying, integer, integer);
