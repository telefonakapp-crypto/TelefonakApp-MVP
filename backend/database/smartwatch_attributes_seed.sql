-- ============================================================
-- Phase 2C — Real smartwatch catalog attributes
--
-- Idempotent. Resolves models by brand + name + smartwatches category.
-- Deactivates placeholder watch storage/color associations that are not
-- manufacturer-backed. Does NOT delete rows. Does NOT touch phone data.
-- ============================================================

BEGIN;

INSERT INTO storage_capacities (capacity_gb, label) VALUES
    (4, '4 GB'),
    (8, '8 GB')
ON CONFLICT (capacity_gb) DO NOTHING;

INSERT INTO watch_case_sizes (size_mm, label, sort_order)
VALUES (38.0, '38mm', 0)
ON CONFLICT (label) DO UPDATE SET size_mm = EXCLUDED.size_mm, sort_order = EXCLUDED.sort_order;
INSERT INTO watch_case_sizes (size_mm, label, sort_order)
VALUES (40.0, '40mm', 1)
ON CONFLICT (label) DO UPDATE SET size_mm = EXCLUDED.size_mm, sort_order = EXCLUDED.sort_order;
INSERT INTO watch_case_sizes (size_mm, label, sort_order)
VALUES (41.0, '41mm', 2)
ON CONFLICT (label) DO UPDATE SET size_mm = EXCLUDED.size_mm, sort_order = EXCLUDED.sort_order;
INSERT INTO watch_case_sizes (size_mm, label, sort_order)
VALUES (42.0, '42mm', 3)
ON CONFLICT (label) DO UPDATE SET size_mm = EXCLUDED.size_mm, sort_order = EXCLUDED.sort_order;
INSERT INTO watch_case_sizes (size_mm, label, sort_order)
VALUES (43.0, '43mm', 4)
ON CONFLICT (label) DO UPDATE SET size_mm = EXCLUDED.size_mm, sort_order = EXCLUDED.sort_order;
INSERT INTO watch_case_sizes (size_mm, label, sort_order)
VALUES (44.0, '44mm', 5)
ON CONFLICT (label) DO UPDATE SET size_mm = EXCLUDED.size_mm, sort_order = EXCLUDED.sort_order;
INSERT INTO watch_case_sizes (size_mm, label, sort_order)
VALUES (45.0, '45mm', 6)
ON CONFLICT (label) DO UPDATE SET size_mm = EXCLUDED.size_mm, sort_order = EXCLUDED.sort_order;
INSERT INTO watch_case_sizes (size_mm, label, sort_order)
VALUES (46.0, '46mm', 7)
ON CONFLICT (label) DO UPDATE SET size_mm = EXCLUDED.size_mm, sort_order = EXCLUDED.sort_order;
INSERT INTO watch_case_sizes (size_mm, label, sort_order)
VALUES (47.0, '47mm', 8)
ON CONFLICT (label) DO UPDATE SET size_mm = EXCLUDED.size_mm, sort_order = EXCLUDED.sort_order;
INSERT INTO watch_case_sizes (size_mm, label, sort_order)
VALUES (48.0, '48mm', 9)
ON CONFLICT (label) DO UPDATE SET size_mm = EXCLUDED.size_mm, sort_order = EXCLUDED.sort_order;
INSERT INTO watch_case_sizes (size_mm, label, sort_order)
VALUES (49.0, '49mm', 10)
ON CONFLICT (label) DO UPDATE SET size_mm = EXCLUDED.size_mm, sort_order = EXCLUDED.sort_order;

