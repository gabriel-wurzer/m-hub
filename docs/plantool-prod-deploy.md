# Plan-Tool auf prod nachziehen

Schritt für Schritt, zum Abarbeiten von oben nach unten. Nach jedem Block steht,
was kommen muss. Kommt etwas anderes, steht darunter, was zu tun ist.

Stand 20.09.2026. Ziel ist `m-hub.dap.tuwien.ac.at`, Repo auf dem Server liegt
unter `/root/m-hub`.

Warum das Ganze: der Absprung m-hub → Plan-Tool hat seit dem ersten Deploy im
Juli nie funktioniert. m-hub gab dem Tool den Speicherpfad `/mhub/documents/...`
statt der Auslieferungsadresse `/files/mhub/documents/...`, nginx antwortete mit
der SPA-Indexseite, das Tool las HTML als PDF. Behoben in `55cb357`. Der Commit
ändert beide Seiten, deshalb weiter unten zwei Builds.

---

## Vorher

VPN an. Ohne VPN kein SSH auf den Server.

## Schritt 1 — einloggen

**PowerShell** auf deinem Rechner:

```powershell
ssh root@locationbase.dap.tuwien.ac.at
```

Es muss kommen: ein Prompt `root@dockerhost3:~#`.

Ab hier läuft alles **auf dem Server**. Jeder weitere Block wird dort
hineinkopiert.

## Schritt 2 — sichern und Code holen

```sh
cd /root/m-hub
cp .env .env.bak-$(date +%Y%m%d)
cp m-hub-backend/data/flows.json m-hub-backend/data/flows.json.bak-$(date +%Y%m%d)
docker tag m-hub-frontend:latest m-hub-frontend:rollback
git pull --ff-only
git log --oneline -1
```

Es muss kommen: `b7264fc docs: runbook fuer den plantool-deploy auf prod ...`
oder etwas Neueres.

Kommt stattdessen `error: Your local changes ... would be overwritten`: **stopp**,
nicht weitermachen, Ausgabe aufheben. Jemand hat am Server etwas geändert.

## Schritt 3 — Datenbank nachziehen

```sh
cd /root/m-hub
docker-compose exec -T m-hub-db psql -U postgres -d mhubdb -f /dev/stdin < m-hub-db/migrations/2026-09_document_xyz_type.sql
docker-compose exec -T m-hub-db psql -U postgres -d mhubdb -f /dev/stdin < m-hub-db/migrations/2026-09_market_listing_documents.sql
```

Es muss kommen: `ALTER TABLE`, `CREATE TABLE`, `CREATE INDEX` und ähnliches.
Kein `ERROR`.

Beide Skripte sind idempotent, zweimal laufen lassen schadet nicht.

## Schritt 4 — m-hub-Frontend neu bauen

```sh
cd /root/m-hub
docker-compose build m-hub-frontend
docker-compose up -d m-hub-frontend
```

Der Build dauert ein paar Minuten und ist lange still. Nicht abbrechen.

Es muss kommen: am Ende `Container m-hub-m-hub-frontend-1  Started`.

Das Branding bleibt HarvestMAP, das kommt aus der `.env` am Server und wird
nicht angefasst.

## Schritt 5 — node-red neu starten

```sh
docker-compose restart m-hub-backend
```

Es muss kommen: `Container m-hub-m-hub-backend-1  Started`.

## Schritt 6 — Plan-Tool neu bauen

Das ist ein eigenes Compose-Projekt, deshalb der Ordnerwechsel und das `-p`.

```sh
cd /root/m-hub/m-hub-planimport
docker-compose -p planimport build
docker-compose -p planimport up -d
cd /root/m-hub
```

Es muss kommen: `Container planimport-planimport-frontend-1  Started`.

## Schritt 7 — kurz prüfen

