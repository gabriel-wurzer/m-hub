-- 2026-09: Medien am Inserat.
--
-- Ein Inserat konnte bisher nur Bilder tragen (market_listing_images). Am
-- Gebaeude haengen aber Splats, Punktwolken, IFC und PDFs, die man beim
-- Inserieren mitgeben will.
--
-- Bewusst eine KOPIE, keine Referenz auf documents: am Gebaeude haengen auch
-- Plaene, die nicht in den Markt sollen. Wer inseriert, waehlt aus, und was
-- ausgewaehlt wurde, liegt danach als eigene Datei am Inserat. Aenderungen am
-- Gebaeudedokument wirken nicht in den Markt, und Loeschen dort reisst das
-- Inserat nicht auf.
--
-- source_document_id haelt nur die Herkunft fest, ohne Fremdschluessel, damit
-- das Original spurlos verschwinden darf.
--
-- Gegenstueck in init/06_market_listings.sql ist mitgeaendert.

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
