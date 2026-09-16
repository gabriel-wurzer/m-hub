-- 2026-09: 'xyz' und 'pts' als Dokumenttyp zulassen.
--
-- Der pointcloud-viewer (assets/pointcloud-viewer) liest genau diese beiden
-- Formate (parseXyz), die Typ-Whitelist kannte sie aber nie. Punktwolken-
-- Vorschauen liessen sich dadurch nicht ablegen. Grossformate (las/laz/e57)
-- bleiben wie bisher erlaubt und werden weiter nur zum Download angeboten.
--
-- Gegenstueck in init/05_documents.sql ist mitgeaendert.

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_file_type_check;

ALTER TABLE documents ADD CONSTRAINT documents_file_type_check CHECK (
    file_type IS NULL OR file_type IN (
        'jpg', 'png', 'gif', 'bmp', 'tiff', 'svg', 'webp',
        'pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'html', 'md',
        'csv', 'xlsx', 'xlsm',
        'e57', 'obj', 'stl', 'ply', 'glb', 'gltf', 'fbx', 'ifc', 'las', 'laz',
        'xyz', 'pts'
    )
);
