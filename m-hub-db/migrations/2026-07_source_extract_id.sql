-- Migration: add source_extract_id to building_parts + building_objects.
--
-- Fresh installs already get this column from init/03_building_parts.sql and
-- init/04_building_objects.sql. This script applies the same change to an
-- already-running database (prod). Idempotent — safe to run more than once.
--
-- Apply on the server:
--   docker-compose exec -T m-hub-db psql -U "$POSTGRES_USER" -d mhubdb < 2026-07_source_extract_id.sql

BEGIN;

ALTER TABLE building_parts   ADD COLUMN IF NOT EXISTS source_extract_id UUID;
ALTER TABLE building_objects ADD COLUMN IF NOT EXISTS source_extract_id UUID;

CREATE INDEX IF NOT EXISTS idx_building_parts_source_extract
    ON building_parts(source_extract_id)
    WHERE source_extract_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_building_objects_source_extract
    ON building_objects(source_extract_id)
    WHERE source_extract_id IS NOT NULL;

COMMIT;
