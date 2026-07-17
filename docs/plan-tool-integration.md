# Integration 2D-Plan-Tool ↔ m-hub

Status: Entwurf · 2026-07-17 · für Abstimmung mit Lukas (node-red/DB)

## Ziel

Mengen aus einem Plan (PDF) in m-hub-Bauteile/Objekte überführen. Kein Automat:
**hochladen → Tool darauf öffnen → drin arbeiten → an m-hub übergeben.** Das Tool
muss **stand-alone UND integriert** laufen (harter Constraint); die Integration
ist eine additive Schicht, kein Rückbau.

Vokabular: **Extrakt** = ein Geschoss aus einem Plan (das Arbeits-/Container-Ding).
**Aufmaß** = die Tätigkeit. Ein PDF (z.B. „GRUNDRISSE KG-EG", 4 Geschosse) → *mehrere*
Extrakte, eins je Geschoss.

## Ablauf

```
Dokumentenliste (m-hub)         Tool                         m-hub API
  „Plan auswerten" am PDF ─► Absprung (Kontext + Token)
                              zieht das PDF aus m-hub
                              ROI grenzt auf ein Geschoss ein
                              Wände/Böden/Objekte erfassen
                              (mehrere Extrakte je PDF)
  ◄──────────────────────── Rücksprung: Geschoss(e) wählen,
                              Report als Vorschau
                              Batch-Submit ───────────────► /api/import/plan
                                                            delete-and-reallocate
```

## Bausteine

### 1. Auslöser
Button **„Plan auswerten" in der Dokumentenliste**, an jedem PDF (`file_type=pdf`).
*Nicht* in der Geschoss-Ansicht: wir wissen nicht, dass ein PDF ein Plan ist, das
entscheidet der Mensch. Kontext (`building_id`, `user_building_id`, `owner_id`)
kommt vom Dokument/Gebäude automatisch mit.

### 2. Absprung + Auth-Token
m-hub startet das Tool mit: Gebäude-Kontext, der **Geschoss-Liste** (aus
`user_buildings.structure`) und einem **kurzlebigen Token**. Das Token autorisiert
(a) das PDF aus m-hub/Seaweed zu ziehen und (b) das Batch-Submit. Das ist der
sicherheitskritische Teil, wird beim Bau zuerst festgezurrt.

### 3. Extrakt-Modell
Extrakt = (Dokument + Geschoss). Das **Geschoss ist nur ein Label** und wird erst
beim **Rücksprung** gewählt (aus der m-hub-Liste; stand-alone Freitext) — die
Erfassung selbst läuft label-frei. Am Rücksprung ist **Mehrfach-Auswahl** möglich
(ein Extrakt auf mehrere idente Geschosse anwenden). Der **ROI** isoliert pro
Extrakt das eine Geschoss auf dem Sammelblatt. Das Tool **persistiert** Extrakte
(Wanderkennung/Aufbauten sind viel Arbeit, Wiedereinstieg muss gehen).

### 4. Quelle
Das Tool konsumiert das **m-hub-Dokument** (zieht das PDF per Token), kein
Zweit-Upload. Eine Quelle, ein Ort der Wahrheit.

### 5. Rückschreiben (delete-and-reallocate)
Neuer Batch-Endpoint statt N einzelner POSTs:

`POST /api/import/plan { building_id, source_extract_id, locations[], parts[], objects[] }`

transaktional:
1. `DELETE FROM building_parts  WHERE source_extract_id = :x`
   `DELETE FROM building_objects WHERE source_extract_id = :x`
   (alle Zeilen des Extrakts, **über alle** Geschosse)
2. für jedes gewählte Geschoss: `parts`/`objects` einfügen, mit `location = geschoss`
   und `source_extract_id = :x`.

Damit ist Re-Import sauber: alte Platzierungen weg, neue Auswahl rein. Deselektiert
man beim zweiten Mal ein Geschoss, verwaist nichts. **Handeingaben
(`source_extract_id IS NULL`) bleiben unangetastet.** Zwei verschiedene Extrakte
(auch aus demselben Dokument) sind unabhängig.

### 6. Idempotenz-Schlüssel
**`source_extract_id`** (opake id des Tools), *nicht* (Dokument+Geschoss) — sonst
leckt die Reallocation bei Mehrfach-Zuordnung. Item-Level-Sync geht bei Wänden/Böden
ohnehin nicht (keine stabile Identität über Läufe).

### 7. Report
HTML (druckt zu PDF), **ein Report = ein Extrakt** (1× die Zeichnung; die ×N-Geschosse
rechnet m-hub). Inhalt: Wände nach Bauteiltyp mit **Laufmeter**, Böden mit **m² netto**,
Objekte mit **Anzahl** — je **Summen oben + voller Schichtaufbau je Bauteil**. Eine
**LCA-Zeile (Masse, GWP) nur wenn m-hub verbunden**, Faktoren aus m-hub (siehe
`docs/lca-materialpass.md`); stand-alone höchstens indikativ.
Ein Artefakt, zwei Zwecke: **stand-alone die Ausgabe, integriert die Übergabe-Vorschau.**

### 8. m-hub-Konzepte
Erhalten: **Laufmeter Wand, m² Boden, Objekte** (das Ingestion-Contract,
`m-hub-planimport/INGESTION_CONTRACT.md`). Keine neuen Repräsentationen.

## Was schon da ist

- Tool produziert `CreateBauteilPayload[]` + `CreateObjektPayload[]`.
- m-hub hat `POST /api/parts`, `POST /api/objects`.
- Ingestion-Contract dokumentiert.
- ROI-/Erkennungsbereich im Tool gebaut.

## DB / node-red (mit Lukas)

1. Spalte **`source_extract_id UUID NULL`** auf `building_parts` **und**
   `building_objects` (+ Index).
2. Endpoint **`POST /api/import/plan`** (transaktional, delete-and-reallocate,
   token-authentifiziert).
3. Token-Validierung + PDF-Ausgabe des Dokuments für das Tool.

## Offen / Reihenfolge

1. Auth-Token-Mechanismus (zuerst festzurren).
2. Batch-Endpoint + DB-Spalte (Lukas).
3. Tool: Absprung-Modus (Kontext übernehmen, PDF ziehen), Rücksprung mit
   Geschoss-Auswahl + Submit; Extrakt-Modell + Geschoss-Label.
4. Report (Mengen; LCA-Zeile wenn verbunden).
5. m-hub: Button in der Dokumentenliste + Vorschau-Dialog.
