-- Point2IFC: durabler Job-Status auf documents (Schritt 1).
-- Der Status lag bisher NUR im Python-RAM (job_api.py JOBS-dict) + im Angular-
-- Component-RAM. Bei OOM-Restart des point2ifc-Containers (mem_limit-Netz) ODER
-- Browser-Reload war ein laufender/fertiger Job unsichtbar (GET .../<id> -> 404,
-- obwohl das IFC am Volume liegt). Ab jetzt: Wahrheit in der DB, von node-red gepflegt.
-- Idempotent, gefahrlos mehrfach ausführbar (prod + lokal).

ALTER TABLE documents ADD COLUMN IF NOT EXISTS p2i_job_id     TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS p2i_status     TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS p2i_result     JSONB;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS p2i_error      TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS p2i_started_at TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS p2i_updated_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE documents ADD CONSTRAINT documents_p2i_status_check
    CHECK (p2i_status IS NULL OR p2i_status IN ('queued','running','done','error'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Poller fragt nur die aktiven Jobs ab -> partieller Index.
CREATE INDEX IF NOT EXISTS idx_documents_p2i_active
  ON documents (p2i_status) WHERE p2i_status IN ('queued','running');
