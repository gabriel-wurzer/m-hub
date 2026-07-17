# LCA / Materieller Gebäudepass: wo die Rechnung hingehört

Status: Entwurf · 2026-07-17 · Architektur-Leitplanke für LCA/EPD/ÖKOBAU.dat

## Kernentscheidung

**Die LCA gehört nach m-hub, nicht ins 2D-Plan-Tool.** Das Tool liefert *Mengen*,
m-hub macht daraus *Wirkung*. Materialstammdaten (Dichte, ÖKOBAU/EPD-Faktoren),
die LCA-Rechnung und der Gebäudepass leben zentral in m-hub. Das 2D-Tool (und
jeder andere Eingabekanal) ist ein Mengen-Lieferant.

## Warum

- **Die LCA ist eine Eigenschaft des Gebäudes, nicht des Plans.** Sie aggregiert
  über *alle* Geschosse und *alle* Eingabewege (Pläne, Handeingabe, später IFC,
  Punktwolken). Nur m-hub sieht das Ganze. Das Tool sieht pro Lauf ein Geschoss
  aus einem Plan.
- **Die Rechnung schließt sich erst mit m-hub-Kontext.** Aus Wand-Laufmeter wird
  Volumen erst über Geschosshöhe × Anzahl (aus `user_buildings.structure`), die
  das Tool gar nicht kennt: `Länge (m) × Σ Schichtdicke × Höhe × count → Volumen`,
  `× Dichte → Masse`, `× GWP/EPD-Faktor → Wirkung`. Boden analog über die Fläche.
  Die Materialstammdaten und die Höhe/Anzahl liegen beide in m-hub.
- **Materialstammdaten sind das wiederverwendbare Kapital** — über alle Gebäude
  und alle Tools. Legt man sie ins Tool, fragmentiert man genau das Asset, das
  zählt.
- **Methodik ändert sich.** EPD-Versionen, Systemgrenzen, Faktoren. Zentral in
  m-hub ändert man einmal und rechnet über den Bestand neu. Im Report des Tools
  eingebacken, könnte man die LCA alter Daten nie neu rechnen, ohne den Plan neu
  zu bearbeiten.

## Rollenteilung

| | 2D-Plan-Tool | m-hub |
|---|---|---|
| Aufgabe | Mengen aus Plan extrahieren | LCA + Pass rechnen & halten |
| Liefert | Laufmeter Wand, m² Boden, Objekte (mit Material-Enum + Schichtdicken) | Masse, GWP, … pro Bauteil und aggregiert pro Gebäude |
| Kennt | ein Geschoss pro Lauf, Geometrie | ganzes Gebäude, alle Quellen, Höhe/Anzahl, Materialstammdaten |
| Materialdaten | nur der geschlossene Namens-Enum | Dichte + ÖKOBAU/EPD-Faktoren, Methodik |

Das ist der Grund, warum das Tool `oekobaudat.ts` **nicht** braucht (haben wir
entfernt): das Vokabular ist ein geschlossener Enum, die ÖKOBAU-Verknüpfung
passiert in m-hub, einmal, für alle.

## Was in m-hub fehlt / zu bauen ist

Heute ist `MaterialType` in m-hub nur ein Name (38 Werte). Das Gerüst ist aber
schon da: `MaterialGroup` (Mineralik/Metalle/Biomasse/Kunststoffe),
`OekobaudatCategory`, `MdabMaterialGroup` (aus `Materialienliste_v2_pa.xlsx` und
den ÖKOBAU-Kategorien). Der Ausbau:

1. **Materialstammdaten je `MaterialType`**: Rohdichte (kg/m³) und eine Verknüpfung
   auf ÖKOBAU.dat-Datensätze (ILCD/EPD-UUIDs) bzw. deren Kennzahlen (GWP, PENRT,
   … über den Lebenszyklus A1–A3, ggf. C/D).
2. **Mengen → Volumen → Masse → Wirkung** je Bauteil, mit Höhe/Anzahl aus der
   `structure`. Verbindungsschichten (ConnectionType) tragen Dicke 0, also kein
   Volumen.
3. **Aggregation pro Gebäude** = der Gebäudepass: Massen und Wirkungen über alle
   Bauteile/Objekte/Geschosse, nach Material/Gruppe aufgeschlüsselt.

## ÖKOBAU.dat / EPD, konkret

- ÖKOBAU.dat liefert ILCD/EPD-Datensätze über die Soda4LCA-REST-Schnittstelle;
  daraus kommen die Umweltindikatoren je Material/Prozess.
- Der geschlossene `MaterialType`-Enum wird auf ÖKOBAU-Datensätze *gemappt*
  (Kuration, einmalig, in m-hub). Ein Material kann mehrere Kandidaten haben;
  die Auswahl/Default ist eine fachliche Entscheidung, die zentral gepflegt wird.
- EPD = die zugrundeliegenden Umweltproduktdeklarationen; ÖKOBAU.dat ist die
  (öffentliche) Datenbank darüber. Versionierung mitdenken (welche EPD-Fassung).

## Der Report (zwei Ebenen)

- **Mengen immer**: Mengenauszug pro Geschoss — Wandtypen mit Laufmetern,
  Bodenaufbauten mit m², Objektliste mit Anzahl. Das ist der stand-alone-Wert
  (eine Mengenermittlung aus dem Plan) und die m-hub-Übergabe-Vorschau in einem.
- **LCA-Zeile nur wenn m-hub verbunden**: „dieses Geschoss fügt X kg Material,
  Y kg CO₂ hinzu" — die Faktoren kommen aus m-hub. Stand-alone höchstens eine
  *als indikativ gekennzeichnete* Zeile aus einer kleinen mitgelieferten
  Faktortabelle; maßgeblich ist immer m-hubs Rechnung.

Ein Artefakt, zwei Zwecke: stand-alone die Ausgabe, integriert der
Bestätigungs-Schritt vor dem Schreiben.

## Potential / Ausbaustufen

Wenn man abschätzt, wie viel im Thema LCA/Gebäudepass steckt, misst man es an
**m-hub**, nicht am Report:

- Materialstammdaten + ÖKOBAU/EPD-Kuration (das eigentliche Kapital).
- Wirkung pro Bauteil und aggregiert pro Gebäude; über die Zeit neu rechenbar.
- Der Pass als exportierbares/teilbares Artefakt — dockt direkt an das
  Markt-/Wiederverwendungs-Thema an (verfügbare Materialmengen im Bestand).
- Multi-Quelle: Pläne heute, IFC/Punktwolken später, alles in denselben Pass.

Das 2D-Tool ist *ein* Eingabekanal und ein kompakter Testfall für die
Mengen-Input-Strecke. Die Tiefe liegt in m-hub.

## Der Testfall

Plan → Tool (Mengen) → m-hub (LCA/Pass) zeigt die ganze Kette und wo sie liegt.
Das Tool testet „können wir Mengen sauber aus einem Plan ziehen?", m-hub testet
„können wir daraus Wirkung und einen Pass machen?". Beide Strecken bleiben
getrennt testbar, weil die LCA nicht im Tool steckt.
