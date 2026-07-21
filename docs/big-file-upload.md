# m-hub: Großdatei-Upload (Punktwolken, IFC, Pläne)

Status: **umgesetzt & getestet** (2026-07-21) · Konzept unten unverändert als Referenz

## Umsetzungsstand (2026-07-21)

Der Entwurf unten ist gebaut. Konkret:

- **`m-hub-upload`** (neuer Dienst, `./m-hub-upload`): Express + tus-Server, streamt
  resumable direkt zum Filer unter `/mhub/documents/<user_building_id>/<document_id>/<name>`.
  Verifiziert das m-hub-JWT und erzwingt `scope:"upload"` — der Store-Pfad kommt aus
  den signierten Claims, nicht aus Client-Metadaten. Tests: resumable 2-Chunk +
  HEAD-Resume + Filer-Store, sowie Auth (Upload-Token 201, falscher Scope 403, kein Token 401).
- **node-red** (3 neue Flows, gleiches Muster wie Bestand): `POST /api/documents/reserve`
  (Doc metadaten-only anlegen, kurzlebiges Upload-JWT ausgeben), `POST /api/documents/:ID/attach`
  (Owner-Check, Pfad-Präfix-Check, Filer-HEAD, `file_url` setzen).
- **Frontend** (`m-hub-frontend`): `tus-js-client`. Der Dialog liest Dateien >25 MB
  **nicht** mehr als Base64; `DocumentService.uploadResumable` macht reserve → tus → attach.
  Kleine Dateien bleiben auf dem Base64-Weg. **Im Browser verifiziert** (30-MB-`.e57`
  hochgeladen, Datei landet mit voller Größe im Filer, `file_url` gesetzt).
- **Verdrahtung**: `m-hub-upload` in `docker-compose.yaml` (gleiches `JWT_SECRET`),
  Frontend-nginx `location ^~ /upload` (streaming, `proxy_request_buffering off`),
  dev-`proxy.conf.json`.

**Offen (Deploy):** Host-nginx `/upload`-Location auf dem Photon-Server (serverseitig,
nicht im Repo), Prod-Deploy, `git push`. Der Base64-Weg + das alte 100-MB-Dialog-Cap
sind bewusst als Fallback für kleine Dateien geblieben.

---

## (Original-Entwurf)

Status: Entwurf · 2026-07-17 · für Abstimmung mit Lukas (node-red-Backend)

## 1. Ziel & Umfang

Große Dateien (Punktwolken e57/las/laz/ply, 3D/IFC, große PDFs) sollen **im Web**
hochladbar sein — **resumable** (Abbruch setzt fort), ohne FTP, ohne dass die
Bytes über node-red laufen. Kleine Uploads (Bilder, kleine PDFs) bleiben auf dem
bestehenden Weg.

Entscheidungen (getroffen): eigener Upload-Dienst statt nginx-`auth_request`;
Resumable von Anfang an (tus).

## 2. Ist-Zustand (verifiziert)

- Frontend liest die Datei als **Base64-Data-URL** (`FileReader.readAsDataURL`)
  und schickt sie als JSON an node-red.
