-- 2026-09: fehlende Spalten auf market_listings nachziehen.
--
-- `address`, `length`, `width` und `height` stehen seit laengerem im init, auf
-- aelteren Datenbanken fehlen sie. Solange niemand Abmessungen mitgeschickt hat,
-- fiel das nicht auf; sobald das Frontend Laenge, Breite und Hoehe sendet,
-- bricht das INSERT mit "column length does not exist" ab und das Inserieren
-- scheitert ohne brauchbare Meldung.
--
-- address wird von set_market_listing_address_from_user_building() gefuellt,
-- deshalb hier erst nullable anlegen, aus den user_buildings nachtragen und
-- dann auf NOT NULL setzen.

ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS length DOUBLE PRECISION;
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS width  DOUBLE PRECISION;
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS height DOUBLE PRECISION;
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS address TEXT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conname = 'market_listings_length_check') THEN
        ALTER TABLE market_listings
            ADD CONSTRAINT market_listings_length_check CHECK (length IS NULL OR length > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conname = 'market_listings_width_check') THEN
        ALTER TABLE market_listings
            ADD CONSTRAINT market_listings_width_check CHECK (width IS NULL OR width > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conname = 'market_listings_height_check') THEN
        ALTER TABLE market_listings
            ADD CONSTRAINT market_listings_height_check CHECK (height IS NULL OR height > 0);
    END IF;
END $$;

UPDATE market_listings m
   SET address = ub.address
  FROM user_buildings ub
 WHERE ub.id = m.user_building_id
   AND (m.address IS NULL OR btrim(m.address) = '');

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM market_listings
                    WHERE address IS NULL OR btrim(address) = '') THEN
        ALTER TABLE market_listings ALTER COLUMN address SET NOT NULL;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint
                        WHERE conname = 'market_listings_address_not_blank') THEN
            ALTER TABLE market_listings
                ADD CONSTRAINT market_listings_address_not_blank CHECK (btrim(address) <> '');
        END IF;
    ELSE
        RAISE NOTICE 'address bleibt nullable: es gibt Inserate ohne aufloesbare Adresse';
    END IF;
END $$;

-- Die Trigger-Funktion fehlt auf aelteren Datenbanken ebenfalls.
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

DROP TRIGGER IF EXISTS trg_market_listings_set_address ON market_listings;
CREATE TRIGGER trg_market_listings_set_address
    BEFORE INSERT ON market_listings
    FOR EACH ROW EXECUTE FUNCTION set_market_listing_address_from_user_building();
