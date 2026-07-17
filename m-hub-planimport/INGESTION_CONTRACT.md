# m-hub Ingestion Contract

Was der Plan-Import in m-hub schreiben können muss — und, ebenso wichtig, was
m-hub *nicht* modelliert. Dieses Dokument ist die Spec für den Rebuild von
`m-hub-planimport`. Quelle: m-hub SQL-Init (`../m-hub-db/init/`), Frontend-Models
und -Enums (`../m-hub-frontend/src/app/models|enums/`), Service-Layer.

Grundprinzip (rückwärts gedacht): ein 2D-Plan kodiert **Geometrie, keine
Materialien**. Das Tool ist damit ein *Geometrie-Extraktor + constrained
Zuweisung* gegen m-hubs geschlossenes Vokabular — kein Wand-/Material-Erkenner.

## Target: `building_parts` (Bauteil)

Ein Plan → *N* Bauteile (+ optional Objekte für Öffnungen). Das ist die einzige
Struktur, die m-hub aus einem Grundriss braucht. Exakte Shape entspricht
`CreateBauteilPayload` (`../m-hub-frontend/src/app/models/building-component.ts`),
Write via `POST /api/parts`.

```jsonc
{
  "building_id":      "5312213",          // extern (GeoPackage-ID), aus m-hub-Kontext
  "user_building_id": "<uuid>",           // aus m-hub-Kontext
  "owner_id":         "<uuid>",           // aus m-hub-Kontext
  "category":         "Bauteil",
  "part_type":        "Außenwand",        // closed enum, s.u.
  "location":         "Regelgeschoss 1",  // muss ein Geschoss aus structure treffen
  "name":             "Keller-Außenwand",
  "description":      "...",              // optional
  "is_public":        true,
  "is_hazardous":     false,
  "part_structure": {
    "type":   "wall",                     // "wall" | "slab"
    "length": 8.4,                        // METER (wall) — bzw. "area": m² (slab)
    "layers": [
      { "layer_index": 1, "material": "Beton",        "thickness": 60 },  // mm
      { "layer_index": 2, "material": "Mineralwolle", "thickness": 30 },
      { "layer_index": 3, "material": "Beton",        "thickness": 80 }
    ]
  }
}
```

`part_structure` ist `WallStructure | SlabStructure`
(`../m-hub-frontend/src/app/models/part-structure.ts`):
wall trägt `length` (m), slab trägt `area` (m²), beide `layers[]`.

## Geschlossene Vokabulare

**m-hub verwendet KEINE ÖKOBAU.dat-UUIDs.** `layers[].material` ist ein fixer
Enum (`LayerMaterial = MaterialType | ConnectionType | 'Unbekannt'`):

- **MaterialType** (38): Aluminium, Asphalt, Beton, Bitumen, Blähbeton, Blei,
  Diverse Kunststoffe, Eternit, Estrich, Fliesen, Fliesenkleber, Glas, Heraklith,
  Holz, Kautschuk, Keramik, Kupfer, Laminat, Linol, Messing, Mineralfaser,
  Mineralwolle, Mörtel, Naturstein, Papier, Putz, PVC, Rigips, Schlacke,
  Schüttung, Stahl, Steinzeug, Stroh, Styropor, Teppich, Terrazzo, Ytong, Ziegel.
- **ConnectionType** (10, das sind die `thickness: 0`-Layer): Klebe-, Schraub-,
  Schweiß-, Niet-, Nagel-, Steck-, Löt-, Krimp-, Press-, Keilverbindung.
- **`"Unbekannt"`** als Fallback.

ÖKOBAU erscheint in m-hub nur als *Kategorie*-Enum (`OekobaudatCategory`) und in
einem Kommentar — nie als Materialwert. → planimports `oekobaudat.ts`
(Live-Suche, UUIDs, `seed-`-Fallback) liefert das **falsche Vokabular** und
entfällt. Material-Picker = dieser ~49-Werte-Enum. Kein Netz, kein Cache, kein
Fuzzy-Matching.

**part_type** (`../m-hub-frontend/src/app/enums/part-type.enum.ts`, closed):
Bodenaufbau, Dachaufbau (nur `slab`) · Innenwand, Außenwand, Brandwand,
Kniestock, Attika (`wall`).

