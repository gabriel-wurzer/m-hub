# Bauperioden-Vorhersage (building_period_prediction)

Status: **ausgerollt** (2026-07-30) · alle 164.268 Wiener Gebäude · ehrliche Grenze bei post-1980

## Was es ist

Nur ~7% der Gebäude in `buildings_details` haben ein echtes `bp`-Label (Bauperiode),
weitere ~18% lassen sich über die Stadt-Wien-Typologie (GEBAEUDETYPOGD) grob zuordnen.
Für die restlichen ~75% schätzt ein Modell die Bauperiode aus der **Footprint-Morphologie**
(Grundriss, Volumen, Innenhof, Nachbarschaft). Ergebnis ist eine separate Prod-Tabelle,
die je Gebäude die feine 5-Klassen-Periode, die belastbare 3-Klassen-Grobstufe und eine
Konfidenz liefert.

Die Verteilung über die Stadt (38% bis 1918, 25% Zwischenkrieg, 36% Nachkrieg, <1% nach 1980)
bildet die erwartete Wiener Struktur ab: Gründerzeit-Kern innen, Nachkriegs-Peripherie außen.

## Tabelle `building_period_prediction`

Angelegt und befüllt vom Load-Step in [../deploy.sh](../deploy.sh) (nach dem gdal-Import).
**Getrennt** von `buildings_details`, weil gdal die bei jedem Deploy per `-overwrite` neu
importiert. Die Prediction-Tabelle überlebt das.

| Spalte | Typ | Bedeutung |
|---|---|---|
| `bw_geb_id` | varchar(10) PK | **App-Key** (nicht `fid`). Join über `buildings_details.bw_geb_id`. |
| `bp5` | smallint | 1 bis1918, 2 1919-44, 3 1945-79, 4 1980-99, 5 ab2000. **= Frontend `Period`-Enum 1:1** (`period.enum.ts`), fällt ohne Mapping ins Frontend. |
| `coarse3` | text | Vertrauenswürdige Grobklasse: `bis 1918` / `1919-1945` / `nach 1945`. |
| `source` | text | `known_bp` (echtes bp) / `known_coarse` (Typologie) / `predicted`. |
| `conf` | real | Konfidenz der bp5-Zuordnung. 1.0 = bekannt. |
| `p_bp3`, `p_bp4`, `p_bp5` | real | Nachkriegs-Subwahrscheinlichkeiten, für weiche Nutzung statt hartem argmax. |

Herkunft: 11.431 `known_bp` (7%), 28.963 `known_coarse` (18%), 123.874 `predicted`.

## Modell (hierarchisch)

Zwei Stufen, damit die glaubwürdige Grobebene nicht von der label-armen Feinebene verdorben wird:

1. **Stage 1, 3 Klassen** (`bis 1918` / `1919-1945` / `nach 1945`), trainiert auf der
   Union aus `bp` und GEBAEUDETYPOGD (40.394 Labels). Das ist die belastbare Ebene.
2. **Stage 2, Verfeinerung** nur innerhalb `nach 1945` in 1945-79 / 1980-99 / ab2000,
   trainiert auf den 928 `bp`-Labels der Nachkriegszeit (767 / 153 / 8).

Zusammenbau: bekanntes `bp` sticht immer, sonst die bekannte Grobklasse, sonst Stage 1;
`nach 1945` wird durch Stage 2 verfeinert.

Features: `log_area`, `log_vol`, `vol_per_area`, `m2bgf`, `maxhoehe`, `perim_m`, `npoints`,
`compactness`, `shape_idx`, **`solidity`** (Fläche/Hüllfläche, erkennt Innenhof/Blockrand,
stärkstes Feature), Nachbarschaft (`n_nb`, `log_meanA`, `std_nb_area`, `builtfrac`) und
`dom_nutzung` one-hot. Modell: RandomForest, **kein** `class_weight` (mit Balancing kippt
die Vorhersage-Verteilung, z.B. 68% künstlich auf Zwischenkrieg).

## Genauigkeit (räumlich kreuzvalidiert)

GroupKFold über 0,005-Grad-Zellen, sonst schönt die räumliche Autokorrelation die Zahl.
Config wie deployt.

