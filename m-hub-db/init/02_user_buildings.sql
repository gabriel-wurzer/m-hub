-- ===============================================
--  Documents Table Initialization Script
-- ===============================================

-- ===============================================
--  TABLE DEFINITION
-- ===============================================
CREATE TABLE IF NOT EXISTS user_buildings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    building_id TEXT NOT NULL,
    structure JSONB NOT NULL,
    name TEXT,
    address TEXT
);

ALTER TABLE user_buildings
ADD CONSTRAINT unique_user_building UNIQUE (user_id, building_id);

-- ===============================================
--  INITIAL DATA INSERTS
-- ===============================================
INSERT INTO user_buildings (user_id, building_id, structure, name, address)
VALUES
('79e7432d-f1a0-4f31-9469-1e27b8d8c6cd'::uuid, '5312213',
 '[
    {"type": "Dach", "roofType": "Flachdach"},
    {"type": "Regelgeschoss", "count": 3, "height": 270, "area": 260},
    {"type": "Kellergeschoss", "count": 2, "height": 300, "area": 230}
 ]',
 'Flackturm Augarten',
 'Augarten 1'
),

('c3e5b0fc-cc48-4a6f-8e27-135b6d3a1b71'::uuid, '5397325',
 '[
    {"type": "Dach", "roofType": "Flachdach"},
    {"type": "Regelgeschoss", "count": 4, "height": 300, "area": 520},
    {"type": "Kellergeschoss", "count": 1, "height": 270, "area": 500}
 ]',
 'ÖBB Zentrale',
 NULL
),

('c3e5b0fc-cc48-4a6f-8e27-135b6d3a1b71'::uuid, '5363852',
 '[
    {"type": "Dach", "roofType": "Flachdach"},
    {"type": "Regelgeschoss", "count": 2, "height": 420, "area": 1020},
    {"type": "Kellergeschoss", "count": 1, "height": 240, "area": 1020}
 ]',
 'Bahnhof Praterstern',
 'Praterstern 6'
),

('e2f64296-77ce-4cf9-9436-29f6d3a7d9ea'::uuid, '5363852',
 '[
    {"type": "Dach", "roofType": "Flachdach"},
    {"type": "Regelgeschoss", "count": 2, "height": 420, "area": 1020},
    {"type": "Kellergeschoss", "count": 1, "height": 240, "area": 1020}
 ]',
 'BHF Praterstern',
 'Praterstern 6'
);

-- ===============================================
--  FOREIGN KEYS
-- ===============================================
ALTER TABLE user_buildings
  ADD CONSTRAINT fk_userbuildings_user
  FOREIGN KEY (user_id)
  REFERENCES users(id)
  ON DELETE CASCADE;
