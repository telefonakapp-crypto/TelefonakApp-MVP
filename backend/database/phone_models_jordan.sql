-- Add all phone brands popular in Jordan
INSERT INTO brands (name) VALUES 
    ('Samsung'),
    ('Xiaomi'),
    ('Huawei'),
    ('Honor'),
    ('Oppo'),
    ('Vivo'),
    ('Realme'),
    ('OnePlus'),
    ('Google'),
    ('Nokia'),
    ('Motorola'),
    ('Tecno'),
    ('Infinix')
ON CONFLICT (name) DO NOTHING;

-- Samsung Models
DO $$
DECLARE
    samsung_brand_id INTEGER;
BEGIN
    SELECT id INTO samsung_brand_id FROM brands WHERE name = 'Samsung';
    
    IF samsung_brand_id IS NOT NULL THEN
        INSERT INTO models (brand_id, name, release_year, chipset, screen_size) VALUES
            -- Galaxy S Series
            (samsung_brand_id, 'Galaxy S24 Ultra', 2024, 'Snapdragon 8 Gen 3', 6.8),
            (samsung_brand_id, 'Galaxy S24+', 2024, 'Snapdragon 8 Gen 3', 6.7),
            (samsung_brand_id, 'Galaxy S24', 2024, 'Snapdragon 8 Gen 3', 6.2),
            (samsung_brand_id, 'Galaxy S23 Ultra', 2023, 'Snapdragon 8 Gen 2', 6.8),
            (samsung_brand_id, 'Galaxy S23+', 2023, 'Snapdragon 8 Gen 2', 6.6),
            (samsung_brand_id, 'Galaxy S23', 2023, 'Snapdragon 8 Gen 2', 6.1),
            (samsung_brand_id, 'Galaxy S22 Ultra', 2022, 'Snapdragon 8 Gen 1', 6.8),
            (samsung_brand_id, 'Galaxy S22+', 2022, 'Snapdragon 8 Gen 1', 6.6),
            (samsung_brand_id, 'Galaxy S22', 2022, 'Snapdragon 8 Gen 1', 6.1),
            (samsung_brand_id, 'Galaxy S21 Ultra', 2021, 'Snapdragon 888', 6.8),
            (samsung_brand_id, 'Galaxy S21+', 2021, 'Snapdragon 888', 6.7),
            (samsung_brand_id, 'Galaxy S21', 2021, 'Snapdragon 888', 6.2),
            -- Galaxy Note Series
            (samsung_brand_id, 'Galaxy Note 20 Ultra', 2020, 'Snapdragon 865+', 6.9),
            (samsung_brand_id, 'Galaxy Note 20', 2020, 'Snapdragon 865+', 6.7),
            -- Galaxy A Series
            (samsung_brand_id, 'Galaxy A54 5G', 2023, 'Exynos 1380', 6.4),
            (samsung_brand_id, 'Galaxy A34 5G', 2023, 'MediaTek Dimensity 1080', 6.6),
            (samsung_brand_id, 'Galaxy A24', 2023, 'MediaTek Helio G99', 6.5),
            (samsung_brand_id, 'Galaxy A14 5G', 2023, 'MediaTek Dimensity 700', 6.6),
            (samsung_brand_id, 'Galaxy A53 5G', 2022, 'Exynos 1280', 6.5),
            (samsung_brand_id, 'Galaxy A33 5G', 2022, 'Exynos 1280', 6.4),
            (samsung_brand_id, 'Galaxy A13', 2022, 'Exynos 850', 6.6),
            -- Galaxy Z Series (Foldables)
            (samsung_brand_id, 'Galaxy Z Fold 5', 2023, 'Snapdragon 8 Gen 2', 7.6),
            (samsung_brand_id, 'Galaxy Z Flip 5', 2023, 'Snapdragon 8 Gen 2', 6.7)
        ON CONFLICT (brand_id, name) DO NOTHING;
    END IF;
