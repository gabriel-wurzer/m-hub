# Rundlauf Plan-Tool auf prod testen

Schritt für Schritt. Nach jedem Schritt steht, was kommen muss, und darunter,
was zu tun ist, wenn etwas anderes kommt.

Geprüft wird die ganze Kette: PDF am Gebäude, Absprung ins Plan-Werkzeug,
Wanderkennung, Schichtaufbau, Übergabe, Bauteil in m-hub. Dauer rund zehn
Minuten.

Stand 21.09.2026. Für die Schritte 1 bis 7 reicht ein Browser, VPN braucht es
erst für die Gegenprobe in Schritt 8.

## Was schon bereitliegt

Auf prod hängt am Gebäude **ÖBB Zentrale** (Konto `alice@example.com`) das
Dokument `0623372_001_004_P_BP_GR_20250206`, der Wiener-Wohnen-Wohnungsbestands-
plan im Maßstab 1:100 als Vektor-PDF. Damit wird getestet, hochladen muss
niemand mehr etwas.

In der Datenbank steht bereits ein Bauteil aus einem früheren Plan-Import
(`Wand wl9VZU`, angelegt am 18.08.2026). Nicht wundern, das ist nicht deins.

## Schritt 1 — anmelden

`https://m-hub.dap.tuwien.ac.at` öffnen, anmelden als `alice@example.com`.

Mit einem anderen Konto siehst du die ÖBB Zentrale nicht.

## Schritt 2 — zum Plan

