-- ============================================================
-- Telefonak Device Catalog Seed
-- Seeds: categories, storage_capacities, new colors,
--        Apple iPhones (6 – 16), Samsung Galaxy S (6 – 25),
--        Google Pixel (1 – 9) — models, model_storages, model_colors.
--
-- Data sourced from official manufacturer specifications only.
-- Safe to run multiple times (idempotent).
-- Must run AFTER catalog_schema.sql.
-- ============================================================

-- ── 1. Categories ─────────────────────────────────────────────
INSERT INTO categories (slug, name_en, name_ar, sort_order) VALUES
    ('phones',       'Phones',       'هواتف',         0),
    ('tablets',      'Tablets',      'أجهزة لوحية',   1),
    ('smartwatches', 'Smartwatches', 'ساعات ذكية',    2),
    ('laptops',      'Laptops',      'أجهزة محمولة',   3),
    ('accessories',  'Accessories',  'إكسسوارات',     4)
ON CONFLICT (slug) DO NOTHING;

-- ── 1b. SIM Configurations ────────────────────────────────────
INSERT INTO sim_configurations (name, description, sort_order) VALUES
    ('Dual Physical SIM',   'Two physical nano-SIM trays',                        0),
    ('Single Physical SIM', 'One physical nano-SIM tray, no eSIM',                 1),
    ('Physical SIM + eSIM', 'One physical nano-SIM tray plus one eSIM',            2),
    ('Dual eSIM',           'Two eSIM profiles, no physical SIM tray',             3),
    ('eSIM Only',           'Single eSIM profile, no physical SIM tray',           4)
ON CONFLICT (name) DO NOTHING;

-- ── 2. Storage Capacities ─────────────────────────────────────
INSERT INTO storage_capacities (capacity_gb, label) VALUES
    (16,   '16 GB'),
    (32,   '32 GB'),
    (64,   '64 GB'),
    (128,  '128 GB'),
    (256,  '256 GB'),
    (512,  '512 GB'),
    (1024, '1 TB')
ON CONFLICT (capacity_gb) DO NOTHING;

-- ── 3. Additional Colors ──────────────────────────────────────
-- Extends the existing colors table with model-specific hues.
INSERT INTO colors (name, hex_code) VALUES
    ('Coral',            '#E8603C'),
    ('Jet Black',        '#1A1A1A'),
    ('Graphite',         '#4A4A4A'),
    ('Midnight Green',   '#1C3B2D'),
    ('Pacific Blue',     '#4A7B9B'),
    ('Space Black',      '#2E2E32'),
    ('Black Titanium',   '#2C2C2C'),
    ('White Titanium',   '#E6E5E0'),
    ('Blue Titanium',    '#5A7A96'),
    ('Natural Titanium', '#BAB0A0'),
    ('Desert Titanium',  '#9E7A4E'),
    ('Teal',             '#3AADAD'),
    ('Ultramarine',      '#3060B8'),
    ('Gray',             '#808080'),
    ('Cream',            '#F4EDD4'),
    ('Lavender',         '#C0B0D0'),
    ('Navy',             '#1A2A50'),
    ('Icy Blue',         '#8ADCE8'),
    ('Sage',             '#7FAA70'),
    ('Lemongrass',       '#A8B858'),
    ('Hazel',            '#7A6040'),
    ('Porcelain',        '#EAE5DC'),
    ('Bay',              '#4060A0'),
    ('Aloe',             '#7AB878'),
    ('Wintergreen',      '#3A7A60'),
    ('Peony',            '#D06088'),
    ('Rose Quartz',      '#C09098'),
    ('Cobalt Violet',    '#5840A8'),
    ('Amber Yellow',     '#D8A000'),
    ('Mint',             '#8AD8B0')
ON CONFLICT (name) DO NOTHING;

-- ── 4. Models + Junctions ─────────────────────────────────────
DO $$
DECLARE
    phone_cat INTEGER;
    apple_id  INTEGER;
    sam_id    INTEGER;
    goog_id   INTEGER;
    m         INTEGER;