INSERT INTO colors (name, hex_code) VALUES ('(PRODUCT)RED', '#C41E3A')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('18K Rose Gold', '#B76E79')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Aqua Black', '#1C2428')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Beige', '#D4C4A8')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Black', '#808080')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Black Titanium', '#2A2A2A')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Blue', '#808080')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Blue Black', '#12141C')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Brown', '#6B4423')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Carbon Crystal Black', '#111111')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Charcoal Black', '#2B2B2B')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Cloud Silver', '#D4D8DC')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Cream', '#F4EDD4')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Dark Gray', '#4A4A4A')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Dawn Orange', '#E07A3D')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Dusk Blue', '#3D5A80')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Forest Green', '#2F5D3A')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Gold', '#808080')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Gold Brown', '#8A6A3A')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Graphite', '#808080')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Gray', '#808080')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Gray Titanium', '#6B6E73')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Green', '#808080')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Isle Blue', '#5B8FA8')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Jet Black', '#808080')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Khaki', '#8B7D4A')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Lime Green', '#8FBF3F')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Melon', '#F4A07A')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Midnight', '#808080')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Midnight Black', '#0D0D0F')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Mint', '#98D4B4')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Mocha Gray', '#6B5E54')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Moon White', '#F7F5F0')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Mystic Black', '#1A1A1A')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Mystic Bronze', '#8B6B3D')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Mystic Silver', '#C8C8C8')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Natural', '#C4B8A8')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Natural Titanium', '#808080')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Nebula Gray', '#6A6E76')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Nebula Pink', '#D48AA8')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Night Black', '#0A0A0A')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Oatmeal Beige', '#D8CDB8')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Orange', '#E85D04')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Pink', '#808080')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Pink Gold', '#E8B4A2')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Platinum', '#E5E4E2')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Purple', '#808080')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Rose Gold', '#E6B8A2')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Sakura', '#F4B8C8')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Sakura Pink', '#F4B8C8')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Sand Gold', '#C4A574')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Sapphire', '#2E5090')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Sea Green', '#2E8B6E')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Silver', '#808080')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Slate', '#4A4E57')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Space Black', '#1A1A1A')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Space Gray', '#808080')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Stainless Steel', '#C0C0C0')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Starlight', '#808080')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Starry Black', '#141418')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Sunrise Yellow', '#F4C430')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Titanium Gray', '#6B6E73')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Titanium Silver', '#C0C4C8')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Titanium White', '#F2F0EA')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('White', '#808080')
ON CONFLICT (name) DO NOTHING;
INSERT INTO colors (name, hex_code) VALUES ('Wild Orange', '#E85D04')
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION telefonak_seed_watch_model(
    p_brand TEXT,
    p_model TEXT,
    p_sizes TEXT[],
    p_conns TEXT[],
    p_storage_gb INT[],
    p_color_specs TEXT[]
) RETURNS VOID AS $$
DECLARE
    v_model_id INTEGER;
    v_size TEXT;
    v_conn TEXT;
    v_gb INTEGER;
    v_spec TEXT;
    v_color_name TEXT;
    v_official TEXT;
    v_ord INTEGER;
    v_keep_color_ids INTEGER[] := '{}';
    v_keep_storage_ids INTEGER[] := '{}';
    v_color_id INTEGER;
    v_ms_id INTEGER;
