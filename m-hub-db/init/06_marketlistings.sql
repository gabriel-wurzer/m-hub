-- ===============================================
--  Market Listings Table Initialization Script
-- ===============================================

-- ===============================================
--  TABLE DEFINITION
-- ===============================================
CREATE TABLE IF NOT EXISTS market_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id TEXT NOT NULL,
    owner_id UUID NOT NULL,
    user_building_id UUID NOT NULL,
    component_id UUID NOT NULL,
    component_category TEXT NOT NULL CHECK (component_category IN ('Bauteil', 'Objekt')),
    location TEXT,
    material TEXT,
    object_type TEXT,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL,
    status TEXT NOT NULL CHECK (
        status IN ('eingelagert', 'verbaut', 'verkauft')
    ),
    available_from DATE NOT NULL,
    potential TEXT NOT NULL CHECK (potential IN ('reuse', 'recycle')),
    quantity NUMERIC(14, 3) NOT NULL,
    unit TEXT NOT NULL CHECK (
        unit IN (U&'St\00FCck', 'Kubikmeter', 'Quadratmeter', 'Meter', 'Kilogramm')
    ),
    contact TEXT NOT NULL,
    length DOUBLE PRECISION CHECK (length IS NULL OR length > 0),
    width DOUBLE PRECISION CHECK (width IS NULL OR width > 0),
    height DOUBLE PRECISION CHECK (height IS NULL OR height > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT market_listings_building_id_not_blank CHECK (btrim(building_id) <> ''),
    CONSTRAINT market_listings_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT market_listings_address_not_blank CHECK (btrim(address) <> ''),
    CONSTRAINT market_listings_contact_not_blank CHECK (btrim(contact) <> ''),
    CONSTRAINT market_listings_price_non_negative CHECK (price >= 0),
    CONSTRAINT market_listings_quantity_positive CHECK (quantity > 0),
    CONSTRAINT market_listings_location_required_for_parts CHECK (component_category = 'Objekt' OR location IS NOT NULL),
    CONSTRAINT market_listings_location_not_blank CHECK (location IS NULL OR btrim(location) <> ''),
    CONSTRAINT market_listings_component_snapshot_check CHECK (
        (component_category = 'Bauteil' AND material IS NOT NULL AND object_type IS NULL)
        OR
        (component_category = 'Objekt' AND object_type IS NOT NULL AND material IS NULL)
    ),
    CONSTRAINT market_listings_material_check CHECK (
        material IS NULL OR material IN (
            'Aluminium',
            'Asphalt',
            'Beton',
            'Bitumen',
            U&'Bl\00E4hbeton',
            'Eternit',
            'Blei',
            'Diverse Kunststoffe',
            'Estrich',
            'Fliesen',
            'Fliesenkleber',
            'Glas',
            'Heraklith',
            'Holz',
            'Kautschuk',
            'Keramik',
            'Kupfer',
            'Laminat',
            'Linol',
            'Messing',
            'Mineralfaser',
            'Mineralwolle',
            U&'M\00F6rtel',
            'Naturstein',
            'Papier',
            'Putz',
            'PVC',
            'Rigips',
            'Schlacke',
            U&'Sch\00FCttung',
            'Stahl',
            'Steinzeug',
            'Stroh',
            'Styropor',
            'Teppich',
            'Terrazzo',
            'Ytong',
            'Ziegel'
        )
    ),
    CONSTRAINT market_listings_object_type_check CHECK (
        object_type Is NULL OR object_type IN (
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
    CONSTRAINT fk_market_listings_user_building
        FOREIGN KEY (user_building_id)
        REFERENCES user_buildings(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_market_listings_owner
        FOREIGN KEY (owner_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- Multiple images per listing are stored in a dedicated child table
CREATE TABLE IF NOT EXISTS market_listing_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    market_listing_id UUID NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    image_path TEXT NOT NULL,
    image_mime_type TEXT,
    image_original_name TEXT,
    image_size_bytes BIGINT CHECK (image_size_bytes IS NULL OR image_size_bytes >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT market_listing_images_path_not_blank CHECK (btrim(image_path) <> ''),
    CONSTRAINT market_listing_images_listing_sort_order_unique UNIQUE (market_listing_id, sort_order),
    CONSTRAINT fk_market_listing_images_listing
        FOREIGN KEY (market_listing_id)
        REFERENCES market_listings(id)
        ON DELETE CASCADE
);


-- ===============================================
--  UPDATE TRIGGER LOGIC
-- ===============================================
CREATE OR REPLACE FUNCTION set_market_listing_address_from_user_building()
RETURNS TRIGGER AS $$
DECLARE
    resolved_address TEXT;
BEGIN
    SELECT address
    INTO resolved_address
    FROM user_buildings
    WHERE id = NEW.user_building_id
      AND user_id = NEW.owner_id
      AND building_id = NEW.building_id;

    IF resolved_address IS NULL OR btrim(resolved_address) = '' THEN
        RAISE EXCEPTION 'Cannot resolve address for market listing user_building_id %', NEW.user_building_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    NEW.address = resolved_address;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_market_listings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_market_listing_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_market_listings_set_address
BEFORE INSERT ON market_listings
FOR EACH ROW
EXECUTE FUNCTION set_market_listing_address_from_user_building();

CREATE TRIGGER trg_market_listings_set_updated_at
BEFORE UPDATE ON market_listings
FOR EACH ROW
WHEN (NEW IS DISTINCT FROM OLD)
EXECUTE FUNCTION update_market_listings_updated_at();

CREATE TRIGGER trg_market_listing_images_set_updated_at
BEFORE UPDATE ON market_listing_images
FOR EACH ROW
WHEN (NEW IS DISTINCT FROM OLD)
EXECUTE FUNCTION update_market_listing_images_updated_at();

-- Medien am Inserat. Bewusst eine Kopie, keine Referenz auf documents:
-- am Gebaeude haengen auch Plaene, die nicht in den Markt sollen.

CREATE TABLE IF NOT EXISTS market_listing_documents (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    market_listing_id   uuid NOT NULL,
    sort_order          integer NOT NULL DEFAULT 0,
    name                text NOT NULL,
    description         text,
    file_path           text NOT NULL,
    file_type           text,
    file_original_name  text,
    file_size_bytes     bigint,
    source_document_id  uuid,
    created_at          timestamp with time zone DEFAULT now(),
    updated_at          timestamp with time zone DEFAULT now(),

    CONSTRAINT fk_market_listing_documents_listing
        FOREIGN KEY (market_listing_id) REFERENCES market_listings(id) ON DELETE CASCADE,
    CONSTRAINT market_listing_documents_listing_sort_order_unique
        UNIQUE (market_listing_id, sort_order),
    CONSTRAINT market_listing_documents_name_not_blank
        CHECK (btrim(name) <> ''),
    CONSTRAINT market_listing_documents_path_not_blank
        CHECK (btrim(file_path) <> ''),
    CONSTRAINT market_listing_documents_size_check
        CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
    CONSTRAINT market_listing_documents_file_type_check CHECK (
        file_type IS NULL OR file_type IN (
            'jpg', 'png', 'gif', 'bmp', 'tiff', 'svg', 'webp',
            'pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'html', 'md',
            'csv', 'xlsx', 'xlsm',
            'e57', 'obj', 'stl', 'ply', 'glb', 'gltf', 'fbx', 'ifc', 'las', 'laz',
            'xyz', 'pts'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_market_listing_documents_listing
    ON market_listing_documents (market_listing_id, sort_order);

CREATE OR REPLACE FUNCTION update_market_listing_documents_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_market_listing_documents_set_updated_at ON market_listing_documents;
CREATE TRIGGER trg_market_listing_documents_set_updated_at
    BEFORE UPDATE ON market_listing_documents
    FOR EACH ROW WHEN (new.* IS DISTINCT FROM old.*)
    EXECUTE FUNCTION update_market_listing_documents_updated_at();