**object_type** (falls Öffnungen als Objekte erfasst werden, closed): Abhängung,
Tür, Zarge, Fenster, Heizkörper, Rohre, Kabel, Sonstige.

## Herkunft je Feld: extrahiert / zugewiesen

m-hub-Wände speichern **keine Geometrie** — kein Polygon, kein Dickenfeld. Ein
Wand-Bauteil ist `length (m)` + geordnete Layer; Gesamtdicke ist implizit
= Σ Layer-Dicken. Die Plan-Geometrie ist reines *Messwerkzeug*; nur Skalare
landen in m-hub.

| m-hub-Feld | Herkunft | Anmerkung |
|---|---|---|
| `part_structure.length` (m) | **extrahiert** | Wandlauf-Länge; PDF-units → mm → /1000 |
| `part_structure.area` (m²) | **extrahiert** | Boden-Polygonfläche |
| Gesamtdicke (= Σ thickness) | **extrahiert** | Doppellinien-Abstand → **Validierungs-Constraint**, wird nicht gespeichert |
| `part_type` IW/AW | **extrahiert** | Topologie: Lauf auf der Außenkontur? |
| `part_type` BW/Attika/Kniestock | **zugewiesen** | semantisch/regulatorisch |
| `layers[].material` | **zugewiesen** | aus dem Enum, nie aus dem Strich |
| `layers[].thickness` (mm) | **zugewiesen** | Aufteilung der gemessenen Gesamtdicke |
| `location` | **zugewiesen** | 1 Plan = 1 Geschoss (aus m-hub-Kontext) |
| `name`, `is_public`, `is_hazardous` | **zugewiesen** | |

**Keine "berechneten" Mengen:** m-hub speichert keine Volumina. Menge =
`length × Σthickness × Geschosshöhe × count` wird downstream aus
`user_buildings.structure[].height/count` abgeleitet. Das Tool liefert nur
`length` + Layer.

## Gruppierung & Schacht

Fällt aus dem Schema heraus, ohne "kollabieren" zu erfinden:

- **Gruppe = Menge von Wandläufen mit demselben Schichtaufbau; `Bauteil.length`
  = Σ ihrer Längen.** Ein Bauteil pro Aufbau.
- **Äpfel/Birnen unmöglich by construction:** 60er und 30er haben verschiedene
  Σ-Dicke → verschiedener Aufbau → verschiedenes Bauteil. Können nicht in
  dieselbe Gruppe.
- **Schacht = Modell-Grenze in m-hub, nicht im Tool.** m-hub kennt kein
  "gleiche Wand minus Hohlraum".
  **Entscheidung (2026-07-09): Länge-Approximation.** Eine Wand mit Schacht wird
  über eine reduzierte `length` abgebildet, nicht über einen Netto-/Abzugs-Faktor.
  m-hubs Schema bleibt unangetastet. Damit ist die erreichbare Genauigkeit
  längenbegrenzt — bewusst akzeptiert für den PoC.

## Integration (Absprung von m-hub)

Write-API (`BuildingComponentService` /
`../m-hub-frontend/src/app/services/building-part/building-part.service.ts`):

| Verb | Route | Zweck |
|---|---|---|
| POST | `/api/parts` | Bauteil anlegen (`CreateBauteilPayload`) |
| PUT | `/api/parts/:id` | Bauteil ändern (`UpdateBauteilPayload`) |
| GET | `/api/parts/building/:userBuildingId` | Bauteile eines Gebäudes |
| GET | `/api/parts/:id` | einzelnes Bauteil |

Der Handoff muss aus m-hub nur den Kontext mitgeben, den der Plan nicht kennt:
`building_id`, `user_building_id`, `owner_id` und die gültigen `location`-Labels
(aus `user_buildings.structure`) als Constraint-Liste. Save = Bauteile posten,
zurück.

## Einheiten-Reconciliation

| Größe | m-hub | planimport misst | Umrechnung |
|---|---|---|---|
| Wandlänge | m | PDF-units | × `mmPerUnit` / 1000 |
| Layer-Dicke | mm | PDF-units | × `mmPerUnit` |
| Slab-Fläche | m² | PDF-units² | × (`mmPerUnit`/1000)² |
| Objekt-Maße | cm (aus Seed abgeleitet, zu bestätigen) | PDF-units | × `mmPerUnit` / 10 |
| Geschosshöhe | cm (auf `user_buildings.structure`) | — | nicht extrahiert |