BEGIN
    SELECT m.id INTO v_model_id
    FROM models m
    JOIN brands b ON b.id = m.brand_id
    JOIN categories c ON c.id = m.category_id
    WHERE b.name = p_brand
      AND m.name = p_model
      AND c.slug = 'smartwatches';

    IF v_model_id IS NULL THEN
        RAISE EXCEPTION 'Missing smartwatch model: % / %', p_brand, p_model;
    END IF;

    v_ord := 0;
    FOREACH v_size IN ARRAY COALESCE(p_sizes, '{}'::text[]) LOOP
        INSERT INTO model_watch_case_sizes (model_id, case_size_id, is_active, sort_order)
        SELECT v_model_id, wcs.id, TRUE, v_ord
        FROM watch_case_sizes wcs
        WHERE wcs.label = v_size
        ON CONFLICT (model_id, case_size_id) DO UPDATE
            SET is_active = TRUE, sort_order = EXCLUDED.sort_order;
        v_ord := v_ord + 1;
    END LOOP;

    UPDATE model_watch_case_sizes mwcs
       SET is_active = FALSE
     WHERE mwcs.model_id = v_model_id
       AND NOT EXISTS (
           SELECT 1
           FROM unnest(COALESCE(p_sizes, '{}'::text[])) AS wanted(label)
           JOIN watch_case_sizes wcs ON wcs.label = wanted.label
           WHERE wcs.id = mwcs.case_size_id
       );

    v_ord := 0;
    FOREACH v_conn IN ARRAY COALESCE(p_conns, '{}'::text[]) LOOP
        INSERT INTO model_watch_connectivities (model_id, connectivity_id, is_active, sort_order)
        SELECT v_model_id, wc.id, TRUE, v_ord
        FROM watch_connectivities wc
        WHERE wc.slug = v_conn
        ON CONFLICT (model_id, connectivity_id) DO UPDATE
            SET is_active = TRUE, sort_order = EXCLUDED.sort_order;
        v_ord := v_ord + 1;
    END LOOP;

    UPDATE model_watch_connectivities mwc
       SET is_active = FALSE
     WHERE mwc.model_id = v_model_id
       AND NOT EXISTS (
           SELECT 1
           FROM unnest(COALESCE(p_conns, '{}'::text[])) AS wanted(slug)
           JOIN watch_connectivities wc ON wc.slug = wanted.slug
           WHERE wc.id = mwc.connectivity_id
       );

    v_ord := 0;
    FOREACH v_gb IN ARRAY COALESCE(p_storage_gb, '{}'::int[]) LOOP
        INSERT INTO model_storages (model_id, storage_capacity_id, is_active, sort_order)
        SELECT v_model_id, sc.id, TRUE, v_ord
        FROM storage_capacities sc
        WHERE sc.capacity_gb = v_gb
        ON CONFLICT (model_id, storage_capacity_id) DO UPDATE
            SET is_active = TRUE, sort_order = EXCLUDED.sort_order;
        SELECT ms.id INTO v_ms_id
        FROM model_storages ms
        JOIN storage_capacities sc ON sc.id = ms.storage_capacity_id
        WHERE ms.model_id = v_model_id
          AND sc.capacity_gb = v_gb;
        v_keep_storage_ids := array_append(v_keep_storage_ids, v_ms_id);
        v_ord := v_ord + 1;
    END LOOP;

    UPDATE model_storages
       SET is_active = FALSE
     WHERE model_id = v_model_id
       AND NOT (id = ANY (v_keep_storage_ids));

    v_ord := 0;
    FOREACH v_spec IN ARRAY COALESCE(p_color_specs, '{}'::text[]) LOOP
        IF position('||' IN v_spec) > 0 THEN
            v_color_name := split_part(v_spec, '||', 1);
            v_official := split_part(v_spec, '||', 2);
        ELSE
            v_color_name := v_spec;
            v_official := v_spec;
        END IF;

        SELECT id INTO v_color_id FROM colors WHERE name = v_color_name;
        IF v_color_id IS NULL THEN
            RAISE EXCEPTION 'Missing color catalog row: %', v_color_name;
        END IF;

        INSERT INTO model_colors (model_id, color_id, official_name, is_active, sort_order)
        VALUES (v_model_id, v_color_id, v_official, TRUE, v_ord)
        ON CONFLICT (model_id, color_id) DO UPDATE
            SET is_active = TRUE,
                official_name = EXCLUDED.official_name,
                sort_order = EXCLUDED.sort_order;
        SELECT mc.id INTO v_ms_id
        FROM model_colors mc
        WHERE mc.model_id = v_model_id
          AND mc.color_id = v_color_id;
        v_keep_color_ids := array_append(v_keep_color_ids, v_ms_id);
        v_ord := v_ord + 1;
    END LOOP;

    UPDATE model_colors
       SET is_active = FALSE
     WHERE model_id = v_model_id
       AND NOT (id = ANY (v_keep_color_ids));
END;
$$ LANGUAGE plpgsql;

SELECT telefonak_seed_watch_model(
    'Apple',
    'Apple Watch',
    ARRAY['38mm', '42mm']::text[],
    ARRAY['bluetooth']::text[],
    '{}'::int[],
    ARRAY['Silver||Stainless Steel', 'Space Black||Space Black Stainless Steel']::text[]
);

SELECT telefonak_seed_watch_model(
    'Apple',
    'Apple Watch Series 1',
    ARRAY['38mm', '42mm']::text[],
    ARRAY['bluetooth']::text[],
    ARRAY[8]::int[],
    '{}'::text[]
);

SELECT telefonak_seed_watch_model(
    'Apple',
    'Apple Watch Series 2',
    ARRAY['38mm', '42mm']::text[],
    ARRAY['gps']::text[],
    '{}'::int[],
    ARRAY['White||White Ceramic']::text[]
);

SELECT telefonak_seed_watch_model(
    'Apple',
    'Apple Watch Series 3',
    ARRAY['38mm', '42mm']::text[],
    ARRAY['gps', 'gps_cellular']::text[],
    ARRAY[8, 16]::int[],
    ARRAY['Silver||Aluminum Silver', 'Space Gray||Aluminum Space Gray', 'Gold||Aluminum Gold']::text[]
);

