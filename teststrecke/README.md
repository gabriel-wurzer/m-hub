# Teststrecke

End-to-End-Tests fuer m-hub, die gegen den **laufenden** docker-compose-Stack fahren
(kein Mock) und PASS/FAIL melden. Gedacht zum **Herzeigen**: ein Kommando fuehrt den
kompletten Pfad an echten Uploads/Jobs durch, lokal wie auf prod.

## Was abgedeckt ist (Download-1: Punktwolke -> reduziertes IFC)

| Suite | Datei | Prueft |
|-------|-------|--------|
| Upload-Resume | `test_upload_resume.py` | idempotenter `reserve` (Dedup, Race -> genau 1 Zeile, 48h-Token, nach `attach` neue Zeile) |
| Point2IFC-Job | `test_point2ifc_job.py` | durabler Job-Status: `queued->running->done`, Race-Dedup, `404 -> "abgebrochen"`, OOM-Rehydrate, Traceback-Sanitisierung |
| IFC-Dokument | `test_ifc_document.py` | reduziertes IFC wird eigenes Dokument (seaweed + `documents`), abrufbar, idempotent, Dateiname aus der Quelle, Summary-Query |

## Voraussetzungen

- Der Stack laeuft (`docker compose up -d`), erreichbar unter den konfigurierten URLs.
- `docker` im PATH (die Tests lesen die DB via `docker exec ... psql`).
- Nur Python-stdlib, keine pip-Abhaengigkeiten.
- Fuer die **Verarbeitungs-Suiten** eine echte Punktwolke via `P2I_PC_FILE` (`.laz/.las/.ply/.pcd`).
  Fehlt sie, werden diese Suiten sauber uebersprungen (SKIP) statt zu scheitern.

## Ausfuehren

```bash
# Lokal (Default-Konfiguration), nur Upload-/reserve-Tests:
python3 run_teststrecke.py

# Lokal, voller Durchlauf mit Punktwolke:
P2I_PC_FILE=/pfad/zu/scan.pcd python3 run_teststrecke.py

# Gegen prod (auf dem Host ausfuehren, https-URL, prod-DB-Container):
P2I_NODE=https://m-hub.dap.tuwien.ac.at P2I_DB_CONT=m-hub-m-hub-db-1 \
  P2I_PC_FILE=/root/scan.pcd python3 run_teststrecke.py
```

Einzelne Suite: `python3 -c "import test_ifc_document as t, harness; t.run(harness.Results())"`.

## Konfiguration (Umgebungsvariablen)

| Variable | Default | Bedeutung |
|----------|---------|-----------|
| `P2I_NODE` | `http://localhost:1880` | node-red-API (`/api/...`) |
| `P2I_SEAWEED` | `http://localhost:8888` | SeaweedFS-Filer |
| `P2I_P2I` | `http://localhost:8972` | Point2IFC-Job-Service |
| `P2I_DB_CONT` | `m-hub-m-hub-db-1` | DB-Container (fuer `docker exec psql`) |
| `P2I_P2I_CONT` | `m-hub-m-hub-point2ifc-1` | Point2IFC-Container (fuer den Rehydrate-Test) |
| `P2I_DB_USER` / `P2I_DB_NAME` | `postgres` / `mhubdb` | DB-Credentials |
| `P2I_ENV` | `../.env` | Datei mit `JWT_SECRET` (zum Token-Minten) |
| `P2I_PC_FILE` | – | Punktwolke fuer die Verarbeitungs-Suiten |

## Hinweise

- Die Tests **raeumen hinter sich auf** (angelegte Testdokumente werden geloescht) und
  leiten `owner/user_building/building` aus einem Bestandsdokument ab — kein Hardcoding,
  laeuft gegen lokal und prod.
- Der Rehydrate-Test **startet den Point2IFC-Container neu** (`docker restart`). Auf prod
  nur in ruhigen Fenstern laufen lassen.