END $$;

-- Xiaomi Models
DO $$
DECLARE
    xiaomi_brand_id INTEGER;
BEGIN
    SELECT id INTO xiaomi_brand_id FROM brands WHERE name = 'Xiaomi';
    
    IF xiaomi_brand_id IS NOT NULL THEN
        INSERT INTO models (brand_id, name, release_year, chipset, screen_size) VALUES
            -- Mi Series
            (xiaomi_brand_id, 'Xiaomi 14 Pro', 2024, 'Snapdragon 8 Gen 3', 6.73),
            (xiaomi_brand_id, 'Xiaomi 14', 2024, 'Snapdragon 8 Gen 3', 6.36),
            (xiaomi_brand_id, 'Xiaomi 13 Pro', 2023, 'Snapdragon 8 Gen 2', 6.73),
            (xiaomi_brand_id, 'Xiaomi 13', 2023, 'Snapdragon 8 Gen 2', 6.36),
            (xiaomi_brand_id, 'Xiaomi 12 Pro', 2022, 'Snapdragon 8 Gen 1', 6.73),
            (xiaomi_brand_id, 'Xiaomi 12', 2022, 'Snapdragon 8 Gen 1', 6.28)
            -- Redmi / POCO live on their own brands in phone_catalog_seed.sql.
            -- Do not re-insert them under Xiaomi on every init (unique (brand_id, name)
            -- would recreate Xiaomi copies after they were moved to Redmi/POCO).
        ON CONFLICT (brand_id, name) DO NOTHING;
    END IF;
END $$;

-- Huawei Models
DO $$
DECLARE
    huawei_brand_id INTEGER;
BEGIN
    SELECT id INTO huawei_brand_id FROM brands WHERE name = 'Huawei';
    
    IF huawei_brand_id IS NOT NULL THEN
        INSERT INTO models (brand_id, name, release_year, chipset, screen_size) VALUES
            -- P Series
            (huawei_brand_id, 'Huawei P60 Pro', 2023, 'Snapdragon 8+ Gen 1', 6.67),
            (huawei_brand_id, 'Huawei P60', 2023, 'Snapdragon 8+ Gen 1', 6.67),
            (huawei_brand_id, 'Huawei P50 Pro', 2021, 'Kirin 9000', 6.6),
            (huawei_brand_id, 'Huawei P50', 2021, 'Snapdragon 888', 6.5),
            -- Mate Series
            (huawei_brand_id, 'Huawei Mate 60 Pro', 2023, 'Kirin 9000S', 6.82),
            (huawei_brand_id, 'Huawei Mate 50 Pro', 2022, 'Snapdragon 8+ Gen 1', 6.74),
            (huawei_brand_id, 'Huawei Mate 40 Pro', 2020, 'Kirin 9000', 6.76),
            -- Nova Series
            (huawei_brand_id, 'Huawei Nova 12', 2024, 'Kirin 8000', 6.7),
            (huawei_brand_id, 'Huawei Nova 11', 2023, 'Snapdragon 778G', 6.7),
            (huawei_brand_id, 'Huawei Nova 10', 2022, 'Snapdragon 778G', 6.67)
        ON CONFLICT (brand_id, name) DO NOTHING;
    END IF;
END $$;

-- Honor Models
DO $$
DECLARE
    honor_brand_id INTEGER;
BEGIN
    SELECT id INTO honor_brand_id FROM brands WHERE name = 'Honor';
    
    IF honor_brand_id IS NOT NULL THEN
        INSERT INTO models (brand_id, name, release_year, chipset, screen_size) VALUES
            (honor_brand_id, 'Honor Magic 6 Pro', 2024, 'Snapdragon 8 Gen 3', 6.8),
            (honor_brand_id, 'Honor Magic 5 Pro', 2023, 'Snapdragon 8 Gen 2', 6.81),
            (honor_brand_id, 'Honor 90', 2023, 'Snapdragon 7 Gen 1', 6.7),
            (honor_brand_id, 'Honor 80', 2022, 'Snapdragon 782G', 6.67),
            (honor_brand_id, 'Honor 70', 2022, 'Snapdragon 778G+', 6.67),
            (honor_brand_id, 'Honor X9a', 2023, 'Snapdragon 695', 6.67),
            (honor_brand_id, 'Honor X8', 2022, 'Snapdragon 680', 6.7)
        ON CONFLICT (brand_id, name) DO NOTHING;
    END IF;