SELECT telefonak_seed_watch_model(
    'Apple',
    'Apple Watch Series 4',
    ARRAY['40mm', '44mm']::text[],
    ARRAY['gps', 'gps_cellular']::text[],
    ARRAY[16]::int[],
    ARRAY['Silver', 'Space Gray', 'Gold', 'Space Black||Space Black Stainless Steel']::text[]
);

SELECT telefonak_seed_watch_model(
    'Apple',
    'Apple Watch Series 5',
    ARRAY['40mm', '44mm']::text[],
    ARRAY['gps', 'gps_cellular']::text[],
    ARRAY[32]::int[],
    ARRAY['Silver', 'Space Gray', 'Gold', 'Space Black||Space Black Stainless Steel']::text[]
);

SELECT telefonak_seed_watch_model(
    'Apple',
    'Apple Watch Series 6',
    ARRAY['40mm', '44mm']::text[],
    ARRAY['gps', 'gps_cellular']::text[],
    ARRAY[32]::int[],
    ARRAY['Silver', 'Space Gray', 'Gold', 'Blue', '(PRODUCT)RED', 'Graphite', 'Natural Titanium||Titanium', 'Space Black||Space Black Titanium']::text[]
);

SELECT telefonak_seed_watch_model(
    'Apple',
    'Apple Watch Series 7',
    ARRAY['41mm', '45mm']::text[],
    ARRAY['gps', 'gps_cellular']::text[],
    ARRAY[32]::int[],
    ARRAY['Midnight', 'Starlight', 'Green', 'Blue', '(PRODUCT)RED', 'Graphite||Graphite (PVD)', 'Silver', 'Gold||Gold (PVD)', 'Space Black||Space Black Titanium', 'Natural Titanium||Titanium']::text[]
);

SELECT telefonak_seed_watch_model(
    'Apple',
    'Apple Watch Series 8',
    ARRAY['41mm', '45mm']::text[],
    ARRAY['gps', 'gps_cellular']::text[],
    ARRAY[32]::int[],
    ARRAY['Midnight', 'Starlight', 'Silver', '(PRODUCT)RED', 'Graphite||Graphite (PVD)', 'Gold||Gold (PVD)']::text[]
);

SELECT telefonak_seed_watch_model(
    'Apple',
    'Apple Watch Series 9',
    ARRAY['41mm', '45mm']::text[],
    ARRAY['gps', 'gps_cellular']::text[],
    ARRAY[64]::int[],
    ARRAY['Pink', 'Midnight', 'Starlight', 'Silver', '(PRODUCT)RED', 'Gold', 'Graphite']::text[]
);

SELECT telefonak_seed_watch_model(
    'Apple',
    'Apple Watch Series 10',
    ARRAY['42mm', '46mm']::text[],
    ARRAY['gps', 'gps_cellular']::text[],
    ARRAY[64]::int[],
    ARRAY['Jet Black', 'Rose Gold', 'Silver', 'Slate', 'Gold', 'Natural||Natural Titanium']::text[]
);

SELECT telefonak_seed_watch_model(
    'Apple',
    'Apple Watch Series 11',
    ARRAY['42mm', '46mm']::text[],
    ARRAY['gps', 'gps_cellular']::text[],
    ARRAY[64]::int[],
    ARRAY['Rose Gold', 'Silver', 'Space Gray', 'Jet Black', 'Gold', 'Natural||Natural Titanium', 'Slate']::text[]
);

SELECT telefonak_seed_watch_model(
    'Apple',
    'Apple Watch SE',
    ARRAY['40mm', '44mm']::text[],
    ARRAY['gps', 'gps_cellular']::text[],
    ARRAY[32]::int[],
    ARRAY['Silver', 'Space Gray', 'Gold']::text[]
);

SELECT telefonak_seed_watch_model(
    'Apple',
    'Apple Watch SE 2',
    ARRAY['40mm', '44mm']::text[],
    ARRAY['gps', 'gps_cellular']::text[],
    ARRAY[32]::int[],
    ARRAY['Midnight', 'Starlight', 'Silver']::text[]
);

SELECT telefonak_seed_watch_model(
    'Apple',
    'Apple Watch SE 3',
    ARRAY['40mm', '44mm']::text[],
    ARRAY['gps', 'gps_cellular']::text[],
    ARRAY[64]::int[],
    ARRAY['Jet Black', 'Rose Gold', 'Silver', 'Space Gray']::text[]
);