- node-red (`flows.json`, Function „build SQL query") dekodiert
  `Buffer.from(dataUrl, "base64")` — **ganze Datei im RAM** — und macht einen
  **`PUT` roh an den SeaweedFS-Filer**: `SEAWEED_FILER_INTERNAL_URL` +
  `/mhub/documents/<user_id>/<document_id>/<name>`, Content-Type = MIME.
- In der DB steht der **relative Pfad** (`documents.file_url`); beim Ausliefern
  wird `SEAWEED_PUBLIC_BASE_URL` vorangestellt. Alt-Datei-Cleanup per `DELETE`.
- Server-Cap in der Function: 1 GB (durch den Base64-Weg praktisch unerreichbar).
- Typ-Whitelist (Frontend + node-red + DB-Check) deckt Punktwolke/IFC/PDF bereits ab.
- Grenzen der Kette: Host-nginx `50m` (bleibt), Dialog `100 MB`,
  node-red `apiMaxLength: 200mb`.
- Serving: nginx `^~ /files/` → `seaweed-filer:8888` (proxyt aktuell **alle**
  Methoden, ungefiltert).

Der Filer spricht also bereits „PUT Rohbytes an einen Pfad" — die Ziel-Architektur
nutzt genau das, nur streamend und an node-red vorbei.

## 3. Ziel-Architektur (Überblick)

Drei-Schritt-Ablauf (presigned-Upload, resumable):

```
Browser                     node-red                m-hub-upload (tus)      SeaweedFS
  │  1. POST /api/documents (Metadaten, keine Datei)                          
  │ ───────────────────────────►  legt Doc-Zeile an, gibt { id } zurück       
  │  ◄─── { id }                                                              
  │                                                                           
  │  2. tus-Upload (resumable, JWT)                                           
  │ ─────────────────────────────────────────────►  prüft JWT (pre-create)   
  │        PATCH/HEAD (Chunks, Fortsetzen) ◄──────►  speichert Chunks         
  │                                                  onUploadFinish:          
  │                                                   → Datei in Filer  ──────►  /mhub/documents/<user>/<id>/<name>
  │                                                   → POST intern an node-red (Pfad + Doc-id)
  │                                                                           
  │                              3. node-red setzt file_url (HEAD-verifiziert)
  │  ◄─── Upload fertig (Client pollt Doc oder bekommt Event)                 
```

Bytes gehen **Browser → m-hub-upload → Filer**. node-red macht nur Metadaten +
Auth-Bestätigung. Kein Base64, kein node-red-Puffern.

## 4. Komponenten

### 4.1 `m-hub-upload` (neuer Container)

- Node/Express + **tus-node-server** (`@tus/server`). tus = HTTP-Protokoll für
  resumable Uploads (Chunks via `PATCH`, Fortsetzen via `HEAD`/Offset).
- **Auth:** `onIncomingRequest`/pre-create-Hook validiert das **JWT** (dasselbe
  wie überall) und prüft, dass die Ziel-Metadaten (`document_id`, `user_id`) zum
  Token passen. Ungültig → 401, kein Upload.
- **Store (Sub-Entscheidung, siehe §5):** `FileStore` (lokales Volume) oder
  `S3Store` → SeaweedFS-S3.
- **onUploadFinish-Hook:** legt die fertige Datei unter dem finalen Filer-Pfad ab
  (bzw. bei S3Store liegt sie schon dort) und ruft node-red intern
  (`POST /api/internal/documents/:id/attach`, per Shared-Secret) mit dem Pfad an.
- Läuft nur im Docker-Netz; von außen nur über die nginx-`/upload/`-Location.

### 4.2 node-red (mit Lukas abstimmen)

Drei kleine Ergänzungen, keine Bytes:

1. `POST /api/documents` **ohne Datei erlauben** (Metadaten-only) → `{ id }`.
   (Der bestehende Weg mit `file_data_url` bleibt für kleine Uploads.)
2. `POST /api/internal/documents/:id/attach` (intern, Shared-Secret, nur aus dem
   Docker-Netz): setzt `file_url`, `file_type`, `file_mime_type` nach **`HEAD`**
   am Filer (Datei existiert?). Enthält die bestehende Alt-Datei-Cleanup- und
   Public-URL-Logik.
3. `GET /api/upload/verify-jwt` (optional) falls der Dienst die JWT-Prüfung an
   node-red delegieren soll statt selbst — bei Dienst B eher selbst prüfen.

### 4.3 nginx

- **Neue Location `/upload/`** (Host **und** Container-nginx): `proxy_pass` →
  `m-hub-upload`, `proxy_request_buffering off`, **eigener** `client_max_body_size`
  (hoch/`0`) und lange Timeouts. tus-Methoden (`POST`/`PATCH`/`HEAD`/`OPTIONS`)
  und tus-Header durchlassen.
  → Der allgemeine `50m` am Host **bleibt**; nur diese eine Location kriegt die
  Ausnahme. (Ohne die stirbt jeder Großupload am Host-Eingang.)
- **`/files/` auf `GET`/`HEAD` beschränken** — Schreiben zum Filer nur noch über
  den authentifizierten `/upload/`-Weg.

### 4.4 Frontend

- **tus-js-client** im Dokument-Dialog für große/schwere Typen: erst `POST
  /api/documents` (Reserve → id), dann tus-Upload mit Fortschritt/Pause/Resume,
  Doc-id + Metadaten als tus-Metadata, JWT im Header.
- Kleine Bilder/PDFs behalten den Base64-Weg (kein Rückbau); Umschaltung z.B. nach
  Größe/Typ.

## 5. Sub-Entscheidung: tus-Store

- **A) `FileStore` (lokales Volume) → on-finish `PUT` an den Filer.** Einfachste
  Variante, behält die heutige Pfad-/Serving-Konvention 1:1. Nachteil: der
  laufende Upload liegt temporär auf der Platte des Dienstes (bis Dateigröße),
  danach nochmal `PUT` in den Filer.
