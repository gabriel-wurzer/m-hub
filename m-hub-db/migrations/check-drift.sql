-- Read-only: is either migration needed on THIS database? Run on prod.
--   docker-compose exec -T m-hub-db psql -U "$POSTGRES_USER" -d mhubdb < check-drift.sql
--
-- Interpretation (all four "ok" columns should be TRUE / 3 on an up-to-date DB):
--   parts_source_extract  = f  -> run 2026-07_source_extract_id.sql
--   objects_source_extract = f -> run 2026-07_source_extract_id.sql
--   objects_dimensions    < 3  -> run 2026-07_building_objects_reconcile.sql
--   objects_inline_images > 0  -> run 2026-07_building_objects_reconcile.sql
--   has_images_table      = f  -> run 2026-07_building_objects_reconcile.sql
-- If everything is already fine, neither migration is needed (both are no-ops anyway).

SELECT
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'building_parts'  AND column_name = 'source_extract_id') > 0  AS parts_source_extract,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'building_objects' AND column_name = 'source_extract_id') > 0  AS objects_source_extract,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'building_objects' AND column_name IN ('length','width','height')) AS objects_dimensions,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'building_objects' AND column_name LIKE 'image_%')             AS objects_inline_images,
  to_regclass('public.building_object_images') IS NOT NULL                             AS has_images_table;
