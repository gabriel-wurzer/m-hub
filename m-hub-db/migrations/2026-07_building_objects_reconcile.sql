-- Migration: reconcile a drifted building_objects to the current schema.
--
-- A long-lived database (the dev DB, possibly prod) predates two changes to
-- init/04_building_objects.sql:
--   1. length/width/height dimensions were added.
--   2. inline image_* columns were replaced by the building_object_images child
--      table.
-- On such a DB, the /api/objects endpoints error (missing columns / table).
--
-- This script brings it up to date. It is idempotent and safe to run on a
-- current schema (every step is guarded), and it migrates any existing inline
-- image data into the child table before dropping the old columns, so it is
-- safe for a prod DB that still holds images.
--
-- Apply:
--   docker-compose exec -T m-hub-db psql -U "$POSTGRES_USER" -d mhubdb < 2026-07_building_objects_reconcile.sql

BEGIN;

-- 1) dimensions -------------------------------------------------------------
ALTER TABLE building_objects ADD COLUMN IF NOT EXISTS length DOUBLE PRECISION;
ALTER TABLE building_objects ADD COLUMN IF NOT EXISTS width  DOUBLE PRECISION;
ALTER TABLE building_objects ADD COLUMN IF NOT EXISTS height DOUBLE PRECISION;

DO $$ BEGIN
  ALTER TABLE building_objects ADD CONSTRAINT building_objects_length_positive CHECK (length IS NULL OR length > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE building_objects ADD CONSTRAINT building_objects_width_positive CHECK (width IS NULL OR width > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE building_objects ADD CONSTRAINT building_objects_height_positive CHECK (height IS NULL OR height > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) images child table (mirrors init/04) -----------------------------------
CREATE TABLE IF NOT EXISTS building_object_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_object_id UUID NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    image_path TEXT NOT NULL,
    image_mime_type TEXT,
    image_original_name TEXT,
    image_size_bytes BIGINT CHECK (image_size_bytes IS NULL OR image_size_bytes >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT building_object_images_path_not_blank CHECK (btrim(image_path) <> ''),
    CONSTRAINT building_object_images_object_sort_order_unique UNIQUE (building_object_id, sort_order),
    CONSTRAINT fk_building_object_images_object
        FOREIGN KEY (building_object_id)
        REFERENCES building_objects(id)
        ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION update_building_object_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_building_object_images_set_updated_at ON building_object_images;
CREATE TRIGGER trg_building_object_images_set_updated_at
BEFORE UPDATE ON building_object_images
FOR EACH ROW
WHEN (NEW IS DISTINCT FROM OLD)
EXECUTE FUNCTION update_building_object_images_updated_at();

-- 3) migrate inline image data into the child table, then drop the old columns.
-- Guarded so it only runs where the old columns still exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'building_objects' AND column_name = 'image_path'
  ) THEN
    INSERT INTO building_object_images
      (building_object_id, sort_order, image_path, image_mime_type, image_original_name, image_size_bytes)
    SELECT id, 0, image_path, image_mime_type, image_original_name, image_size_bytes::bigint
    FROM building_objects
    WHERE image_path IS NOT NULL AND btrim(image_path) <> '';
  END IF;
END $$;

ALTER TABLE building_objects DROP COLUMN IF EXISTS image_path;
ALTER TABLE building_objects DROP COLUMN IF EXISTS image_mime_type;
ALTER TABLE building_objects DROP COLUMN IF EXISTS image_original_name;
ALTER TABLE building_objects DROP COLUMN IF EXISTS image_size_bytes;

COMMIT;