```sh
docker image inspect m-hub-frontend --format '{{.Created}}'
curl -so /dev/null -w 'karte    %{http_code}\n' https://m-hub.dap.tuwien.ac.at/karte
curl -so /dev/null -w 'plantool %{http_code}\n' https://m-hub.dap.tuwien.ac.at/plantool/
```

Es muss kommen: ein Datum von heute, dann `karte 200` und `plantool 200`.

Danach:

```sh
exit
```

## Schritt 8 — echter Durchlauf im Browser

Ausführlich, mit Soll-Werten nach jedem Schritt und einer Gegenprobe in der
Datenbank, steht das in [plantool-rundlauf-test.md](plantool-rundlauf-test.md).
Die Kurzfassung:

1. `https://m-hub.dap.tuwien.ac.at` öffnen, anmelden als `alice@example.com`.
2. **Bestandsverwaltung**, Gebäude **ÖBB Zentrale** anklicken, dann auf den
   Stift (bearbeiten).
3. Runter zu **Dokumente**. Der Testplan liegt dort schon:
   `0623372_001_004_P_BP_GR_20250206`.
4. In der Zeile dieses Dokuments auf das **Zirkel-Symbol** (Tooltip
   „Plan auswerten"). Es geht ein neuer Tab auf.

   Es muss kommen: der Dialog **Plan konfigurieren** mit dem gezeichneten Plan.

   Kommt stattdessen eine rote Zeile `Http failure response ... 0 Unknown Error`:
   das Frontend ist noch das alte, Schritt 4 wiederholen.

5. **Pipette**: auf eine **graue Wandfläche** klicken, nicht auf eine schwarze
   Linie. Rechts unter „Wandfarben" muss `223, 223, 223` stehen. Maßstab auf
   `1:100` lassen. Dann **Analysieren**.

   Es muss oben stehen: **133 Segmente**.

   Stehen dort rund **1184**, hast du Schwarz erwischt. Dann auf **Erkennung**,
   die Farbe mit dem X entfernen, neu picken, nochmal Analysieren.

6. Eine **lange, dicke Wand** einmal anklicken. Kein Rechteck: das markiert zwar
   viele Segmente, der Aufbau gilt aber immer der Wandgruppe des zuletzt
   angeklickten. Rechts muss eine Länge von mehreren Metern stehen.
7. Rechts ins Feld **Schichtaufbau (innen → außen)** tippen:
   `Putz 15 Ziegel _ Putz 15` und **Enter**. Oben springt der Zähler auf
   „1 mit Aufbau".
8. Oben rechts **Übergeben**, ein Geschoss ankreuzen, nochmal **Übergeben**.

   Es muss kommen: `Übergeben: 1 Bauteil(e), 0 Objekt(e) × 1 Geschoss(e)` mit
   einem Knopf „Zurück zu m-hub".

9. Zurück in m-hub, Gebäude neu laden, unter **Bauteile** steht der neue
   Eintrag mit dem Geschoss.

Fertig. Ab hier funktioniert der Weg Plan → Bauteil auf prod.

**Nicht** auf **Erkennung** klicken, wenn schon Aufbauten zugewiesen sind. Die
Neuerkennung wirft sie weg und es gibt kein Undo.

---

## Notbremse

Wenn nach Schritt 4 die Seite kaputt ist:

```sh
cd /root/m-hub
docker tag m-hub-frontend:rollback m-hub-frontend:latest
docker-compose up -d --force-recreate m-hub-frontend
```

Die Migrationen aus Schritt 3 fügen nur hinzu und brauchen keinen Rollback.

## Was schon am Server steht und nicht angefasst wird

`PLAN_TOOL_URL=/plantool` in `/root/m-hub/.env`,
`PLANIMPORT_BASE_HREF=/plantool/` in `/root/m-hub/m-hub-planimport/.env`,
der `location /plantool/`-Block in `/etc/nginx/conf.d/m-hub.conf`,
und auf `market_listings` die Spalten `length/width/height/address` samt
Trigger-Funktion.
