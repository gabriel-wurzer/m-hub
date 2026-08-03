-- ===============================================
--  Documents Table Initialization Script
-- ===============================================

-- ===============================================
--  TABLE DEFINITION
-- ===============================================
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id TEXT NOT NULL,
    owner_id UUID NOT NULL,
    user_building_id UUID NOT NULL,
    -- optional foreign key to component tables (if document attached to a specific component)
    component_id UUID,
    name TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    file_url TEXT,
    file_type TEXT,
    -- Point2IFC durabler Job-Status (siehe migrations/2026-08_p2i_columns.sql)
    p2i_job_id TEXT,
    p2i_status TEXT,
    p2i_result JSONB,
    p2i_error TEXT,
    p2i_started_at TIMESTAMPTZ,
    p2i_updated_at TIMESTAMPTZ,
    -- Upload-Resume (siehe migrations/2026-08_upload_resume.sql)
    file_original_name TEXT,
    file_size BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT documents_building_id_not_blank CHECK (btrim(building_id) <> ''),
    CONSTRAINT documents_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT documents_file_url_not_blank CHECK (
        file_url IS NULL OR btrim(file_url) <> ''
    ),
    CONSTRAINT documents_file_type_not_blank CHECK (
       file_type IS NULL OR btrim(file_type) <> ''
    ),
    CONSTRAINT documents_file_type_check CHECK (
        file_type IS NULL OR file_type IN (
            'jpg', 'png', 'gif', 'bmp', 'tiff', 'svg', 'webp',
            'pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'html', 'md',
            'csv', 'xlsx', 'xlsm',
            'e57', 'obj', 'stl', 'ply', 'glb', 'gltf', 'fbx', 'ifc', 'las', 'laz'
        )
    ),
    CONSTRAINT documents_p2i_status_check CHECK (
        p2i_status IS NULL OR p2i_status IN ('queued','running','done','error')
    ),
    CONSTRAINT fk_documents_user_building
        FOREIGN KEY (user_building_id)
        REFERENCES user_buildings(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_documents_owner
        FOREIGN KEY (owner_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);


-- ===============================================
--  UPDATE TRIGGER LOGIC
-- ===============================================
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_documents_set_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW
WHEN (NEW IS DISTINCT FROM OLD)
EXECUTE FUNCTION update_documents_updated_at();

-- Poller fragt nur die aktiven Point2IFC-Jobs ab -> partieller Index.
CREATE INDEX IF NOT EXISTS idx_documents_p2i_active
  ON documents (p2i_status) WHERE p2i_status IN ('queued','running');

-- Upload-Resume: hoechstens EINE offene Reservierung pro (owner, gebaeude, dateiname, groesse).
CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_open_reservation
  ON documents (owner_id, user_building_id, file_original_name, file_size)
  WHERE file_url IS NULL AND file_original_name IS NOT NULL AND file_size IS NOT NULL;
