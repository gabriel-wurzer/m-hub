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
    -- generic relation to source component; can reference either building_parts or building_objects
    component_id UUID NOT NULL,
    location TEXT NOT NULL,
    component_category TEXT NOT NULL CHECK (component_category IN ('Bauteil', 'Objekt')),
    material TEXT CHECK (
        material IS NULL OR material IN (
            'Ziegel',
            U&'M\00F6rtel',
            'Beton',
            U&'Bl\00E4hbeton',
            'Estrich',
            'Putz',
            'Stahl',
            'Heraklith',
            'Fliesen',
            'Fliesenkleber',
            'Rigips',
            'Holz',
            'Keramik',
            'Bitumen',
            'Glas',
            'Mineralwolle',
            'Styropor',
            'PVC',
            'Kupfer',
            'Aluminium',
            'Eternit',
            'Schlacke',
            'Blei',
            'Diverse Kunststoffe',
            'Stroh',
            'Naturstein',
            'Papier',
            'Messing',
            'Steinzeug',
            'Linoleum'
        )
    ),
    object_type TEXT CHECK (
        object_type IS NULL OR object_type IN (
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
    object_count INTEGER CHECK (object_count IS NULL OR object_count > 0),
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    status TEXT NOT NULL CHECK (
        status IN ('eingelagert', 'verbaut', 'verkauft', U&'verf\00FCgbar')
    ),
    available_from DATE,
    potential TEXT NOT NULL CHECK (potential IN ('reuse', 'recycle')),
    quantity NUMERIC(14, 3) NOT NULL CHECK (quantity > 0),
    unit TEXT NOT NULL CHECK (
        unit IN (U&'St\00FCck', 'Kubikmeter', 'Quadratmeter', 'Meter', 'Kilogramm')
    ),
    contact TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT market_listings_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT market_listings_location_not_blank CHECK (btrim(location) <> ''),
    CONSTRAINT market_listings_contact_not_blank CHECK (btrim(contact) <> ''),
    CONSTRAINT market_listings_component_snapshot_check CHECK (
        (component_category = 'Bauteil' AND object_type IS NULL AND object_count IS NULL)
        OR
        (component_category = 'Objekt' AND material IS NULL)
    )
);

-- Multiple images per listing are stored in a dedicated child table instead of
-- duplicating image columns on market_listings.
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
    CONSTRAINT market_listing_images_listing_sort_order_unique UNIQUE (market_listing_id, sort_order)
);

-- ===============================================
--  FOREIGN KEYS
-- ===============================================
ALTER TABLE market_listings
  ADD CONSTRAINT fk_market_listings_user_building
  FOREIGN KEY (user_building_id)
  REFERENCES user_buildings(id)
  ON DELETE CASCADE;

ALTER TABLE market_listing_images
  ADD CONSTRAINT fk_market_listing_images_listing
  FOREIGN KEY (market_listing_id)
  REFERENCES market_listings(id)
  ON DELETE CASCADE;

-- component_id intentionally has no direct foreign key because a listing can
-- point to either building_parts(id) or building_objects(id).


-- ===============================================
--  UPDATE TRIGGER LOGIC
-- ===============================================
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
