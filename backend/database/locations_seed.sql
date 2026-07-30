-- ============================================================
-- Seed Jordan cities and common areas (idempotent)
-- ============================================================

INSERT INTO cities (slug, name_en, name_ar, sort_order) VALUES
    ('amman',   'Amman',   'عمان',    0),
    ('irbid',   'Irbid',   'إربد',    1),
    ('zarqa',   'Zarqa',   'الزرقاء', 2),
    ('aqaba',   'Aqaba',   'العقبة',  3),
    ('madaba',  'Madaba',  'مادبا',   4),
    ('salt',    'Salt',    'السلط',   5),
    ('jerash',  'Jerash',  'جرش',     6),
    ('ajloun',  'Ajloun',  'عجلون',   7),
    ('karak',   'Karak',   'الكرك',   8),
    ('maan',    'Ma''an',  'معان',    9),
    ('tafilah', 'Tafilah', 'الطفيلة', 10),
    ('mafraq',  'Mafraq',  'المفرق',  11)
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
    amman_id INTEGER;
BEGIN
    SELECT id INTO amman_id FROM cities WHERE slug = 'amman';
    IF amman_id IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO areas (city_id, slug, name_en, name_ar, sort_order) VALUES
        (amman_id, 'khalda',          'Khalda',          'خلدا',           0),
        (amman_id, 'abdoun',          'Abdoun',          'عبدون',          1),
        (amman_id, 'sweifieh',        'Sweifieh',        'الصويفية',       2),
        (amman_id, 'jabal-amman',     'Jabal Amman',     'جبل عمان',       3),
        (amman_id, 'jabal-hussein',   'Jabal Hussein',   'جبل الحسين',     4),
        (amman_id, 'shmeisani',       'Shmeisani',       'الشميساني',      5),
        (amman_id, 'dabouq',          'Dabouq',          'دابوق',          6),
        (amman_id, 'tlaa-al-ali',     'Tla''a Al Ali',   'تلاع العلي',     7),
        (amman_id, 'marj-al-hamam',   'Marj Al Hamam',   'مرج الحمام',     8),
        (amman_id, 'airport-road',    'Airport Road',    'شارع المطار',    9),
        (amman_id, 'marka',           'Marka',           'ماركا',         10),
        (amman_id, 'tabarbour',       'Tabarbour',       'طبربور',        11),
        (amman_id, 'abu-nsair',       'Abu Nsair',       'أبو نصير',      12),
        (amman_id, 'wadi-seer',       'Wadi Seer',       'وادي السير',    13),
        (amman_id, 'university-street','University Street','شارع الجامعة', 14),
        (amman_id, 'gardens',         'Gardens',         'الجاردنز',      15),
        (amman_id, 'jubaiha',         'Jubaiha',         'الجبيهة',       16),
        (amman_id, 'khalda-um-al-summaq', 'Um Al Summaq', 'أم السماق',   17)
    ON CONFLICT (city_id, slug) DO NOTHING;
END $$;

-- Lightweight backfill: match free-text listing.location to city/area names
UPDATE listings l
SET city_id = c.id
FROM cities c
WHERE l.city_id IS NULL
  AND l.location IS NOT NULL
  AND (
    l.location ILIKE '%' || c.name_en || '%'
    OR (c.name_ar IS NOT NULL AND l.location ILIKE '%' || c.name_ar || '%')
  );

UPDATE listings l
SET area_id = a.id,
    city_id = COALESCE(l.city_id, a.city_id)
FROM areas a
WHERE l.area_id IS NULL
  AND l.location IS NOT NULL
  AND (
    l.location ILIKE '%' || a.name_en || '%'
    OR (a.name_ar IS NOT NULL AND l.location ILIKE '%' || a.name_ar || '%')
  );
