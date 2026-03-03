-- ===============================================
--  Building Objects (Objekte) Table Initialization Script
-- ===============================================

-- ===============================================
--  TABLE DEFINITION
-- ===============================================
CREATE TABLE IF NOT EXISTS building_objects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id TEXT NOT NULL,
    user_building_id UUID NOT NULL,
    owner_id UUID NOT NULL,
    category TEXT NOT NULL DEFAULT 'Objekt',
    name TEXT NOT NULL,
    description TEXT,
    location TEXT,
    object_type TEXT,
    count INTEGER NOT NULL DEFAULT 1,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    is_hazardous BOOLEAN NOT NULL DEFAULT FALSE,
    image_path TEXT,
    image_mime_type TEXT,
    image_original_name TEXT,
    image_size_bytes INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================================
--  FOREIGN KEYS
-- ===============================================
ALTER TABLE building_objects
  ADD CONSTRAINT fk_objects_user_building
  FOREIGN KEY (user_building_id)
  REFERENCES user_buildings(id)
  ON DELETE CASCADE;

-- ===============================================
--  INITIAL DATA INSERTS
-- ===============================================
INSERT INTO building_objects (
    building_id,
    user_building_id,
    owner_id,
    category,
    name,
    description,
    location,
    object_type,
    count,
    is_public,
    is_hazardous
)
SELECT 
    src.building_id,
    ub.id AS user_building_id,
    src.owner_id,
    src.category,
    src.name,
    src.description,
    src.location,
    src.object_type,
    src.count,
    src.is_public,
    src.is_hazardous
FROM (
    VALUES
    -- building_id, owner_id, category, location, name, description, object_type, count, is_public
    ('5363852', 'e2f64296-77ce-4cf9-9436-29f6d3a7d9ea'::uuid, 'Objekt', 'Individuell' , 'Eingangstüre', 'Haupteingangstüre des Gebäudes. Befindet sich im Eingangsbereich des EG.', 'Tür', 1, TRUE, FALSE),
    ('5363852', 'e2f64296-77ce-4cf9-9436-29f6d3a7d9ea'::uuid, 'Objekt', 'Dach', 'Dachfenster', NULL, 'Fenster', 8, FALSE, FALSE),
    ('5363852', 'e2f64296-77ce-4cf9-9436-29f6d3a7d9ea'::uuid, 'Objekt', 'Kellergeschoss 1', 'Heizkessel', 'Hauptheizkessel des Gebäudes', 'Sonstige', 1, FALSE, TRUE),
    ('5312213', 'c3e5b0fc-cc48-4a6f-8e27-135b6d3a1b71'::uuid, 'Objekt', 'Regelgeschoss 1', 'Antenne', 'Antennenanlage auf dem Dach', 'Sonstige', 1, TRUE, FALSE),
    ('5397325', 'c3e5b0fc-cc48-4a6f-8e27-135b6d3a1b71'::uuid, 'Objekt', 'Kellergeschoss 2', 'Heizkessel', 'Hauptheizkessel des Gebäudes', 'Sonstige', 1, FALSE, TRUE),
    ('5397325', 'c3e5b0fc-cc48-4a6f-8e27-135b6d3a1b71'::uuid, 'Objekt', 'Regelgeschoss 2', 'Waschbecken', 'Waschbecken aus Keramik. Befindet sich in allen Geschossen des Regelgeschoss 2', 'Sonstige', 3, TRUE, FALSE)
) AS src(building_id, owner_id, category, location, name, description, object_type, count, is_public, is_hazardous)
JOIN user_buildings ub 
  ON ub.building_id = src.building_id 
  AND ub.user_id = src.owner_id;

-- ===============================================
--  UPDATE TRIGGER LOGIC
-- ===============================================
CREATE OR REPLACE FUNCTION update_building_objects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_building_objects_set_updated_at
BEFORE UPDATE ON building_objects
FOR EACH ROW
WHEN (NEW IS DISTINCT FROM OLD)
EXECUTE FUNCTION update_building_objects_updated_at();
