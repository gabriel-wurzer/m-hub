# Bauperioden-Vorhersage: Pipeline

Erzeugt `m-hub-db/building_period_prediction.csv.gz` (die von `deploy.sh` geladene
Prod-Tabelle). Fachliche Doku, Modell und Genauigkeit: [../../docs/bauperioden-vorhersage.md](../../docs/bauperioden-vorhersage.md).

Alle Skripte laufen aus **diesem Verzeichnis** heraus. Arbeits- und Ausgabedaten liegen
in `./work/` und `./out/` (beide gitignored).

## Reihenfolge

1. **`extract_features.py`** (gpkg-nativ, kein Prod-Zugriff) → `./work/feat164k.csv`,
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
  `extract_features.py` erzeugt daraus `feat164k.csv` + `context.csv`.
- `./work/gebtyp_full.json` — GEBAEUDETYPOGD (Stadt Wien, EPSG:31256), externe Datei für die
  3-Klassen-Union. Muss separat abgelegt werden (nicht aus der gpkg ableitbar).

## Validierung (2026-07-31)

`extract_features.py` gegen die ursprüngliche Prod-Extraktion geprüft (n=164.268):

- feat164k: `area_m2`/`perim_m`/`hull_area_m2`/`npoints`/`cx`/`cy` corr **1,00000**
  (npoints/cx/cy/bp bit-genau), Rest im Rundungsbereich.
- context: `n_nb` corr 0,9998 (ratio 0,996), `sum_nb_area`/`mean_nb_area` corr 0,999.
  Der Puffer nutzt `resolution=8`, sonst zählt das Achteck ~7% Nachbarn zu wenig.
- Gesamte Pipeline gpkg-nativ vs. deployte Vorhersage: **bp5 zu 95,5%, coarse3 zu 95,6%
  identisch**, Verteilung deckungsgleich. Die ~4,5% Rest sind Feature-Mikrodiffs, die durch
  die RF-Grenzen kippen, alle im geratenen Teil.

Die aktuell deployte `building_period_prediction.csv.gz` stammt noch aus der Prod-Extraktion.
Wer sie exakt aus der Pipeline haben will (Prod-Abhängigkeit ganz weg), rechnet einmal komplett
durch (`extract_features` → `rollout_hier` → `finalize`) und committet die neue gz.
