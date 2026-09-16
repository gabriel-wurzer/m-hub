# Prod fuer den Abschlussworkshop herrichten (23.9.2026)

Die Live-Demo laeuft auf prod. Auf dev ist alles gebaut und geprueft, prod weiss
noch nichts davon. Dieses Runbook bringt prod auf denselben Stand.

Voraussetzung: **SSH auf prod**, also Port 22 zu `locationbase.dap.tuwien.ac.at`.
Der ist vom Arbeitsplatz aus derzeit zu (443 und 80 gehen, 22 nicht), es braucht
also das TU-VPN. Ohne SSH geht kein Schritt hier: es gibt keinen Registrierungs-
Endpunkt, der Demo-User und die DDL brauchen beide `psql`.

Reihenfolge ist wichtig. Schritt 5 (Branding) kurz vor dem Workshop, nicht jetzt.

---

## 1. Code ausrollen

Betrifft drei Aenderungen, die seit dem letzten prod-Stand dazugekommen sind:
den Splat-Viewer-Layoutfix, `xyz`/`pts` in der Typ-Whitelist und die 3D-Icons.

**Nicht `./deploy.sh` nehmen.** Das baut alle Services, re-importiert
`buildings_details` ueber gdal und laedt die Bauperioden-Tabelle neu. Fuer diese
drei Aenderungen reicht der gezielte Weg:

```bash
ssh root@locationbase.dap.tuwien.ac.at
cd /root/m-hub
git status --porcelain --untracked-files=no   # muss leer sein
git pull --ff-only
docker-compose build m-hub-frontend
docker-compose up -d m-hub-frontend
docker-compose restart m-hub-backend
```

Der Backend-Neustart ist noetig, weil die Typ-Whitelist in `flows.json` steht.

## 2. Schema nachziehen

Pflichtschritt, sonst laesst sich die Punktwolken-Vorschau nicht ablegen.
Protokolliert in `m-hub-db/SCHEMA-AENDERUNGEN.md`, dort als offen vermerkt.

```bash
cd /root/m-hub
docker-compose exec -T m-hub-db sh -c \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < m-hub-db/migrations/2026-09_document_xyz_type.sql
```

Danach den Protokolleintrag von „auf prod noch offen" auf erledigt setzen.

## 3. Demo-User und Gebaeude

`Demo` / `demo@m-hub.at`, Passwort-Hash von Alice uebernommen, also dasselbe
Passwort wie Alice. Idempotent, mehrfaches Laufen legt nichts doppelt an.

```sql
SET client_encoding TO 'UTF8';

INSERT INTO users (username, email, password_hash)
SELECT 'Demo', 'demo@m-hub.at', password_hash
  FROM users WHERE email = 'alice@example.com'
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_buildings (user_id, building_id, structure, name, address)
SELECT u.id, '5552013',
  '[{"type":"Dach","roofType":"Steildach"},
    {"type":"Regelgeschoss","count":6,"area":416,"height":350},
    {"type":"Regelgeschoss","count":1,"area":416,"height":400,"description":"Erdgeschoss"},
    {"type":"Kellergeschoss","count":1,"area":416,"height":250}]'::jsonb,
  'Schwarzspanierstraße 18', 'Schwarzspanierstraße 18, 1090 Wien'
  FROM users u WHERE u.email = 'demo@m-hub.at'
ON CONFLICT (user_id, building_id) DO NOTHING;

-- Die zurueckgegebene user_building_id wird in Schritt 4 gebraucht.
SELECT ub.id FROM user_buildings ub JOIN users u ON u.id = ub.user_id
 WHERE u.email = 'demo@m-hub.at';
```

Die Struktur ist aus den echten Gebaeudedaten abgeleitet: Grundflaeche
415,93 m2, Bruttogrundflaeche 3.298,46 m2, maximale Hoehe 27,71 m,
Bauperiode bis 1918.

## 4. Die sieben Dokumente

Zusammen rund 790 MB. **Prod holt sie selbst aus der TUcloud**, das spart den
Upload von hier. Nur die ausgeduennte Vorschau wird per `scp` mitgegeben, die
ist lokal erzeugt worden.

| Datei | Typ | Groesse | Herkunft |
|---|---|---|---|
| `schadstoff-pruefbericht.pdf` | pdf | 12,9 MB | TUcloud `AP3/Schwarzspanierstraße 18/` |
| `bodenfliese-rot.ply` | ply | 26,8 MB | TUcloud `AP3/GaussianSplats/` |
| `bodenfliese-weiss.ply` | ply | 18,7 MB | TUcloud `AP3/GaussianSplats/` |
| `handwaschbecken.ply` | ply | 193,2 MB | TUcloud `AP3/GaussianSplats/` |
| `demo-modell.ifc` | ifc | 40,8 MB | threejs-Sample, Platzhalter |
| `stiegenhaus-original.laz` | laz | 494,7 MB | TUcloud `Diplomarbeit Brammer/Punktwolken/` |
| `stiegenhaus-vorschau.xyz` | xyz | 5,2 MB | lokal ausgeduennt, per `scp` |

Ablage im Filer unter `/mhub/documents/<user_building_id>/<document_id>/<name>`,
danach je eine Zeile in `documents` mit genau diesem Pfad als `file_url`. Das ist
derselbe Weg, den node-red intern geht.

Die Vorschau entsteht aus der 236-MB-PCD: 20.621.165 Punkte, jeder 82. behalten,
ergibt 251.478 Punkte und 5,2 MB. Bewusst grob, damit der Browser sie fluessig
dreht.

## 5. Branding (erst kurz vor dem Workshop)

Siehe `docs/branding-umstellen.md`. Kurzfassung: `.env` auf
`FRONTEND_BRANDING=default`, dann `docker-compose build m-hub-frontend` und
`up -d`. Ein `restart` allein reicht nicht, Branding ist ein Build-Arg.

Danach zeigt prod m-hub statt HarvestMAP. Die Rosina-Folie laeuft deshalb ueber
den vorproduzierten HarvestMAP-Clip.

## 6. Pruefen

```bash
curl -s https://m-hub.dap.tuwien.ac.at | grep -oE "<title>[^<]*</title>"
curl -s "https://m-hub.dap.tuwien.ac.at/api/buildings/5552013" | head -c 300
```

Im Browser als `Demo` anmelden, Schwarzspanierstraße 18 oeffnen, alle sieben
Dokumente sichtbar. Je einmal den Splat-, den IFC- und den Punktwolken-Viewer
oeffnen. Auf dev sieht das so aus: Splat rendert die Fliese, IFC meldet
7.741 Bauteile, Punktwolke meldet 251.478 Punkte.

## Was danach kommt

Erst wenn 1 bis 5 stehen, die Playwright-Clips gegen prod drehen. Vorher nicht,
sonst zeigen sie leere Dokumentlisten oder das falsche Branding.
