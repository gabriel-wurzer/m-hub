-- material_catalog = the "Bauperiodenkatalog" (Stadt-Wien conform)
--
-- period (bp) x Ort x Art -> measured build-up distribution. Seeded from
-- useCasesAufbauten.xlsx (the 11 Vermessungen), later extended by the KI. One row
-- per measured build-up within (bp, ort, art), with its net area and share.
-- Applied to parametric_output for per-building materials, resolved
-- measured > predicted (KI) > mdab base (bmg1-9).
--
-- bp 0 (unbekannt) and bp 5 (2001-) have NO seed build-ups -> those buildings fall
-- to the mdab base; bp 5 gets KI predictions later from accumulating user data.
--
-- The table is created by the seeding load (ogr2ogr from data/material_catalog.csv
-- + .csvt); this file is the canonical column definition.

CREATE TABLE IF NOT EXISTS material_catalog (
    bp            integer NOT NULL,          -- period code 1..5 (Stadt-Wien standard)
    ort           text    NOT NULL,          -- RG Regelgeschoss | DG Dachgeschoss | KG Keller
    art           text    NOT NULL,          -- AW Außenwand | IW Innenwand | FB Boden | D Dach
    aufbau        text    NOT NULL,          -- layered build-up "(Material, Stärke; ...)"
    nettoflaeche  double precision,          -- measured net area for this build-up (over the samples)
    anteil        double precision,          -- share within (bp, ort, art)  [%/(BauP-Obj-Ort-Art)]
    stk           integer,                   -- Stück (count, for discrete items)
    staerke       double precision,          -- total thickness [m]
    quelle        text NOT NULL DEFAULT 'vermessung'  -- vermessung (use cases) | ki
);