| Ebene | accuracy | balanced | Klassen (F1) |
|---|---|---|---|
| Grob 3 Klassen | 72% | 55% | bis 1918 **0,82** · 1919-45 0,37 · nach 1945 0,56 |
| Fein 5 Klassen | 78% | 34% | bis1918 0,87 · 1919-44 0,65 · 1945-79 0,24 · **1980-99 0,00** · **ab2000 0,00** |

Zufall wäre 33% (grob) bzw. 20% (fein) balanced. Was trägt: **alt vs. Nachkrieg**, vor allem
die Gründerzeit-Erkennung (dichte Blockrandmorphologie ist lernbar). Was nicht trägt: die
feine Moderne.

## Ehrliche Grenzen

- **Post-1980 ist nicht vorhersagbar.** Es gibt nur 161 Trainingslabels (153 + 8), das Modell
  erkennt die Klasse mit F1 0,00. Praktisch landet alles Nachkriegliche in 1945-79; post-1980
  ist in der Verteilung stark untergezählt. Dort ist nur `coarse3 = "nach 1945"` belastbar,
  nicht `bp5 >= 4`. Das ist ein Evaluations-Problem (Modern ist quasi ungelabelt), keine
  Feature-Frage.
- **Modern-Signale bringen nichts, solange nicht gelabelt.** Historische Luftbilder
  (WMTS 1938-1992, Standortbelegung als Prior) wurden getestet: über mehrere Gebiete
  balanced 0,636 -> 0,627, also flach. Dach-Form aus BEV-DSM trennt die Perioden ebenfalls
  nicht (Wien hat quer durch die Epochen Steildächer). Nicht nochmal versuchen ohne
  post-1980-Labels.
- **Snapshot.** Die Prediction hängt an der aktuellen `data/mhub_wien.gpkg`. Ändert sich der
  Datensatz (neue Gebäude, neue bw_geb_ids), muss neu gerechnet werden, sonst fehlen den
  neuen Gebäuden Vorhersagen.

## Deployment

- Daten: `m-hub-db/building_period_prediction.csv.gz` (gzip, im Repo, kommt per `git pull` mit).
- Load: Step in `deploy.sh` nach dem gdal-Import und den Spatial-Indizes. Idempotent
  (`CREATE TABLE IF NOT EXISTS` + `TRUNCATE` + `\copy FROM STDIN`), läuft bei jedem `./deploy.sh`
  automatisch. Separate Tabelle, überlebt den `buildings_details`-Overwrite.

## Neu rechnen (wenn sich die gpkg ändert)

Pipeline im Repo unter [../m-hub-processing/bauperioden/](../m-hub-processing/bauperioden/)
(Details im dortigen README):

1. `extract_features.py` (gpkg-nativ, kein Prod-Zugriff) → `feat164k.csv` + `context.csv`;
   extern `gebtyp_full.json` (GEBAEUDETYPOGD).
2. `rollout_hier.py` trainiert beide Stufen → `bp_hier_prediction.csv` (auf `fid`).
3. `finalize.py` schlüsselt auf `bw_geb_id` um und schreibt
   `m-hub-db/building_period_prediction.csv.gz`. Danach `./deploy.sh`.
4. `measure_acc.py` liefert die CV-Zahlen, `plot_*.py` die Karten, `build_artifact.py` die
   mobile Webseite.

Die Pipeline ist damit komplett aus der gpkg reproduzierbar (keine Prod-Abhängigkeit). Der
gpkg-native `extract_features.py` ist gegen die ursprüngliche Prod-Extraktion validiert
(Features corr ~1,0; Details im README). Die **deployte gz wird seit 2026-07-31 komplett aus
der Pipeline erzeugt** (extract_features → rollout_hier → finalize), nicht mehr aus einer
Prod-Extraktion. Pipeline-Ausgabe und Deployment sind damit dasselbe.

## Mobile Ansicht

Zusammenfassung (Verteilung, Genauigkeit, zoombare Karten) als Webseite:
`https://claude.ai/code/artifact/6c1047a2-2b6b-4b48-9daf-c43056b79bc8`
(privat, Login bei claude.ai nötig).
