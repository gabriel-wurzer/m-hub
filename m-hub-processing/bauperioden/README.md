# Bauperioden-Vorhersage: Pipeline

Erzeugt `m-hub-db/building_period_prediction.csv.gz` (die von `deploy.sh` geladene
Prod-Tabelle). Fachliche Doku, Modell und Genauigkeit: [../../docs/bauperioden-vorhersage.md](../../docs/bauperioden-vorhersage.md).

Alle Skripte laufen aus **diesem Verzeichnis** heraus. Arbeits- und Ausgabedaten liegen
in `./work/` und `./out/` (beide gitignored).

## Reihenfolge

1. **`extract_features.py`** *(noch zu bauen, siehe Lücke unten)* → `./work/feat164k.csv`,
   `./work/context.csv`. Zusätzlich extern: `./work/gebtyp_full.json` (GEBAEUDETYPOGD).
2. **`rollout_hier.py`** — trainiert das hierarchische Modell (3 Klassen + Nachkriegs-
   Verfeinerung), schreibt `./work/bp_hier_prediction.csv` (auf `fid`).
3. **`finalize.py`** — schlüsselt auf `bw_geb_id` um und schreibt
   `../../m-hub-db/building_period_prediction.csv.gz`. Danach `./deploy.sh` am Server.

Optional (Auswertung/Bilder, nicht für den Rollout nötig):
- **`measure_acc.py`** — ehrliche, räumlich kreuzvalidierte Genauigkeit (Konsolen-Ausgabe).
- **`plot_stadt.py`**, **`plot_phone_split.py`**, **`plot_acc.py`** — Karten nach `./out/`.
- **`build_artifact.py`** — mobile Webseite (`./out/bp_stadt.html`) aus den PNGs.

## Eingaben

- `../../data/mhub_wien.gpkg` — Quelle der Gebäude (liegt schon da, ogr2ogr-Input von deploy).
- `./work/gebtyp_full.json` — GEBAEUDETYPOGD (Stadt Wien, EPSG:31256), externe Datei für die
  3-Klassen-Union. Muss separat abgelegt werden.
- `./work/feat164k.csv`, `./work/context.csv` — Feature-Tabellen, siehe Lücke.

## Offene Lücke: Feature-Extraktion

`feat164k.csv` und `context.csv` stammen aktuell aus einer **ad-hoc-Extraktion gegen die
Prod-PostGIS** (SQL nicht versioniert). Das ist die verbleibende Reproduzierbarkeits-Schwäche.

Beide sind aber aus der gpkg ableitbar, ein `extract_features.py` (gpkg-nativ, kein
Prod-Zugriff) ist der saubere Fix:

- **feat164k:** `fid`, `bp`, `dom_nutzung`, `m2flaeche`, `m3vol`, `m2bgf`, `maxhoehe` sind
  Attribute; `perim_m`, `hull_area_m2`, `npoints`, `area_m2`, `cx`/`cy` aus der Geometrie
  (metrisch in EPSG:31256, Zentroid in 4326).
- **context:** je Gebäude die Nachbarn innerhalb ~120 m (`ST_DWithin(geom, 0.0012°)`
  in Prod), aggregiert zu `n_nb`, `sum_nb_area`, `mean_nb_area`, `std_nb_area`. In geopandas
  über einen räumlichen Join der (gepufferten) Geometrien.

Achtung: eine gpkg-native Neu-Extraktion kann sich durch Reprojektion/Geometrie-Details
minimal von der aktuell deployten Momentaufnahme unterscheiden. Bis eine volle Neuberechnung
validiert ist, bleibt die deployte `building_period_prediction.csv.gz` die Wahrheit.