SELECT telefonak_seed_watch_model(
    'Apple',
    'Apple Watch Ultra',
    ARRAY['49mm']::text[],
    ARRAY['gps_cellular']::text[],
    ARRAY[32]::int[],
    ARRAY['Natural Titanium||Titanium']::text[]
);

SELECT telefonak_seed_watch_model(
    'Apple',
    'Apple Watch Ultra 2',
    ARRAY['49mm']::text[],
    ARRAY['gps_cellular']::text[],
    ARRAY[64]::int[],
    ARRAY['Natural||Natural Titanium', 'Black||Black Titanium']::text[]
);

SELECT telefonak_seed_watch_model(
    'Apple',
    'Apple Watch Ultra 3',
    ARRAY['49mm']::text[],
    ARRAY['gps_cellular']::text[],
    ARRAY[64]::int[],
    ARRAY['Natural||Natural Titanium', 'Black||Black Titanium']::text[]
);

SELECT telefonak_seed_watch_model(
    'Samsung',
    'Galaxy Gear',
    '{}'::text[],
    ARRAY['bluetooth']::text[],
    '{}'::int[],
    ARRAY['Jet Black', 'Mocha Gray', 'Wild Orange', 'Oatmeal Beige', 'Rose Gold', 'Lime Green']::text[]
);

SELECT telefonak_seed_watch_model(
    'Samsung',
    'Gear 2',
    '{}'::text[],
    ARRAY['bluetooth']::text[],
    ARRAY[4]::int[],
    ARRAY['Charcoal Black', 'Gold Brown', 'Wild Orange']::text[]
);

SELECT telefonak_seed_watch_model(
    'Samsung',
    'Gear 2 Neo',
    '{}'::text[],
    ARRAY['bluetooth']::text[],
    ARRAY[4]::int[],
    ARRAY['Charcoal Black', 'Mocha Gray', 'Wild Orange']::text[]
);

SELECT telefonak_seed_watch_model(
    'Samsung',
    'Gear S',
    '{}'::text[],
    ARRAY['bluetooth']::text[],
    ARRAY[4]::int[],
    ARRAY['Blue Black', 'White']::text[]
);

SELECT telefonak_seed_watch_model(
    'Samsung',
    'Gear S2',
    '{}'::text[],
    ARRAY['bluetooth']::text[],
    ARRAY[4]::int[],
    ARRAY['Dark Gray', 'Silver']::text[]
);

SELECT telefonak_seed_watch_model(
    'Samsung',
    'Gear S2 Classic',
    '{}'::text[],
    ARRAY['bluetooth']::text[],
    ARRAY[4]::int[],
    ARRAY['Black', '18K Rose Gold', 'Platinum']::text[]
);

SELECT telefonak_seed_watch_model(
    'Samsung',
    'Gear S3',
    '{}'::text[],
    ARRAY['bluetooth', 'bluetooth_lte']::text[],
    ARRAY[4]::int[],
    ARRAY['Dark Gray', 'Silver']::text[]
);

SELECT telefonak_seed_watch_model(
    'Samsung',
    'Gear S3 Classic',
    '{}'::text[],
    ARRAY['bluetooth', 'bluetooth_lte']::text[],
    ARRAY[4]::int[],
    ARRAY['Silver']::text[]
);

SELECT telefonak_seed_watch_model(
    'Samsung',
    'Gear S3 Frontier',
    '{}'::text[],
    ARRAY['bluetooth', 'bluetooth_lte']::text[],
    ARRAY[4]::int[],
    ARRAY['Dark Gray']::text[]
);

SELECT telefonak_seed_watch_model(
    'Samsung',
    'Gear Sport',
    '{}'::text[],
    ARRAY['bluetooth']::text[],
    ARRAY[4]::int[],
    ARRAY['Black', 'Blue']::text[]
);

SELECT telefonak_seed_watch_model(
    'Samsung',
    'Galaxy Watch',
    ARRAY['42mm', '46mm']::text[],
    ARRAY['bluetooth', 'bluetooth_lte']::text[],
    ARRAY[4]::int[],
    ARRAY['Silver', 'Midnight Black', 'Rose Gold']::text[]
);