END $$;

-- Oppo Models
DO $$
DECLARE
    oppo_brand_id INTEGER;
BEGIN
    SELECT id INTO oppo_brand_id FROM brands WHERE name = 'Oppo';
    
    IF oppo_brand_id IS NOT NULL THEN
        INSERT INTO models (brand_id, name, release_year, chipset, screen_size) VALUES
            (oppo_brand_id, 'Oppo Find X7 Ultra', 2024, 'Snapdragon 8 Gen 3', 6.82),
            (oppo_brand_id, 'Oppo Find X6 Pro', 2023, 'Snapdragon 8 Gen 2', 6.82),
            (oppo_brand_id, 'Oppo Find X5 Pro', 2022, 'Snapdragon 8 Gen 1', 6.7),
            (oppo_brand_id, 'Oppo Reno 11 Pro', 2024, 'MediaTek Dimensity 8200', 6.74),
            (oppo_brand_id, 'Oppo Reno 10', 2023, 'Snapdragon 778G', 6.7),
            (oppo_brand_id, 'Oppo A98', 2023, 'Snapdragon 695', 6.72),
            (oppo_brand_id, 'Oppo A78', 2023, 'Snapdragon 680', 6.43)
        ON CONFLICT (brand_id, name) DO NOTHING;
    END IF;
END $$;

-- Vivo Models
DO $$
DECLARE
    vivo_brand_id INTEGER;
BEGIN
    SELECT id INTO vivo_brand_id FROM brands WHERE name = 'Vivo';
    
    IF vivo_brand_id IS NOT NULL THEN
        INSERT INTO models (brand_id, name, release_year, chipset, screen_size) VALUES
            (vivo_brand_id, 'Vivo X100 Pro', 2024, 'MediaTek Dimensity 9300', 6.78),
            (vivo_brand_id, 'Vivo X90 Pro', 2023, 'MediaTek Dimensity 9200', 6.78),
            (vivo_brand_id, 'Vivo V30 Pro', 2024, 'MediaTek Dimensity 8200', 6.78),
            (vivo_brand_id, 'Vivo V29', 2023, 'Snapdragon 778G', 6.78),
            (vivo_brand_id, 'Vivo Y100', 2023, 'Snapdragon 695', 6.38),
            (vivo_brand_id, 'Vivo Y78', 2023, 'MediaTek Helio G99', 6.64)
        ON CONFLICT (brand_id, name) DO NOTHING;
    END IF;
END $$;

-- Realme Models
DO $$
DECLARE
    realme_brand_id INTEGER;
BEGIN
    SELECT id INTO realme_brand_id FROM brands WHERE name = 'Realme';
    
    IF realme_brand_id IS NOT NULL THEN
        INSERT INTO models (brand_id, name, release_year, chipset, screen_size) VALUES
            (realme_brand_id, 'Realme GT 5 Pro', 2024, 'Snapdragon 8 Gen 3', 6.78),
            (realme_brand_id, 'Realme GT 3', 2023, 'Snapdragon 8+ Gen 1', 6.74),
            (realme_brand_id, 'Realme 12 Pro+', 2024, 'Snapdragon 7s Gen 2', 6.7),
            (realme_brand_id, 'Realme 11 Pro', 2023, 'MediaTek Dimensity 7050', 6.7),
            (realme_brand_id, 'Realme C55', 2023, 'MediaTek Helio G88', 6.72),
            (realme_brand_id, 'Realme Narzo 70 Pro', 2024, 'MediaTek Dimensity 7050', 6.67)
        ON CONFLICT (brand_id, name) DO NOTHING;
    END IF;
