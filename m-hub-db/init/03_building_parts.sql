-- ===============================================
--  Building Parts (Bauteile) Table Initialization Script
-- ===============================================

-- ===============================================
--  TABLE DEFINITION
-- ===============================================
CREATE TABLE IF NOT EXISTS building_parts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id TEXT NOT NULL,
    user_building_id UUID NOT NULL,
    owner_id UUID NOT NULL,
    category TEXT NOT NULL DEFAULT 'Bauteil',
    name TEXT NOT NULL,
    description TEXT,
    location TEXT,
    part_type TEXT,
    part_structure TEXT, -- Platzhalter für das zukünftige Modell
    is_public BOOLEAN NOT NULL DEFAULT FALSE
);

-- ===============================================
--  FOREIGN KEYS
-- ===============================================
ALTER TABLE building_parts
  ADD CONSTRAINT fk_parts_user_building
  FOREIGN KEY (user_building_id)
  REFERENCES user_buildings(id)
  ON DELETE CASCADE;

-- ===============================================
--  INITIAL DATA INSERTS
-- ===============================================
INSERT INTO building_parts (
    building_id,
    user_building_id,
    owner_id,
    category,
    name,
    description,
    location,
    part_type,
    is_public
)
SELECT 
    src.building_id,
    ub.id AS user_building_id,
    src.owner_id,
    src.category,
    src.name,
    src.description,
    src.location,
    src.part_type,
    src.is_public
FROM (
    VALUES
    -- building_id, owner_id, category, location, name, description, part_type, is_public
    ('5312213', '79e7432d-f1a0-4f31-9469-1e27b8d8c6cd'::uuid, 'Bauteil', 'RG1', 'Außenwand', 'Wandaufbau des Kellers', 'Wand', FALSE),
    ('5397325', 'c3e5b0fc-cc48-4a6f-8e27-135b6d3a1b71'::uuid, 'Bauteil', 'KG1', 'Kaminwand', 'Kaminwand des Gebäudes', 'Wand', TRUE),
    ('5397325', 'c3e5b0fc-cc48-4a6f-8e27-135b6d3a1b71'::uuid, 'Bauteil', 'KG2', 'Gebäudefundament', 'Fundament des Gebäudes', 'Boden', FALSE),
    ('5363852', 'c3e5b0fc-cc48-4a6f-8e27-135b6d3a1b71'::uuid, 'Bauteil', 'RG3', 'Aufzugsschachtwand', 'Aufzugsschacht', 'Wand', TRUE),
    ('5363852', 'e2f64296-77ce-4cf9-9436-29f6d3a7d9ea'::uuid, 'Bauteil', 'D', 'Dach', 'Dach des Gebäudes', 'Dachaufbau', FALSE)
) AS src(building_id, owner_id, category, location, name, description, part_type, is_public)
JOIN user_buildings ub 
  ON ub.building_id = src.building_id 
  AND ub.user_id = src.owner_id;  