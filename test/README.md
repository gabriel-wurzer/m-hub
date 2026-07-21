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

Currently covered:

- `POST /api/documents/reserve` — 201 + scoped upload token; 401 no auth; 400 missing building_id; 400 unsupported file_type
- `POST /api/documents/:ID/attach` — 403 wrong owner; 409 file not stored; 400 spoofed path; 200 happy path (file_url set)
- `POST /api/import/plan` — insert; re-import same `source_extract_id` → delete-and-reallocate (not doubled); 400 empty; 400 invalid object_type; 401 no auth

## Adding a test

Add a `test('...', async () => { ... })` to `api.test.mjs`. `ctx` (filled in the
`before` hook) gives you a seeded `owner`, `ub`, `building`, a valid `token` and
an `otherToken` (a different user, for ownership checks). Use the `call(method,
path, token, body)` helper.

## Coverage backlog (planned, separate effort)

Everything below still needs cases. The harness already boots the whole backend,
so each is just more `test(...)` blocks (auth ones may need a seeded plaintext
password or a minted token):

- **auth**: `POST /api/auth/login` (valid, wrong password, unknown user)
- **buildings**: `GET /api/buildings/:ID`, `GET /api/buildings/:ID/latest-structure`, `GET /api/users/me/buildings`
- **documents**: `GET /api/documents`, `.../building/:ID`, `.../by-building/:buildingId`, `POST` (base64 create), `PUT/DELETE /api/documents/:ID`
- **parts**: `GET/POST/PUT/DELETE /api/parts`, `.../building/:ID`
- **objects**: `GET/POST/PUT/DELETE /api/objects`, `.../building/:ID`
- **marketlistings** (init 06)
- **structure update** endpoints
- **nominatim** proxy

## Note: dev-DB schema drift

These tests pass on a fresh schema. The long-lived dev DB (`m-hub_pgdata`) can be
behind — e.g. its `building_objects` still had the old inline `image_*` columns
and lacked `length/width/height`. Running this suite is a quick drift check:
green here + red against dev means the dev DB needs re-init or a migration.
