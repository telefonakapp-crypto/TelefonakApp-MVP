-- Phone Brands
CREATE TABLE IF NOT EXISTS brands (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Phone Models
CREATE TABLE IF NOT EXISTS models (
    id SERIAL PRIMARY KEY,
    brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    release_year INTEGER,
    chipset VARCHAR(100),
    screen_size DECIMAL(4,2), -- in inches
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(brand_id, name)
);

-- Storage Options
CREATE TABLE IF NOT EXISTS storage_options (
    id SERIAL PRIMARY KEY,
    capacity_gb INTEGER UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Color Options
CREATE TABLE IF NOT EXISTS colors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    hex_code VARCHAR(7),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Condition Options
CREATE TABLE IF NOT EXISTS conditions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(30) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Listings
CREATE TABLE IF NOT EXISTS listings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_id INTEGER NOT NULL REFERENCES models(id) ON DELETE RESTRICT,
    storage_id INTEGER NOT NULL REFERENCES storage_options(id) ON DELETE RESTRICT,
    color_id INTEGER NOT NULL REFERENCES colors(id) ON DELETE RESTRICT,
    condition_id INTEGER NOT NULL REFERENCES conditions(id) ON DELETE RESTRICT,
    battery_percentage INTEGER CHECK (battery_percentage >= 70 AND battery_percentage <= 100),
    price DECIMAL(10,2) NOT NULL CHECK (price > 0),
    description TEXT,
    location VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'sold', 'deleted')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Listing Images
CREATE TABLE IF NOT EXISTS listing_images (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_listings_user ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_model ON listings(model_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_created ON listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_images_listing ON listing_images(listing_id);
CREATE INDEX IF NOT EXISTS idx_models_brand ON models(brand_id);

-- Insert default data: Conditions
-- Note: Use update_conditions.sql script to migrate existing database
INSERT INTO conditions (name) VALUES 
    ('New'),
    ('Used - Like New'),
    ('Used - Good'),
    ('Used - Fair')
ON CONFLICT (name) DO NOTHING;

-- Insert default data: Storage Options
INSERT INTO storage_options (capacity_gb) VALUES 
    (64), (128), (256), (512), (1024)
ON CONFLICT (capacity_gb) DO NOTHING;

-- Insert default data: Colors (iPhone colors)
INSERT INTO colors (name, hex_code) VALUES 
    ('Space Gray', '#1F1F21'),
    ('Silver', '#E4E4E2'),
    ('Gold', '#FAD5A5'),
    ('Rose Gold', '#F5D7D3'),
    ('Blue', '#4A90E2'),
    ('Purple', '#B8AFE6'),
    ('Red', '#FF3B30'),
    ('Green', '#34C759'),
    ('White', '#FFFFFF'),
    ('Black', '#000000'),
    ('Pink', '#FF69B4'),
    ('Yellow', '#FFD700'),
    ('Midnight', '#1C1C1E'),
    ('Starlight', '#F5F5F7'),
    ('Alpine Green', '#576956'),
    ('Sierra Blue', '#9BB5CE'),
    ('Deep Purple', '#4E4E57')
ON CONFLICT (name) DO NOTHING;

-- Insert Apple Brand
INSERT INTO brands (name) VALUES ('Apple')
ON CONFLICT (name) DO NOTHING;

-- Insert iPhone Models (Recent models)
DO $$
DECLARE
    apple_brand_id INTEGER;
BEGIN
    SELECT id INTO apple_brand_id FROM brands WHERE name = 'Apple';
    
    IF apple_brand_id IS NOT NULL THEN
        INSERT INTO models (brand_id, name, release_year, chipset, screen_size) VALUES
            (apple_brand_id, 'iPhone 15 Pro Max', 2023, 'A17 Pro', 6.7),
            (apple_brand_id, 'iPhone 15 Pro', 2023, 'A17 Pro', 6.1),
            (apple_brand_id, 'iPhone 15 Plus', 2023, 'A16 Bionic', 6.7),
            (apple_brand_id, 'iPhone 15', 2023, 'A16 Bionic', 6.1),
            (apple_brand_id, 'iPhone 14 Pro Max', 2022, 'A16 Bionic', 6.7),
            (apple_brand_id, 'iPhone 14 Pro', 2022, 'A16 Bionic', 6.1),
            (apple_brand_id, 'iPhone 14 Plus', 2022, 'A15 Bionic', 6.7),
            (apple_brand_id, 'iPhone 14', 2022, 'A15 Bionic', 6.1),
            (apple_brand_id, 'iPhone 13 Pro Max', 2021, 'A15 Bionic', 6.7),
            (apple_brand_id, 'iPhone 13 Pro', 2021, 'A15 Bionic', 6.1),
            (apple_brand_id, 'iPhone 13 Mini', 2021, 'A15 Bionic', 5.4),
            (apple_brand_id, 'iPhone 13', 2021, 'A15 Bionic', 6.1),
            (apple_brand_id, 'iPhone 12 Pro Max', 2020, 'A14 Bionic', 6.7),
            (apple_brand_id, 'iPhone 12 Pro', 2020, 'A14 Bionic', 6.1),
            (apple_brand_id, 'iPhone 12 Mini', 2020, 'A14 Bionic', 5.4),
            (apple_brand_id, 'iPhone 12', 2020, 'A14 Bionic', 6.1),
            (apple_brand_id, 'iPhone 11 Pro Max', 2019, 'A13 Bionic', 6.5),
            (apple_brand_id, 'iPhone 11 Pro', 2019, 'A13 Bionic', 5.8),
            (apple_brand_id, 'iPhone 11', 2019, 'A13 Bionic', 6.1),
            (apple_brand_id, 'iPhone XS Max', 2018, 'A12 Bionic', 6.5),
            (apple_brand_id, 'iPhone XS', 2018, 'A12 Bionic', 5.8),
            (apple_brand_id, 'iPhone XR', 2018, 'A12 Bionic', 6.1),
            (apple_brand_id, 'iPhone X', 2017, 'A11 Bionic', 5.8)
        ON CONFLICT (brand_id, name) DO NOTHING;
    END IF;
END $$;

