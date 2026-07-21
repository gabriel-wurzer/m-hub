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
    object_type TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    length DOUBLE PRECISION,
    width DOUBLE PRECISION,
    height DOUBLE PRECISION,
    -- set when the row originates from a 2D-plan import; groups all rows of one
    -- (document, storey) extract so a re-import can delete-and-reallocate them.
    source_extract_id UUID,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    is_hazardous BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT building_objects_building_id_not_blank CHECK (btrim(building_id) <> ''),
    CONSTRAINT building_objects_category_check CHECK (category = 'Objekt'),
    CONSTRAINT building_objects_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT building_objects_count_positive CHECK (count > 0),
    CONSTRAINT building_objects_length_positive CHECK (length IS NULL OR length > 0),
    CONSTRAINT building_objects_width_positive CHECK (width IS NULL OR width > 0),
    CONSTRAINT building_objects_height_positive CHECK (height IS NULL OR height > 0),
    CONSTRAINT building_objects_object_type_not_blank CHECK (btrim(object_type) <> ''),
    CONSTRAINT building_objects_object_type_check CHECK (
        object_type IN (
            U&'Abh\00E4ngung',
            U&'T\00FCr',
            'Zarge',
            'Fenster',
            U&'Heizk\00F6rper',
            'Rohre',
            'Kabel',
            'Sonstige'
        )
    ),
    CONSTRAINT fk_objects_user_building
        FOREIGN KEY (user_building_id)
        REFERENCES user_buildings(id)
        ON DELETE CASCADE
);

-- Fast lookup for the plan-import delete-and-reallocate (WHERE source_extract_id = ...).
CREATE INDEX IF NOT EXISTS idx_building_objects_source_extract
    ON building_objects(source_extract_id)
    WHERE source_extract_id IS NOT NULL;

-- Multiple images per object are stored in a dedicated child table instead of
-- duplicating image columns on building_objects.
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
    length,
    width,
    height,
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
    src.length,
    src.width,
    src.height,
    src.is_public,
    src.is_hazardous
FROM (
    VALUES
    -- building_id, owner_id, category, location, name, description, object_type, count, length, width, height, is_public, is_hazardous
    ('5363852', 'e2f64296-77ce-4cf9-9436-29f6d3a7d9ea'::uuid, 'Objekt', 'Individuell' , 'Eingangstüre', 'Haupteingangstüre des Gebäudes. Befindet sich im Eingangsbereich des EG.', 'Tür', 1, 210, 100, 20, TRUE, FALSE),
    ('5363852', 'e2f64296-77ce-4cf9-9436-29f6d3a7d9ea'::uuid, 'Objekt', 'Dach', 'Dachfenster', NULL, 'Fenster', 8, 120, 120, 10, FALSE, FALSE),
    ('5363852', 'e2f64296-77ce-4cf9-9436-29f6d3a7d9ea'::uuid, 'Objekt', 'Kellergeschoss 1', 'Heizkessel', 'Hauptheizkessel des Gebäudes', 'Sonstige', 1, 80, 120, 150, FALSE, TRUE),
    ('5312213', 'c3e5b0fc-cc48-4a6f-8e27-135b6d3a1b71'::uuid, 'Objekt', 'Regelgeschoss 1', 'Antenne', 'Antennenanlage auf dem Dach', 'Sonstige', 1, 25, 25, 160, TRUE, FALSE),
    ('5397325', 'c3e5b0fc-cc48-4a6f-8e27-135b6d3a1b71'::uuid, 'Objekt', 'Kellergeschoss 2', 'Heizkessel', 'Hauptheizkessel des Gebäudes', 'Sonstige', 1, 80, 120, 150, FALSE, TRUE),
    ('5397325', 'c3e5b0fc-cc48-4a6f-8e27-135b6d3a1b71'::uuid, 'Objekt', 'Regelgeschoss 2', 'Waschbecken', 'Waschbecken aus Keramik. Befindet sich in allen Geschossen des Regelgeschoss 2', 'Sonstige', 3, 70, 130, 110, TRUE, FALSE)
) AS src(building_id, owner_id, category, location, name, description, object_type, count, length, width, height, is_public, is_hazardous)
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

CREATE OR REPLACE FUNCTION update_building_object_images_updated_at()
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

CREATE TRIGGER trg_building_object_images_set_updated_at
BEFORE UPDATE ON building_object_images
FOR EACH ROW
WHEN (NEW IS DISTINCT FROM OLD)
EXECUTE FUNCTION update_building_object_images_updated_at();
