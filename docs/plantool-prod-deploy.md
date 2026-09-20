# Plan-Tool auf prod nachziehen

Stand 20.09.2026. Gilt für `m-hub.dap.tuwien.ac.at` (Host `dockerhost3`, SSH
`root@locationbase.dap.tuwien.ac.at`, Repo `/root/m-hub`).

## Warum

Der Absprung m-hub → Plan-Tool war seit dem ersten Deploy (23.07.2026) kaputt:
m-hub reichte dem Tool den Seaweed-Speicherpfad `/mhub/documents/...` weiter statt
der Auslieferungsadresse `/files/mhub/documents/...`. nginx antwortete darauf mit
der SPA-Indexseite, das Tool versuchte HTML als PDF zu lesen. Deshalb hat der
Rundlauf aus der Dokumentenliste heraus auf prod nie funktioniert.

Behoben in `55cb357`. Der Commit ändert **beide Seiten**, also müssen beide neu
gebaut werden: das m-hub-Frontend und das Plan-Tool.

## Was auf prod fehlt

| | Stand prod | Soll |
|---|---|---|
| m-hub-Frontend | ohne `fileHref()` | `55cb357` |
| Plan-Tool-Container | `a145258` (13.08.2026) | `55cb357`, dazwischen liegt `21a75b9` (nachbarkontakt, nie deployt) |
| Tabelle `market_listing_documents` | fehlt | aus `2026-09_market_listing_documents.sql` |
| Dateityp-Whitelist `xyz`/`pts` | fehlt | aus `2026-09_document_xyz_type.sql` |

Schon vorhanden und **nicht** anzufassen: `PLAN_TOOL_URL=/plantool` in
`/root/m-hub/.env`, `PLANIMPORT_BASE_HREF=/plantool/` in
`/root/m-hub/m-hub-planimport/.env`, der `location /plantool/`-Block in
`/etc/nginx/conf.d/m-hub.conf`, die Spalten `length/width/height/address` auf
`market_listings` samt Trigger-Funktion.

## Schritte

Alles auf dem Host. `docker-compose` mit Bindestrich, das ist dort v1.
**Kein `./deploy.sh`** — das fährt den ganzen Stack runter und importiert das
GeoPackage neu.

```sh
cd /root/m-hub

# 1. Sicherung der beiden Dateien, die der Pull anfasst
cp .env .env.bak-plantool-$(date +%Y%m%d)
cp m-hub-backend/data/flows.json m-hub-backend/data/flows.json.bak-plantool-$(date +%Y%m%d)

# 2. Rollback-Marke für das Frontend-Image
docker tag m-hub-frontend:latest m-hub-frontend:vor-plantool-fix

# 3. Code holen
git pull --ff-only
git log --oneline -1          # muss 55cb357 oder neuer sein

# 4. Migrationen (idempotent)
docker-compose exec -T m-hub-db psql -U postgres -d mhubdb \
  < m-hub-db/migrations/2026-09_document_xyz_type.sql
docker-compose exec -T m-hub-db psql -U postgres -d mhubdb \
  < m-hub-db/migrations/2026-09_market_listing_documents.sql

# 5. m-hub-Frontend neu bauen (Branding kommt aus der .env, bleibt materialnomaden)
docker-compose build m-hub-frontend
docker-compose up -d m-hub-frontend

# 6. node-red neu starten, damit die flows.json aus dem Pull greift
docker-compose restart m-hub-backend

# 7. Plan-Tool, eigenes Compose-Projekt
cd m-hub-planimport
docker-compose -p planimport build
docker-compose -p planimport up -d
```

## Prüfen

```sh
curl -sI https://m-hub.dap.tuwien.ac.at/karte      | head -1   # 200
curl -sI https://m-hub.dap.tuwien.ac.at/plantool/  | head -1   # 200
curl -s  https://m-hub.dap.tuwien.ac.at/plantool/  | grep -o '<base href="[^"]*"'   # /plantool/
```

Dann von Hand: ein PDF-Dokument an einem Gebäude öffnen, **Plan auswerten**
klicken. Richtig ist, wenn der Setup-Dialog mit dem gerasterten Plan aufgeht.
Kommt stattdessen „Http failure response ... 0 Unknown Error", ist das Frontend
noch das alte.

## Echter Rundlauf

Testmaterial ist der Vektorplan, **nicht** der Scan:
`AP3-DATENERHEBUNG/M-HUB_TU Wien/M-HUB_TU Wien/23_FÄRBERMÜHLGASSE 12-14/0623372_001_004_P_BP_GR_20250206.pdf`

Im Setup-Dialog: Pipette auf das graue Wandfleisch (RGB 223,223,223), **nicht**
auf die schwarze Kontur, Maßstab 1:100. Richtig ist mmPerUnit 35,28 und
133 Segmente. Trifft man Schwarz, werden es ~1184 Rauschsegmente.

Danach Wände auswählen, Schichtaufbau im Feld „Schichtaufbau (innen → außen)"
eintippen (z.B. `Putz 15 Ziegel _ Putz 15`, Enter), **Übergeben**, Geschoss
ankreuzen. Zweimal übergeben legt keine Dubletten an, die `source_extract_id`
ersetzt den vorigen Stand desselben Extrakts.

Nicht auf **Erkennung** klicken, wenn schon Aufbauten zugewiesen sind: die
Neuerkennung wirft sie weg, es gibt kein Undo.

## Rollback

```sh
cd /root/m-hub
docker tag m-hub-frontend:vor-plantool-fix m-hub-frontend:latest
docker-compose up -d --force-recreate m-hub-frontend
```

Die Migrationen sind additiv und brauchen keinen Rollback.