BEGIN
    SELECT id INTO phone_cat FROM categories WHERE slug = 'phones';
    SELECT id INTO apple_id  FROM brands    WHERE name = 'Apple';
    SELECT id INTO sam_id    FROM brands    WHERE name = 'Samsung';
    SELECT id INTO goog_id   FROM brands    WHERE name = 'Google';

    IF phone_cat IS NULL THEN
        RAISE EXCEPTION 'categories table not seeded — run catalog_schema.sql first';
    END IF;

    -- ================================================================
    --  APPLE  IPHONE  (iPhone 6 → iPhone 16 Pro Max)
    -- ================================================================

    -- iPhone 6 (2014)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 6', 2014)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[16,64,128])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Space Gray','Space Gray',0),('Silver','Silver',1),('Gold','Gold',2)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 6 Plus (2014)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 6 Plus', 2014)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[16,64,128])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Space Gray','Space Gray',0),('Silver','Silver',1),('Gold','Gold',2)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 6s (2015)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 6s', 2015)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[16,32,64,128])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Space Gray','Space Gray',0),('Silver','Silver',1),
            ('Gold','Gold',2),('Rose Gold','Rose Gold',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 6s Plus (2015)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 6s Plus', 2015)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[16,32,64,128])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Space Gray','Space Gray',0),('Silver','Silver',1),
            ('Gold','Gold',2),('Rose Gold','Rose Gold',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone SE (1st gen) (2016)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone SE', 2016)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[16,32,64,128])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Space Gray','Space Gray',0),('Silver','Silver',1),
            ('Gold','Gold',2),('Rose Gold','Rose Gold',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 7 (2016)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 7', 2016)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[32,128,256])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Black',0),('Jet Black','Jet Black',1),
            ('Silver','Silver',2),('Gold','Gold',3),
            ('Rose Gold','Rose Gold',4),('Red','(PRODUCT)RED',5)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 7 Plus (2016)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 7 Plus', 2016)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[32,128,256])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Black',0),('Jet Black','Jet Black',1),
            ('Silver','Silver',2),('Gold','Gold',3),
            ('Rose Gold','Rose Gold',4),('Red','(PRODUCT)RED',5)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 8 (2017)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 8', 2017)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[64,256])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Space Gray','Space Gray',0),('Silver','Silver',1),('Gold','Gold',2)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 8 Plus (2017)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 8 Plus', 2017)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[64,256])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Space Gray','Space Gray',0),('Silver','Silver',1),('Gold','Gold',2)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone X (2017) — already in DB, add category + junctions
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone X', 2017)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[64,256])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Space Gray','Space Gray',0),('Silver','Silver',1)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone XR (2018)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone XR', 2018)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[64,128,256])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Black',0),('White','White',1),('Blue','Blue',2),
            ('Yellow','Yellow',3),('Coral','Coral',4),('Red','(PRODUCT)RED',5)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone XS (2018)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone XS', 2018)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[64,256,512])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Space Gray','Space Gray',0),('Silver','Silver',1),('Gold','Gold',2)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone XS Max (2018)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone XS Max', 2018)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[64,256,512])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Space Gray','Space Gray',0),('Silver','Silver',1),('Gold','Gold',2)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 11 (2019)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 11', 2019)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[64,128,256])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Black',0),('White','White',1),('Yellow','Yellow',2),
            ('Green','Green',3),('Purple','Purple',4),('Red','(PRODUCT)RED',5)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 11 Pro (2019)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 11 Pro', 2019)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[64,256,512])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Midnight Green','Midnight Green',0),('Space Gray','Space Gray',1),
            ('Silver','Silver',2),('Gold','Gold',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 11 Pro Max (2019)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 11 Pro Max', 2019)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[64,256,512])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Midnight Green','Midnight Green',0),('Space Gray','Space Gray',1),
            ('Silver','Silver',2),('Gold','Gold',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone SE (2nd gen) (2020)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone SE (2020)', 2020)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[64,128,256])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Black',0),('White','White',1),('Red','(PRODUCT)RED',2)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 12 (2020)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 12', 2020)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[64,128,256])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Black',0),('White','White',1),('Blue','Blue',2),
            ('Green','Green',3),('Purple','Purple',4),('Red','(PRODUCT)RED',5)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 12 Mini (2020)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 12 Mini', 2020)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[64,128,256])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Black',0),('White','White',1),('Blue','Blue',2),
            ('Green','Green',3),('Purple','Purple',4),('Red','(PRODUCT)RED',5)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 12 Pro (2020)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 12 Pro', 2020)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256,512])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Graphite','Graphite',0),('Silver','Silver',1),
            ('Gold','Gold',2),('Pacific Blue','Pacific Blue',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 12 Pro Max (2020)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 12 Pro Max', 2020)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256,512])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Graphite','Graphite',0),('Silver','Silver',1),
            ('Gold','Gold',2),('Pacific Blue','Pacific Blue',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 13 (2021)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 13', 2021)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256,512])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Midnight','Midnight',0),('Starlight','Starlight',1),('Blue','Blue',2),
            ('Pink','Pink',3),('Green','Green',4),('Red','(PRODUCT)RED',5)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 13 Mini (2021)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 13 Mini', 2021)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256,512])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Midnight','Midnight',0),('Starlight','Starlight',1),('Blue','Blue',2),
            ('Pink','Pink',3),('Green','Green',4),('Red','(PRODUCT)RED',5)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 13 Pro (2021)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 13 Pro', 2021)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256,512,1024])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Graphite','Graphite',0),('Gold','Gold',1),('Silver','Silver',2),
            ('Sierra Blue','Sierra Blue',3),('Alpine Green','Alpine Green',4)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 13 Pro Max (2021)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 13 Pro Max', 2021)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256,512,1024])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Graphite','Graphite',0),('Gold','Gold',1),('Silver','Silver',2),
            ('Sierra Blue','Sierra Blue',3),('Alpine Green','Alpine Green',4)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone SE (3rd gen) (2022)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone SE (2022)', 2022)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[64,128,256])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Midnight','Midnight',0),('Starlight','Starlight',1),('Red','(PRODUCT)RED',2)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 14 (2022)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 14', 2022)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256,512])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Midnight','Midnight',0),('Starlight','Starlight',1),('Blue','Blue',2),
            ('Purple','Purple',3),('Red','(PRODUCT)RED',4),('Yellow','Yellow',5)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 14 Plus (2022)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 14 Plus', 2022)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256,512])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Midnight','Midnight',0),('Starlight','Starlight',1),('Blue','Blue',2),
            ('Purple','Purple',3),('Red','(PRODUCT)RED',4),('Yellow','Yellow',5)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 14 Pro (2022)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 14 Pro', 2022)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256,512,1024])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Space Black','Space Black',0),('Silver','Silver',1),
            ('Gold','Gold',2),('Deep Purple','Deep Purple',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 14 Pro Max (2022)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 14 Pro Max', 2022)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256,512,1024])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Space Black','Space Black',0),('Silver','Silver',1),
            ('Gold','Gold',2),('Deep Purple','Deep Purple',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 15 (2023)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 15', 2023)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256,512])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Black',0),('Blue','Blue',1),('Green','Green',2),
            ('Yellow','Yellow',3),('Pink','Pink',4)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 15 Plus (2023)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 15 Plus', 2023)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256,512])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Black',0),('Blue','Blue',1),('Green','Green',2),
            ('Yellow','Yellow',3),('Pink','Pink',4)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 15 Pro (2023)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 15 Pro', 2023)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256,512,1024])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black Titanium','Black Titanium',0),('White Titanium','White Titanium',1),
            ('Blue Titanium','Blue Titanium',2),('Natural Titanium','Natural Titanium',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 15 Pro Max (2023)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 15 Pro Max', 2023)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[256,512,1024])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black Titanium','Black Titanium',0),('White Titanium','White Titanium',1),
            ('Blue Titanium','Blue Titanium',2),('Natural Titanium','Natural Titanium',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 16 (2024)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 16', 2024)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256,512])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Black',0),('White','White',1),
            ('Ultramarine','Ultramarine',2),('Teal','Teal',3),('Pink','Pink',4)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 16 Plus (2024)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 16 Plus', 2024)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256,512])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Black',0),('White','White',1),
            ('Ultramarine','Ultramarine',2),('Teal','Teal',3),('Pink','Pink',4)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 16 Pro (2024)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 16 Pro', 2024)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256,512,1024])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black Titanium','Black Titanium',0),('White Titanium','White Titanium',1),
            ('Desert Titanium','Desert Titanium',2),('Natural Titanium','Natural Titanium',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- iPhone 16 Pro Max (2024)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (apple_id, phone_cat, 'iPhone 16 Pro Max', 2024)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[256,512,1024])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black Titanium','Black Titanium',0),('White Titanium','White Titanium',1),
            ('Desert Titanium','Desert Titanium',2),('Natural Titanium','Natural Titanium',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- ================================================================
    --  SAMSUNG  GALAXY S  (S6 → S25)
    -- ================================================================

    -- Galaxy S6 (2015)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S6', 2015)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[32,64,128])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Black Sapphire',0),('White','White Pearl',1),
            ('Gold','Gold Platinum',2),('Blue','Blue Topaz',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S6 Edge (2015)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S6 Edge', 2015)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[32,64,128])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Black Sapphire',0),('White','White Pearl',1),
            ('Gold','Gold Platinum',2),('Blue','Blue Topaz',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S6 Edge+ (2015)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S6 Edge+', 2015)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[32,64])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Black Sapphire',0),('White','White Pearl',1),
            ('Gold','Gold Platinum',2),('Silver','Silver Titanium',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S7 (2016)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S7', 2016)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[32])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Black Onyx',0),('White','White Pearl',1),
            ('Gold','Gold Platinum',2),('Silver','Silver Titanium',3),
            ('Rose Gold','Pink Gold',4)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S7 Edge (2016)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S7 Edge', 2016)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[32])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Black Onyx',0),('White','White Pearl',1),
            ('Gold','Gold Platinum',2),('Silver','Silver Titanium',3),
            ('Rose Gold','Pink Gold',4)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S8 (2017)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S8', 2017)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[64])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Midnight Black',0),('Gray','Orchid Gray',1),
            ('Silver','Arctic Silver',2),('Teal','Coral Blue',3),
            ('Gold','Maple Gold',4)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S8+ (2017)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S8+', 2017)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[64])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Midnight Black',0),('Gray','Orchid Gray',1),
            ('Silver','Arctic Silver',2),('Teal','Coral Blue',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S9 (2018)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S9', 2018)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[64,128,256])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Midnight Black',0),('Purple','Lilac Purple',1),
            ('Teal','Coral Blue',2),('Gray','Titanium Gray',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S9+ (2018)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S9+', 2018)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[64,128,256])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Midnight Black',0),('Purple','Lilac Purple',1),
            ('Gold','Sunrise Gold',2),('Gray','Titanium Gray',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S10e (2019)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S10e', 2019)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Prism Black',0),('White','Prism White',1),
            ('Blue','Prism Blue',2),('Green','Prism Green',3),
            ('Pink','Flamingo Pink',4),('Yellow','Canary Yellow',5)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S10 (2019)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S10', 2019)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,512])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Prism Black',0),('White','Prism White',1),
            ('Blue','Prism Blue',2),('Green','Prism Green',3),
            ('Pink','Flamingo Pink',4),('Red','Cardinal Red',5)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S10+ (2019)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S10+', 2019)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,512,1024])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Prism Black',0),('White','Prism White',1),
            ('Blue','Prism Blue',2),('Green','Prism Green',3),
            ('Pink','Flamingo Pink',4),('Red','Cardinal Red',5)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S20 (2020)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S20', 2020)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Gray','Cosmic Gray',0),('White','Cloud White',1),
            ('Blue','Cloud Blue',2),('Red','Cosmic Red',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S20+ (2020)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S20+', 2020)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Gray','Cosmic Gray',0),('White','Cloud White',1),
            ('Blue','Cloud Blue',2),('Red','Cosmic Red',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S20 Ultra (2020)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S20 Ultra', 2020)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,512])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Gray','Cosmic Gray',0),('Black','Cosmic Black',1)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S21 (2021) — already in DB
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S21', 2021)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Gray','Phantom Gray',0),('White','Phantom White',1),
            ('Purple','Phantom Violet',2),('Pink','Phantom Pink',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S21+ (2021)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S21+', 2021)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Phantom Black',0),('Silver','Phantom Silver',1),
            ('Purple','Phantom Violet',2),('Pink','Phantom Pink',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S21 Ultra (2021)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S21 Ultra', 2021)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256,512])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Phantom Black',0),('Silver','Phantom Silver',1),
            ('Gray','Phantom Titanium',2),('Navy','Phantom Navy',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S22 (2022)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S22', 2022)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Phantom Black',0),('White','Phantom White',1),
            ('Green','Green',2),('Cream','Cream',3),
            ('Blue','Sky Blue',4),('Purple','Violet',5)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S22+ (2022)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S22+', 2022)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Phantom Black',0),('White','Phantom White',1),
            ('Green','Green',2),('Cream','Cream',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S22 Ultra (2022)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S22 Ultra', 2022)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256,512,1024])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Phantom Black',0),('White','Phantom White',1),
            ('Green','Green',2),('Red','Burgundy',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S23 (2023)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S23', 2023)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Phantom Black',0),('Cream','Cream',1),
            ('Green','Green',2),('Lavender','Lavender',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S23+ (2023)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S23+', 2023)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[256,512])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Phantom Black',0),('Cream','Cream',1),
            ('Green','Green',2),('Lavender','Lavender',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S23 Ultra (2023)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S23 Ultra', 2023)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[256,512,1024])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Phantom Black',0),('Cream','Cream',1),
            ('Green','Green',2),('Lavender','Lavender',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S24 (2024)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S24', 2024)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Cobalt Violet','Cobalt Violet',0),('Amber Yellow','Amber Yellow',1),
            ('Black','Onyx Black',2),('Gray','Marble Gray',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S24+ (2024)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S24+', 2024)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[256,512])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Cobalt Violet','Cobalt Violet',0),('Amber Yellow','Amber Yellow',1),
            ('Black','Onyx Black',2),('Gray','Marble Gray',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S24 Ultra (2024)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S24 Ultra', 2024)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[256,512,1024])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Titanium Black',0),('Gray','Titanium Gray',1),
            ('Purple','Titanium Violet',2),('Yellow','Titanium Yellow',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S25 (2025)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S25', 2025)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Icy Blue','Icy Blue',0),('Navy','Navy',1),
            ('Silver','Silver Shadow',2),('Mint','Mint',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S25+ (2025)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S25+', 2025)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[256,512])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Icy Blue','Icy Blue',0),('Navy','Navy',1),('Silver','Silver Shadow',2)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Galaxy S25 Ultra (2025)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (sam_id, phone_cat, 'Galaxy S25 Ultra', 2025)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[256,512,1024])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Titanium Black',0),('Gray','Titanium Gray',1)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- ================================================================
    --  GOOGLE  PIXEL  (Pixel 1 → Pixel 9 Pro Fold)
    -- ================================================================

    -- Pixel (2016)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (goog_id, phone_cat, 'Pixel', 2016)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[32,128])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Quite Black',0),('Silver','Very Silver',1),
            ('Blue','Really Blue',2)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Pixel XL (2016)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (goog_id, phone_cat, 'Pixel XL', 2016)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[32,128])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Quite Black',0),('Silver','Very Silver',1),
            ('Blue','Really Blue',2)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Pixel 2 (2017)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (goog_id, phone_cat, 'Pixel 2', 2017)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[64,128])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Just Black',0),('White','Clearly White',1),
            ('Blue','Kinda Blue',2)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Pixel 2 XL (2017)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (goog_id, phone_cat, 'Pixel 2 XL', 2017)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[64,128])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Just Black',0),('White','Black & White',1)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Pixel 3 (2018)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (goog_id, phone_cat, 'Pixel 3', 2018)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[64,128])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Just Black',0),('White','Clearly White',1),
            ('Pink','Not Pink',2)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Pixel 3 XL (2018)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (goog_id, phone_cat, 'Pixel 3 XL', 2018)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[64,128])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Just Black',0),('White','Clearly White',1),
            ('Pink','Not Pink',2)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Pixel 3a (2019)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (goog_id, phone_cat, 'Pixel 3a', 2019)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[64])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Just Black',0),('White','Clearly White',1),
            ('Purple','Purple-ish',2)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Pixel 3a XL (2019)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (goog_id, phone_cat, 'Pixel 3a XL', 2019)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[64])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Just Black',0),('White','Clearly White',1),
            ('Purple','Purple-ish',2)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Pixel 4 (2019)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (goog_id, phone_cat, 'Pixel 4', 2019)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[64,128])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Just Black',0),('White','Clearly White',1),
            ('Coral','Oh So Orange',2)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Pixel 4 XL (2019)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (goog_id, phone_cat, 'Pixel 4 XL', 2019)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[64,128])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Just Black',0),('White','Clearly White',1),
            ('Coral','Oh So Orange',2)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Pixel 4a (2020)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (goog_id, phone_cat, 'Pixel 4a', 2020)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Just Black',0),('Blue','Barely Blue',1)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Pixel 4a 5G (2020)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (goog_id, phone_cat, 'Pixel 4a 5G', 2020)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Just Black',0),('White','Clearly White',1)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Pixel 5 (2020)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (goog_id, phone_cat, 'Pixel 5', 2020)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Just Black',0),('Sage','Sorta Sage',1)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Pixel 6 (2021) — already in DB
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (goog_id, phone_cat, 'Pixel 6', 2021)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Stormy Black',0),('Coral','Kinda Coral',1),
            ('Teal','Sorta Seafoam',2)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Pixel 6 Pro (2021) — already in DB
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (goog_id, phone_cat, 'Pixel 6 Pro', 2021)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256,512])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Stormy Black',0),('White','Cloudy White',1),
            ('Yellow','Sorta Sunny',2)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Pixel 6a (2022)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (goog_id, phone_cat, 'Pixel 6a', 2022)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('White','Chalk',0),('Graphite','Charcoal',1),('Sage','Sage',2)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Pixel 7 (2022) — already in DB
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (goog_id, phone_cat, 'Pixel 7', 2022)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Obsidian',0),('White','Snow',1),('Lemongrass','Lemongrass',2)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Pixel 7 Pro (2022) — already in DB
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (goog_id, phone_cat, 'Pixel 7 Pro', 2022)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256,512])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Obsidian',0),('White','Snow',1),('Hazel','Hazel',2)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Pixel 7a (2023)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (goog_id, phone_cat, 'Pixel 7a', 2023)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Graphite','Charcoal',0),('White','Snow',1),
            ('Coral','Coral',2),('Teal','Sea',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Pixel 8 (2023) — already in DB
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (goog_id, phone_cat, 'Pixel 8', 2023)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Obsidian',0),('Hazel','Hazel',1),('Pink','Rose',2)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Pixel 8 Pro (2023) — already in DB
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (goog_id, phone_cat, 'Pixel 8 Pro', 2023)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256,512,1024])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Obsidian',0),('Porcelain','Porcelain',1),('Bay','Bay',2)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Pixel 8a (2024)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (goog_id, phone_cat, 'Pixel 8a', 2024)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Obsidian',0),('Porcelain','Porcelain',1),
            ('Bay','Bay',2),('Aloe','Aloe',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Pixel 9 (2024)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (goog_id, phone_cat, 'Pixel 9', 2024)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Obsidian',0),('Porcelain','Porcelain',1),
            ('Wintergreen','Wintergreen',2),('Peony','Peony',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Pixel 9 Pro (2024)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (goog_id, phone_cat, 'Pixel 9 Pro', 2024)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256,512,1024])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Obsidian',0),('Porcelain','Porcelain',1),
            ('Hazel','Hazel',2),('Rose Quartz','Rose Quartz',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Pixel 9 Pro XL (2024)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (goog_id, phone_cat, 'Pixel 9 Pro XL', 2024)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[128,256,512,1024])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Obsidian',0),('Porcelain','Porcelain',1),
            ('Hazel','Hazel',2),('Rose Quartz','Rose Quartz',3)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- Pixel 9 Pro Fold (2024)
    INSERT INTO models (brand_id, category_id, name, release_year)
        VALUES (goog_id, phone_cat, 'Pixel 9 Pro Fold', 2024)
    ON CONFLICT (brand_id, name) DO UPDATE SET category_id = EXCLUDED.category_id
    RETURNING id INTO m;
    INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
        SELECT m, id, (ROW_NUMBER() OVER (ORDER BY capacity_gb)) - 1
        FROM storage_capacities WHERE capacity_gb = ANY(ARRAY[256,512])
    ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;
    INSERT INTO model_colors (model_id, color_id, official_name, sort_order)
        SELECT m, c.id, v.ofn, v.ord FROM (VALUES
            ('Black','Obsidian',0),('Porcelain','Porcelain',1)
        ) v(cn,ofn,ord) JOIN colors c ON c.name = v.cn
    ON CONFLICT (model_id, color_id) DO NOTHING;

    -- ================================================================
    --  Set category_id = 'phones' for ALL existing brand models
    --  that are still uncategorised (covers Xiaomi, Huawei, etc.)
    -- ================================================================
    UPDATE models
    SET    category_id = phone_cat
    WHERE  category_id IS NULL;

END $$;