END $$;

-- OnePlus Models
DO $$
DECLARE
    oneplus_brand_id INTEGER;
BEGIN
    SELECT id INTO oneplus_brand_id FROM brands WHERE name = 'OnePlus';
    
    IF oneplus_brand_id IS NOT NULL THEN
        INSERT INTO models (brand_id, name, release_year, chipset, screen_size) VALUES
            (oneplus_brand_id, 'OnePlus 12', 2024, 'Snapdragon 8 Gen 3', 6.82),
            (oneplus_brand_id, 'OnePlus 11', 2023, 'Snapdragon 8 Gen 2', 6.7),
            (oneplus_brand_id, 'OnePlus 10 Pro', 2022, 'Snapdragon 8 Gen 1', 6.7),
            (oneplus_brand_id, 'OnePlus Nord 3', 2023, 'MediaTek Dimensity 9000', 6.74),
            (oneplus_brand_id, 'OnePlus Nord CE 3', 2023, 'Snapdragon 782G', 6.7)
        ON CONFLICT (brand_id, name) DO NOTHING;
    END IF;
END $$;

-- Google Pixel Models
DO $$
DECLARE
    google_brand_id INTEGER;
BEGIN
    SELECT id INTO google_brand_id FROM brands WHERE name = 'Google';
    
    IF google_brand_id IS NOT NULL THEN
        INSERT INTO models (brand_id, name, release_year, chipset, screen_size) VALUES
            (google_brand_id, 'Pixel 8 Pro', 2023, 'Google Tensor G3', 6.7),
            (google_brand_id, 'Pixel 8', 2023, 'Google Tensor G3', 6.2),
            (google_brand_id, 'Pixel 7 Pro', 2022, 'Google Tensor G2', 6.7),
            (google_brand_id, 'Pixel 7', 2022, 'Google Tensor G2', 6.3),
            (google_brand_id, 'Pixel 6 Pro', 2021, 'Google Tensor', 6.7),
            (google_brand_id, 'Pixel 6', 2021, 'Google Tensor', 6.4)
        ON CONFLICT (brand_id, name) DO NOTHING;
    END IF;
END $$;

-- Nokia Models
DO $$
DECLARE
    nokia_brand_id INTEGER;
BEGIN
    SELECT id INTO nokia_brand_id FROM brands WHERE name = 'Nokia';
    
    IF nokia_brand_id IS NOT NULL THEN
        INSERT INTO models (brand_id, name, release_year, chipset, screen_size) VALUES
            (nokia_brand_id, 'Nokia G60 5G', 2022, 'Snapdragon 695', 6.58),
            (nokia_brand_id, 'Nokia X30 5G', 2022, 'Snapdragon 695', 6.43),
            (nokia_brand_id, 'Nokia G50', 2021, 'Snapdragon 480', 6.38)
        ON CONFLICT (brand_id, name) DO NOTHING;
    END IF;
END $$;

-- Motorola Models
DO $$
DECLARE
    motorola_brand_id INTEGER;
BEGIN
    SELECT id INTO motorola_brand_id FROM brands WHERE name = 'Motorola';
    
    IF motorola_brand_id IS NOT NULL THEN
        INSERT INTO models (brand_id, name, release_year, chipset, screen_size) VALUES
            (motorola_brand_id, 'Motorola Edge 40 Pro', 2023, 'Snapdragon 8 Gen 2', 6.67),
            (motorola_brand_id, 'Motorola Edge 30', 2022, 'Snapdragon 778G+', 6.5),
            (motorola_brand_id, 'Motorola Moto G84', 2023, 'Snapdragon 695', 6.5)
        ON CONFLICT (brand_id, name) DO NOTHING;
    END IF;
END $$;

