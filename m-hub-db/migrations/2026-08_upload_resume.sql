-- Upload-Resume (Phase 2): idempotenter reserve, damit ein abgebrochener Upload
-- beim Fortsetzen DIESELBE document-Zeile trifft statt neue Waisen zu erzeugen.
-- file_original_name + file_size werden gespeichert; ein partieller Unique-Index
-- erzwingt hoechstens EINE offene (noch nicht attachte) Reservierung pro
-- (owner, gebaeude, dateiname, groesse). Additiv + idempotent (prod + lokal).

ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_original_name TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_open_reservation
  ON documents (owner_id, user_building_id, file_original_name, file_size)
  WHERE file_url IS NULL AND file_original_name IS NOT NULL AND file_size IS NOT NULL;