SELECT telefonak_seed_watch_model(
    'Samsung',
    'Galaxy Watch Active',
    ARRAY['40mm']::text[],
    ARRAY['bluetooth']::text[],
    ARRAY[4]::int[],
    ARRAY['Silver', 'Black', 'Rose Gold', 'Sea Green']::text[]
);

SELECT telefonak_seed_watch_model(
    'Samsung',
    'Galaxy Watch Active2',
    ARRAY['40mm', '44mm']::text[],
    ARRAY['bluetooth', 'bluetooth_lte']::text[],
    ARRAY[4]::int[],
    ARRAY['Cloud Silver', 'Aqua Black', 'Pink Gold', 'Silver', 'Black', 'Gold']::text[]
);

SELECT telefonak_seed_watch_model(
    'Samsung',
    'Galaxy Watch3',
    ARRAY['41mm', '45mm']::text[],
    ARRAY['bluetooth', 'bluetooth_lte']::text[],
    ARRAY[8]::int[],
    ARRAY['Mystic Bronze', 'Mystic Black', 'Mystic Silver']::text[]
);

SELECT telefonak_seed_watch_model(
    'Samsung',
    'Galaxy Watch4',
    ARRAY['40mm', '44mm']::text[],
    ARRAY['bluetooth', 'bluetooth_lte']::text[],
    ARRAY[16]::int[],
    ARRAY['Black', 'Green', 'Silver', 'Pink Gold']::text[]
);

SELECT telefonak_seed_watch_model(
    'Samsung',
    'Galaxy Watch4 Classic',
    ARRAY['42mm', '46mm']::text[],
    ARRAY['bluetooth', 'bluetooth_lte']::text[],
    ARRAY[16]::int[],
    ARRAY['Black', 'Silver']::text[]
);

SELECT telefonak_seed_watch_model(
    'Samsung',
    'Galaxy Watch5',
    ARRAY['40mm', '44mm']::text[],
    ARRAY['bluetooth', 'bluetooth_lte']::text[],
    ARRAY[16]::int[],
    ARRAY['Graphite', 'Sapphire', 'Silver', 'Pink Gold']::text[]
);

SELECT telefonak_seed_watch_model(
    'Samsung',
    'Galaxy Watch5 Pro',
    ARRAY['45mm']::text[],
    ARRAY['bluetooth', 'bluetooth_lte']::text[],
    ARRAY[16]::int[],
    ARRAY['Black Titanium', 'Gray Titanium']::text[]
);

SELECT telefonak_seed_watch_model(
    'Samsung',
    'Galaxy Watch6',
    ARRAY['40mm', '44mm']::text[],
    ARRAY['bluetooth', 'bluetooth_lte']::text[],
    ARRAY[16]::int[],
    ARRAY['Graphite', 'Silver', 'Gold']::text[]
);

SELECT telefonak_seed_watch_model(
    'Samsung',
    'Galaxy Watch6 Classic',
    ARRAY['43mm', '47mm']::text[],
    ARRAY['bluetooth', 'bluetooth_lte']::text[],
    ARRAY[16]::int[],
    ARRAY['Black', 'Silver']::text[]
);

SELECT telefonak_seed_watch_model(
    'Samsung',
    'Galaxy Watch FE',
    ARRAY['40mm']::text[],
    ARRAY['bluetooth', 'bluetooth_lte']::text[],
    ARRAY[16]::int[],
    ARRAY['Black', 'Pink Gold', 'Silver']::text[]
);

SELECT telefonak_seed_watch_model(
    'Samsung',
    'Galaxy Watch7',
    ARRAY['40mm', '44mm']::text[],
    ARRAY['bluetooth', 'bluetooth_lte']::text[],
    ARRAY[32]::int[],
    ARRAY['Green', 'Cream', 'Silver']::text[]
);

SELECT telefonak_seed_watch_model(
    'Samsung',
    'Galaxy Watch Ultra',
    ARRAY['47mm']::text[],
    ARRAY['bluetooth', 'bluetooth_lte']::text[],
    ARRAY[32]::int[],
    ARRAY['Titanium Silver', 'Titanium Gray', 'Titanium White']::text[]
);

SELECT telefonak_seed_watch_model(
    'Samsung',
    'Galaxy Watch8',
    ARRAY['40mm', '44mm']::text[],
    ARRAY['bluetooth', 'bluetooth_lte']::text[],
    ARRAY[32]::int[],
    ARRAY['Graphite', 'Silver']::text[]
);

