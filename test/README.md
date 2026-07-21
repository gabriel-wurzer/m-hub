# Backend integration tests

Black-box HTTP tests for the m-hub node-red backend, run against a **fresh**
database so they also fail loudly on schema drift.

The stack in [`../docker-compose.test.yaml`](../docker-compose.test.yaml) is fully
isolated from the dev stack: own project name (`m-hub-test`), no host ports, and
the DB runs on `tmpfs` so the init scripts re-run on every start.

## Run

```bash
# from the repo root
docker compose -p m-hub-test -f docker-compose.test.yaml up --build \
    --abort-on-container-exit --exit-code-from test-runner
docker compose -p m-hub-test -f docker-compose.test.yaml down -v
```

Exit code is the test-runner's exit code (0 = green). CI runs exactly this
(`.github/workflows/ci.yml`).

**Always pass `-p m-hub-test`.** The repo `.env` sets `COMPOSE_PROJECT_NAME=m-hub`,
which overrides the `name:` in the compose file; without the explicit `-p` flag
this stack would run under the dev project and clobber the dev containers.

## What runs

The `test-runner` service connects to the fresh DB (to read a seeded user +
building and to mint a JWT with the test secret) and hits the backend over HTTP.
Assertions live in [`api.test.mjs`](api.test.mjs) using `node:test`.

Currently covered (43 tests):

- **reserve** `POST /api/documents/reserve` — 201 + scoped upload token; 401 no auth; 400 missing building_id; 400 unsupported file_type
- **attach** `POST /api/documents/:ID/attach` — 403 wrong owner; 409 file not stored; 400 spoofed path; 200 happy path (file_url set)
- **import** `POST /api/import/plan` — insert; re-import same `source_extract_id` → delete-and-reallocate (not doubled); 400 empty; 400 invalid object_type; 401 no auth
- **parts** `POST/GET .../building/:ID/PUT/DELETE /api/parts` — full create→list→update→delete; 401 no auth; 400 invalid part_type; 400 missing name
- **objects** `POST/GET .../building/:ID/PUT/DELETE /api/objects` — full CRUD; 401 no auth; 400 invalid object_type; 400 count < 1
- **documents** `POST /api/documents` (inline base64) → `GET :ID` / `GET .../building/:ID` / `GET .../by-building/:buildingId` → `PUT :ID` (metadata) → `DELETE`; 400 missing file_data_url; 401 no auth
- **auth** `POST /api/auth/login` — 200 + verifiable token; 401 wrong password; 401 unknown user; 400 missing password
- **buildings** `GET /api/users/me/buildings` (200 + own building, 401 no auth); `GET /api/buildings/:ID/latest-structure` (200)
- **market-listings** `POST` (Bauteil referencing a real part) → `GET :ID` / `GET .../?owner_id=` → `PUT :ID` → `DELETE`; `GET .../categories/counts`; 401 no auth; 400 invalid status; 400 Objekt-with-material; 400 list without a filter
- **single-resource reads** `GET /api/parts/:ID`, `GET /api/objects/:ID`
- **structure** `PUT /api/users/me/buildings/:id` — updates the storey list; 401 no auth; 400 empty structure
- Deliberately not tested: `GET /api/documents` (query-filter list) — its flow tab is disabled and the frontend method is commented out

## Adding a test

Add a `test('...', async () => { ... })` to `api.test.mjs`. `ctx` (filled in the
`before` hook) gives you a seeded `owner`, `ub`, `building`, a valid `token` and
an `otherToken` (a different user, for ownership checks). Use the `call(method,
path, token, body)` helper.

## Coverage backlog (still open)

The harness already boots the whole backend, so each is just more `test(...)`
blocks:

- **documents**: `GET /api/documents` (query filters), `.../by-building/:buildingId` (summaries), `GET /api/documents/:ID`, `PUT /api/documents/:ID`
- **buildings**: `GET /api/buildings/:ID` (geo details — needs the gdal `buildings_details` table seeded into the test stack)
- **market-listings**: remaining routes — `GET /market-listings/search`, `GET /similar-market-listings/:ID`
- **nominatim** proxy (hits an external host — mock or mark as network-dependent)

## Note: dev-DB schema drift

These tests pass on a fresh schema. The long-lived dev DB (`m-hub_pgdata`) can be
behind — e.g. its `building_objects` still had the old inline `image_*` columns
and lacked `length/width/height`. Running this suite is a quick drift check:
green here + red against dev means the dev DB needs re-init or a migration.