**Bestandsverwaltung**, Gebäude **ÖBB Zentrale** anklicken, dann auf den Stift.
Runter zu **Dokumente**, Zeile `0623372_001_004_P_BP_GR_20250206`, dort auf das
**Zirkel-Symbol** (Tooltip „Plan auswerten"). Es geht ein neuer Tab auf.

Es muss kommen: der Dialog **Plan konfigurieren** mit dem gezeichneten Grundriss.

Kommt eine rote Zeile `Http failure response ... 0 Unknown Error`, läuft noch das
alte Frontend. Kommt der Dialog leer, also mit Titel aber ohne Plan, ist das
Plan-Tool nicht neu gebaut. Beides steht in `plantool-prod-deploy.md`.

## Schritt 3 — Wanderkennung

Mit der Pipette auf eine **graue Wandfläche** klicken, nicht auf eine schwarze
Linie. Rechts unter „Wandfarben" muss `223, 223, 223` stehen. Maßstab bleibt
`1:100`. Dann **Analysieren**.

Es muss oben stehen: **133 Segmente · 133 Wände**.

Stehen dort rund 1184, war es die schwarze Kontur. Auf **Erkennung**, die Farbe
mit dem X entfernen, neu picken, nochmal analysieren.

## Schritt 4 — eine Wand greifen

Eine **lange, dicke Wand** einmal anklicken. Nicht mit dem Rechteck arbeiten:
das markiert zwar viele Segmente, der Schichtaufbau gilt aber immer der
Wandgruppe des zuletzt angeklickten Segments. Das Rechteck ist zum Ausschließen
von Rauschen da.

Es muss rechts stehen: `Gemessen: ... mm` und `Länge: ... m`. Brauchbar sind
Werte um 176 mm und mehrere Meter. Steht dort eine Länge unter einem Meter,
hast du einen Schnipsel erwischt, dann eine andere Wand anklicken.

## Schritt 5 — Schichtaufbau

Rechts ins Feld **Schichtaufbau (innen → außen)** tippen:

```
Putz 15 Ziegel _ Putz 15
```

und **Enter**. Der Unterstrich heißt „Restdicke", der Ziegel bekommt also, was
zwischen den beiden Putzschichten übrig bleibt.

Es muss oben stehen: **1 mit Aufbau**. Und rechts unten muss die Summe zur
gemessenen Stärke passen, bei 176 mm gemessen also 15 + 146 + 15.

Ab jetzt **nicht mehr auf Erkennung klicken**. Die Neuerkennung wirft alle
Zuweisungen weg und es gibt kein Undo.

## Schritt 6 — Übergeben

Oben rechts **Übergeben**. Im Dialog ein Geschoss ankreuzen, dann nochmal
**Übergeben**.

Die Liste muss dieselben Geschosse zeigen wie die Verortungs-Auswahl im
Bauteil-Dialog, für die ÖBB Zentrale also Dach, Regelgeschoss 1 und 2,
Kellergeschoss 1 und 2. Steht dort ein Geschoss doppelt, läuft noch das alte
Frontend.

Es muss kommen: `Übergeben: 1 Bauteil(e), 0 Objekt(e) × 1 Geschoss(e)` mit einem
Knopf „Zurück zu m-hub".

Bleibt der Knopf grau, ist kein Geschoss angekreuzt.

## Schritt 7 — der Blick in m-hub

Zurück in m-hub, Gebäude neu laden, unter **Bauteile** muss eine neue Zeile
stehen, Name `Wand` plus sechs zufällige Zeichen, Kategorie Innenwand,
Verortung das gewählte Geschoss.

Damit ist der Rundlauf durch. Was noch fehlt, ist die Probe, dass auch der
**Inhalt** angekommen ist und nicht nur eine leere Hülle.

## Schritt 8 — Gegenprobe in der Datenbank

Jetzt VPN an. **PowerShell:**

```powershell
ssh root@locationbase.dap.tuwien.ac.at
```

**Auf dem Server:**

```sh
cd /root/m-hub
docker-compose exec -T m-hub-db psql -U postgres -d mhubdb -c "
SELECT name, location, part_type,
       part_structure->>'length' AS laenge_m,
       part_structure->'layers'  AS schichten,
       to_char(created_at,'DD.MM. HH24:MI') AS angelegt
FROM building_parts
WHERE source_extract_id IS NOT NULL
ORDER BY created_at DESC LIMIT 3;"
```

Es muss oben eine Zeile von heute stehen, ungefähr so:

```
 Wand LVc3mI | Regelgeschoss 1 | Innenwand | 7.703 |
 [{"material": "Putz",   "thickness": 15,  "layer_index": 1},
  {"material": "Ziegel", "thickness": 146, "layer_index": 2},
  {"material": "Putz",   "thickness": 15,  "layer_index": 3}]
```

Darauf kommt es an: die **Länge** stimmt mit dem überein, was im Werkzeug stand,
und die **Ziegeldicke** ist ausgerechnet. Eingetippt war nur „Rest". Wenn diese
146 dastehen, hat die ganze Kette gerechnet und nicht bloß Text durchgereicht.

Steht die Zeile da, aber `part_structure` ist leer oder ohne `layers`, dann kam
das Paket an, der Aufbau aber nicht. Ausgabe aufheben.

## Schritt 9 — aufräumen

Die Testzeile wieder entfernen, mit der Extrakt-ID aus der Abfrage oben:

```sh
docker-compose exec -T m-hub-db psql -U postgres -d mhubdb -c "
DELETE FROM building_parts
WHERE source_extract_id IS NOT NULL
  AND created_at::date = CURRENT_DATE;"
exit
```

Das lässt die alte Zeile vom 18.08. stehen und räumt nur den heutigen Lauf weg.

Wiederholen ist übrigens gefahrlos. Dieselbe Kombination aus Dokument und
Geschoss ergibt immer dieselbe Extrakt-ID, ein zweiter Durchlauf ersetzt seine
eigene Zeile und legt keine Dublette an.

## Fehlerbilder auf einen Blick

| Was du siehst | Woran es liegt |
|---|---|
| `Http failure response ... 0 Unknown Error` | m-hub-Frontend ohne den `/files`-Fix |
| Dialog geht auf, bleibt aber leer | Plan-Tool nicht neu gebaut, Rasteradresse zeigt ins Leere |
| rund 1184 statt 133 Segmente | Pipette hat die schwarze Kontur erwischt |
| Länge unter einem Meter | ein Schnipsel statt einer Wand angeklickt |
| Knopf „Übergeben" bleibt grau | kein Geschoss angekreuzt |
| Bauteil da, `part_structure` leer | Aufbau nicht zugewiesen, Schritt 5 nochmal |