SELECT telefonak_seed_watch_model(
    'Samsung',
    'Galaxy Watch8 Classic',
    ARRAY['46mm']::text[],
    ARRAY['bluetooth', 'bluetooth_lte']::text[],
    ARRAY[64]::int[],
    ARRAY['Black', 'White']::text[]
);

SELECT telefonak_seed_watch_model(
    'Samsung',
    'Galaxy Watch9',
    ARRAY['40mm', '44mm']::text[],
    ARRAY['bluetooth', 'bluetooth_lte']::text[],
    ARRAY[32]::int[],
    ARRAY['Graphite', 'Cream', 'Silver']::text[]
);

SELECT telefonak_seed_watch_model(
    'Samsung',
    'Galaxy Watch Ultra2',
    ARRAY['47mm']::text[],
    ARRAY['bluetooth', 'bluetooth_lte']::text[],
    ARRAY[64]::int[],
    ARRAY['Titanium Silver', 'Titanium Gray']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH',
    ARRAY['42mm']::text[],
    ARRAY['bluetooth']::text[],
    ARRAY[4]::int[],
    ARRAY['Stainless Steel', 'Space Black||Black-plated Stainless Steel', 'Rose Gold||Rose gold-plated Stainless Steel']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH 2',
    '{}'::text[],
    ARRAY['gps', 'gps_cellular']::text[],
    ARRAY[4]::int[],
    ARRAY['Carbon Crystal Black']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH 2 Classic',
    '{}'::text[],
    '{}'::text[],
    '{}'::int[],
    '{}'::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH 3',
    ARRAY['46mm']::text[],
    ARRAY['gps', 'gps_cellular']::text[],
    ARRAY[16]::int[],
    '{}'::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH 3 Pro',
    ARRAY['48mm']::text[],
    ARRAY['gps', 'gps_cellular']::text[],
    ARRAY[16]::int[],
    ARRAY['Brown', 'Silver']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH 4',
    '{}'::text[],
    ARRAY['gps', 'gps_cellular']::text[],
    '{}'::int[],
    ARRAY['Black']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH 4 Pro',
    '{}'::text[],
    ARRAY['gps', 'gps_cellular']::text[],
    '{}'::int[],
    '{}'::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH 5',
    ARRAY['42mm', '46mm']::text[],
    ARRAY['gps', 'gps_cellular']::text[],
    '{}'::int[],
    ARRAY['Purple', 'Silver', 'Brown', 'Blue', 'Black', 'Beige', 'Sand Gold', 'White', 'Green']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH GT',
    ARRAY['42mm', '46mm']::text[],
    ARRAY['gps']::text[],
    '{}'::int[],
    ARRAY['Black||Black Stainless Steel', 'Silver||Stainless Steel', 'Gray||Titanium Grey Stainless Steel']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH GT 2',
    ARRAY['42mm', '46mm']::text[],
    ARRAY['gps']::text[],
    '{}'::int[],
    ARRAY['Black||Black Stainless Steel', 'Silver||Stainless Steel', 'Gray||Titanium Grey Stainless Steel', 'Rose Gold||Rose Gold Stainless Steel']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH GT 2e',
    '{}'::text[],
    ARRAY['gps']::text[],
    ARRAY[4]::int[],
    ARRAY['Black||Black Stainless Steel', 'Silver||Stainless Steel']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH GT 2 Pro',
    '{}'::text[],
    ARRAY['gps']::text[],
    ARRAY[4]::int[],
    ARRAY['Night Black', 'Nebula Gray']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH GT 3',
    ARRAY['42mm', '46mm']::text[],
    ARRAY['gps']::text[],
    ARRAY[4]::int[],
    ARRAY['Black', 'Silver||Steel', 'Gold']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH GT 3 SE',
    ARRAY['46mm']::text[],
    ARRAY['gps']::text[],
    '{}'::int[],
    ARRAY['Graphite||Graphite Black', 'Green||Wilderness Green']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH GT 3 Pro',
    ARRAY['43mm', '46mm']::text[],
    ARRAY['gps']::text[],
    '{}'::int[],
    ARRAY['White||White Ceramic', 'Black||Black Fluoroelastomer', 'Gray||Gray Leather', 'Natural Titanium||Titanium']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH GT Runner',
    ARRAY['46mm']::text[],
    ARRAY['gps']::text[],
    '{}'::int[],
    ARRAY['Gray||Grey']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH GT Runner 2',
    '{}'::text[],
    ARRAY['gps']::text[],
    '{}'::int[],
    ARRAY['Dusk Blue', 'Dawn Orange', 'Midnight Black']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH GT Cyber',
    '{}'::text[],
    ARRAY['gps']::text[],
    '{}'::int[],
    ARRAY['Midnight Black', 'Space Gray||Space Grey', 'Sunrise Yellow']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH GT 4',
    ARRAY['41mm', '46mm']::text[],
    ARRAY['gps']::text[],
    '{}'::int[],
    '{}'::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH GT 5',
    ARRAY['41mm', '46mm']::text[],
    ARRAY['gps']::text[],
    '{}'::int[],
    '{}'::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH GT 5 Pro',
    ARRAY['42mm', '46mm']::text[],
    ARRAY['gps']::text[],
    '{}'::int[],
    ARRAY['Black', 'White']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH GT 6',
    ARRAY['41mm', '46mm']::text[],
    ARRAY['gps']::text[],
    '{}'::int[],
    '{}'::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH GT 6 Pro',
    '{}'::text[],
    ARRAY['gps']::text[],
    '{}'::int[],
    ARRAY['Black', 'Brown', 'Natural Titanium||Titanium']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH Ultimate',
    '{}'::text[],
    ARRAY['gps']::text[],
    '{}'::int[],
    ARRAY['Green||Green edition', 'Blue||Blue edition', 'Black||Black edition']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH Ultimate Design',
    '{}'::text[],
    ARRAY['gps']::text[],
    '{}'::int[],
    '{}'::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH Ultimate 2',
    '{}'::text[],
    ARRAY['gps', 'gps_cellular']::text[],
    '{}'::int[],
    ARRAY['Black', 'Blue', 'Green']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH FIT',
    '{}'::text[],
    ARRAY['gps']::text[],
    ARRAY[4]::int[],
    ARRAY['Graphite||Graphite Black', 'Mint', 'Melon', 'Sakura']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH FIT 2',
    '{}'::text[],
    ARRAY['bluetooth']::text[],
    '{}'::int[],
    ARRAY['Midnight Black', 'Sakura Pink', 'Isle Blue', 'Nebula Gray', 'Moon White']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH FIT SE',
    '{}'::text[],
    ARRAY['gps']::text[],
    '{}'::int[],
    ARRAY['Starry Black', 'Nebula Pink', 'Forest Green']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH FIT 3',
    '{}'::text[],
    ARRAY['gps']::text[],
    '{}'::int[],
    ARRAY['White', 'Gray||Grey', 'Green', 'Pink', 'Black']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH FIT 4',
    '{}'::text[],
    ARRAY['gps']::text[],
    '{}'::int[],
    ARRAY['Purple', 'Gray||Grey', 'White', 'Black']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH FIT 4 Pro',
    '{}'::text[],
    ARRAY['gps']::text[],
    '{}'::int[],
    ARRAY['Green', 'Blue', 'Black']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH FIT 5',
    '{}'::text[],
    ARRAY['gps']::text[],
    ARRAY[64]::int[],
    ARRAY['Silver', 'Purple', 'Green', 'White', 'Black']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH FIT 5 Pro',
    '{}'::text[],
    ARRAY['gps']::text[],
    ARRAY[64]::int[],
    ARRAY['Orange', 'White', 'Black']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH D',
    '{}'::text[],
    ARRAY['gps']::text[],
    '{}'::int[],
    ARRAY['Graphite||Graphite Black']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH D2',
    '{}'::text[],
    ARRAY['gps']::text[],
    '{}'::int[],
    ARRAY['Blue', 'Black', 'Gold']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH Buds',
    '{}'::text[],
    ARRAY['gps']::text[],
    '{}'::int[],
    ARRAY['Black', 'Khaki']::text[]
);

SELECT telefonak_seed_watch_model(
    'Huawei',
    'HUAWEI WATCH Buds 2',
    '{}'::text[],
    ARRAY['gps']::text[],
    '{}'::int[],
    ARRAY['Black', 'Brown']::text[]
);

DROP FUNCTION telefonak_seed_watch_model(TEXT, TEXT, TEXT[], TEXT[], INT[], TEXT[]);

COMMIT;
