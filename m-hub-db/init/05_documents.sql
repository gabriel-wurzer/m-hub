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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================================
--  FOREIGN KEYS
-- ===============================================
ALTER TABLE documents
  ADD CONSTRAINT fk_documents_user_building
  FOREIGN KEY (user_building_id)
  REFERENCES user_buildings(id)
  ON DELETE CASCADE;

-- ALTER TABLE documents
--   ADD CONSTRAINT fk_documents_component
--   FOREIGN KEY (component_id)
--   REFERENCES building_parts(id) -- or building_objects(id)
--   ON DELETE SET NULL;

-- ===============================================
--  FILE TYPE CONSTRAINT MIGRATION
--  Remove legacy checks and enforce one canonical file_type check
-- ===============================================
DO $$
DECLARE
  constraint_row RECORD;
BEGIN
  FOR constraint_row IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'documents'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%file_type%'
  LOOP
    EXECUTE format('ALTER TABLE documents DROP CONSTRAINT IF EXISTS %I;', constraint_row.conname);
  END LOOP;
END;
$$;

ALTER TABLE documents
ADD CONSTRAINT documents_file_type_check
CHECK (
  file_type IS NULL OR file_type IN (
    'jpg', 'png', 'gif', 'bmp', 'tiff', 'svg', 'webp',
    'pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'html', 'md',
    'csv', 'xlsx', 'xlsm',
    'e57', 'obj', 'stl', 'ply', 'glb', 'gltf', 'fbx', 'ifc'
  )
);

-- ===============================================
--  INITIAL DATA INSERTS
--  Insert documents dynamically for each user_building
-- ===============================================
INSERT INTO documents (
    building_id,
    user_building_id,
    component_id,
    owner_id,
    name,
    description,
    is_public,
    file_url,
    file_type
)
SELECT
    doc.building_id,
    ub.id AS user_building_id,
    bp.id AS component_id,
    doc.owner_id,
    doc.name,
    doc.description,
    doc.is_public,
    doc.file_url,
    doc.file_type
FROM (
    VALUES
    -- building_id, owner_id, name, component_id, description, is_public, file_url, file_type
    ('5312213', '79e7432d-f1a0-4f31-9469-1e27b8d8c6cd'::uuid, 'Energieverbauchsbericht', NULL, NULL, FALSE, 'https://example.com/energy.pdf', 'pdf'),
    ('5397325', 'c3e5b0fc-cc48-4a6f-8e27-135b6d3a1b71'::uuid, 'Fundamentaufbau', 'Gebäudefundament', 'Aufbau der Kaminwand des Gebäudes', TRUE, 'https://example.com/blueprint.pdf', 'pdf'),
    ('5397325', 'c3e5b0fc-cc48-4a6f-8e27-135b6d3a1b71'::uuid, 'Bauplan', NULL, 'Architektonischer Bauplan des Gebäudes', TRUE, 'https://example.com/blueprint.pdf', 'pdf'),
    ('5363852', 'c3e5b0fc-cc48-4a6f-8e27-135b6d3a1b71'::uuid, 'Fluchtplan', NULL, 'Plan für Evakuierung des Gebäudes in einem Notfall', TRUE, 'https://example.com/evacuation.png', 'png'),
    ('5363852', 'e2f64296-77ce-4cf9-9436-29f6d3a7d9ea'::uuid, 'Protokoll: Schlossaustausch', NULL, NULL, FALSE, 'https://example.com/load_bearing.pdf', 'pdf'),
    ('5363852', 'c3e5b0fc-cc48-4a6f-8e27-135b6d3a1b71'::uuid, 'Brandschutzkonzept', NULL, 'Konzept für das Vorgehen in einem Brandfall', FALSE, 'https://example.com/fire_safety.pdf', 'pdf')
) AS doc(building_id, owner_id, name, target_component_name, description, is_public, file_url, file_type)
JOIN user_buildings ub
  ON ub.building_id = doc.building_id
 AND ub.user_id = doc.owner_id
LEFT JOIN building_parts bp 
  ON bp.name = doc.target_component_name 
  AND bp.user_building_id = ub.id;

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