- **B) `S3Store` → SeaweedFS-S3-Gateway.** Chunks gehen direkt via S3-Multipart in
  Seaweed, kein doppeltes Ablegen, besser für Mehr-GB. Braucht das Seaweed-S3-API
  aktiv + Bucket-/Pfad-Mapping auf die `file_url`-Konvention.

Empfehlung: **mit A starten** (weniger bewegliche Teile, Serving unverändert), auf
B wechseln wenn die lokale Zwischenablage bei sehr großen Dateien stört.

## 6. Auth & Sicherheit

- Upload nur mit gültigem JWT (im `m-hub-upload`-Dienst geprüft), Pfad an
  `user_id`/`document_id` gebunden.
- `/files/` read-only (GET/HEAD); kein ungeschützter PUT/DELETE mehr zum Filer.
- Interner node-red-`attach`-Endpoint mit Shared-Secret, nur aus dem Docker-Netz.
- Seaweed-S3-Credentials (falls §5-B) nur im Upload-Dienst.

## 7. Datenmodell

- `documents.file_url` = finaler Pfad (wie heute). Optional ein
  `upload_status` (`pending`/`ready`/`failed`), damit das Frontend „wird noch
  hochgeladen" anzeigen kann, bevor `attach` durch ist.

## 8. Grenzen/Caps

- Host-nginx allgemein: `50m` (unverändert).
- `/upload/`-Location: hoch/`0`, streamend, lange Timeouts.
- Dialog: bei tus-Uploads kein 100-MB-Cap (bzw. sinnvolles Obergrenze setzen).

## 9. Rollout (gestaffelt)

1. `m-hub-upload` lokal bauen + testen (tus gegen lokalen Seaweed, JWT-Mock).
2. node-red-Endpoints mit Lukas (Reserve ohne Datei, interner `attach`).
3. nginx-Locations (Container zuerst, dann Host) + `/files/` GET-only.
4. Frontend tus-Client hinter einem Feature-Schalter.
5. Prod-Deploy auf dockerhost3, Ende-zu-Ende mit einer echten Punktwolke.

## 10. Offene Punkte / für Lukas

- tus-Store A vs B (§5) — Start mit A vorgeschlagen.
- Genaue Form des internen `attach` (Shared-Secret vs mTLS im Docker-Netz).
- Ob `POST /api/documents` metadaten-only sauber in die bestehenden Flows passt
  oder ein eigener Reserve-Endpoint klarer ist.
- Obergrenze für tus-Uploads (Disk/Quota-Schutz).
