-- ============================================================
-- Telefonak Catalog Migration
-- Backfills model_storage_id and model_color_id on listings
-- that were created before the Device Catalog was introduced.
--
-- Safe to run multiple times (idempotent).
-- Must run AFTER catalog_schema.sql and catalog_seed.sql.
-- ============================================================

-- Step 1: Sync storage_capacities with the legacy storage_options table.
-- Any storage value already in storage_options is added to storage_capacities
-- so that existing listing FKs can be resolved.
INSERT INTO storage_capacities (capacity_gb, label)
SELECT
    so.capacity_gb,
    CASE
        WHEN so.capacity_gb >= 1000 THEN (so.capacity_gb / 1024) || ' TB'
        ELSE so.capacity_gb || ' GB'
    END
FROM storage_options so
ON CONFLICT (capacity_gb) DO NOTHING;

-- Also sync the reverse direction: catalog capacities (16 GB, 32 GB, …) must
-- exist in legacy storage_options so create/edit listing inserts succeed.
INSERT INTO storage_options (capacity_gb)
SELECT DISTINCT sc.capacity_gb
FROM storage_capacities sc
ON CONFLICT (capacity_gb) DO NOTHING;

-- Step 2: For every unique (model_id, storage_gb) combination that
-- appears in existing listings, ensure a model_storages row exists.
-- This handles models not yet in the official catalog.
INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
SELECT DISTINCT
    l.model_id,
    sc.id,
    0
FROM listings l
JOIN storage_options  so ON so.id           = l.storage_id
JOIN storage_capacities sc ON sc.capacity_gb = so.capacity_gb
WHERE l.model_id IS NOT NULL
  AND l.storage_id IS NOT NULL
ON CONFLICT (model_id, storage_capacity_id) DO NOTHING;

-- Step 3: For every unique (model_id, color_id) combination that
-- appears in existing listings, ensure a model_colors row exists.
INSERT INTO model_colors (model_id, color_id, sort_order)
SELECT DISTINCT
    l.model_id,
    l.color_id,
    0
FROM listings l
WHERE l.model_id  IS NOT NULL
  AND l.color_id  IS NOT NULL
ON CONFLICT (model_id, color_id) DO NOTHING;

-- Step 4: Populate listings.model_storage_id where it is still NULL.
UPDATE listings l
SET    model_storage_id = ms.id
FROM   model_storages ms
JOIN   storage_capacities sc ON sc.id           = ms.storage_capacity_id
JOIN   storage_options    so ON so.capacity_gb  = sc.capacity_gb
WHERE  ms.model_id = l.model_id
  AND  so.id       = l.storage_id
  AND  l.model_storage_id IS NULL;

-- Step 5: Populate listings.model_color_id where it is still NULL.
UPDATE listings l
SET    model_color_id = mc.id
FROM   model_colors mc
WHERE  mc.model_id = l.model_id
  AND  mc.color_id = l.color_id
  AND  l.model_color_id IS NULL;

-- Step 6: sim_configuration_id intentionally left NULL for existing listings.
-- Sellers must select a SIM configuration the next time they edit the listing.
-- New listings require sim_configuration_id via API validation.
