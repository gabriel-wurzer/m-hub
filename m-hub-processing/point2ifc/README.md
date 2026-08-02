# Point2IFC — Punktwolke → reduziertes IFC (Job-Service)

Nimmt eine Gebäude-Punktwolke und rekonstruiert daraus automatisch ein **reduziertes IFC**
(Wände/Decken/Dach je Geschoss, mit geschnittenen Tür-/Fenster-Öffnungen). Läuft als
async-Job-Service in m-hub.

Herkunft: Cedric Kornacks Diplomarbeits-Code `Point2IFC_Snapshot` (AP3-Datenerhebung), hier
mit zwei Änderungen ins Repo geholt:
- **Öffnungen werden jetzt geschnitten** (siehe unten) — im Original erkannt, aber nicht als
  `IfcOpeningElement` emittiert.
- `pye57`-Import lazy (nur für `.e57` nötig; wir nehmen `.laz/.ply/.pcd`).

## Pipeline (`main.build_ifc`)

`load_pointcloud` (laz/las/ply/pcd/e57) → `clean_pointcloud` (voxel 5 cm + Ausreißer) →
`split_floors` (Flächenbelegungs-Profil über Z) → je Geschoss: `define_masks`
(Normalen/Planarität → Wand/Decke/Dach) → `extract_walls` (2D-RANSAC-Linien, Richtungs-Registry
über Geschosse, Öffnungs-Detektion) → `extract_slabs` → `extract_roofs` → `IFCBuilder` → `.ifc`.
Rein geometrisch, CPU-only. Rekonstruktionsqualität hängt an Scan-Dichte/Sauberkeit.

Getestet auf Linzer Straße 83 (451 MB .laz): 5 Geschosse · 447 Wände · 105 Öffnungen ·
8 Decken · 5 Dachflächen, wenige Minuten.

## Öffnungen (der neue Teil)

`walls_util.fuse_wall_openings` erkannte Türen/Fenster schon (Punktdichte je Tangential-Spalte:
DOOR/WINDOW/SOLID), nutzte sie aber nur zur Wand-Fusion. Jetzt hängt es jede Öffnung mit
**Weltkoordinaten** (`pA/pB` auf der Wandmittellinie, `z0/z1`) an die abdeckende Wand; der
`IFCBuilder._cut_opening` schneidet sie als `IfcOpeningElement` + `IfcRelVoidsElement`
(voll durch die Wand, 20 cm Übermaß für sauberen Boolean). Bessere IFC-Optik **und** Netto-
Wandfläche für die Materialbilanz.

## Service (`job_api.py`)

Schwer + langsam → kein synchroner Request, sondern ein Hintergrund-Job (ein Worker,
serialisiert → kein OOM). Contract:

    POST /point2ifc      {"input": "<lokaler Pfad ODER http(s)-URL zu .laz/.las/.ply/.pcd>"}
                         → {"job_id", "status":"queued"}
    GET  /point2ifc/<id>      → {"status": queued|running|done|error, "result"|"error"}
    GET  /point2ifc/<id>/ifc  → das reduzierte IFC (application/octet-stream)
    GET  /health

Integration: node-red lädt die Punktwolke (SeaweedFS/Upload), POSTet deren Pfad/URL hierher
(`POINT2IFC_URL=http://m-hub-point2ifc:8972`, im Backend-env gesetzt), pollt den Job, bietet
`/ifc` als Download an.

## Deployment

- Container `m-hub-point2ifc` (Dockerfile, `python:3.12-slim` + `libgl1/libgomp1` +
  requirements). In `docker-compose.yaml` mit Healthcheck + Volume `point2ifc_data:/data/point2ifc`;
  in `deploy.sh` in der `up -d`-Liste.
- Port `127.0.0.1:8972` (nur lokal/intern; node-red erreicht ihn übers compose-Netz).

## Ehrliche Grenzen

- **Reduziert:** geometrische Hülle, LOD-niedrig, kein Material, Wände massiv außer den
  erkannten Öffnungen. Kein Ersatz für ein händisches Scan-to-BIM.
- Single-Building hartcodiert (`Building A`/`My Site`), keine Georeferenz (Wolke wird auf
  lokalen Ursprung verschoben).
- Ein Worker, Jobs seriell; ein großer Scan = Minuten + viel RAM.
- `.e57` würde `pye57` brauchen (aktuell nicht installiert; m-hub akzeptiert ohnehin nur
  offene Formate .xyz/.laz/.ply/.pcd).

## Offen (nächste Schritte)

- node-red-Flow + Frontend-Button (Upload → Job → zwei Downloads).
- **Materialbilanz** (Download 2): reduziertes IFC → Plan-Tool (Wandklassifikation + ÖKOBAUDAT)
  → material-angereichertes IFC + Bilanz. Siehe `docs/` (Punktwolken-Integrationskonzept).
