// Integration tests for the m-hub backend endpoints added for the big-file
// upload + 2D-plan import: /api/documents/reserve, /api/documents/:ID/attach,
// /api/import/plan. Runs inside the m-hub-test compose network against a FRESH
// database, so it also fails loudly on schema drift.

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const LOGIN_EMAIL = 'logintest@mhub.local';
const LOGIN_PASSWORD = 'Test1234!';

const API = process.env.API_URL || 'http://m-hub-backend:1880';
const FILER = process.env.FILER_URL || 'http://seaweed-filer:8888';
const SECRET = process.env.JWT_SECRET || 'testsecret';

const mint = (sub) =>
  jwt.sign({ sub, username: 'test', email: 't@test.local' }, SECRET, { algorithm: 'HS256', expiresIn: '1h' });

const call = (method, path, tok, body) =>
  fetch(API + path, {
    method,
    headers: {
      ...(tok ? { Authorization: 'Bearer ' + tok } : {}),
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const claimsOf = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64').toString());

// Shared fixtures, filled in before().
const ctx = { owner: null, ub: null, building: null, token: null, otherToken: null };

before(async () => {
  const client = new pg.Client({
    host: process.env.PGHOST || 'm-hub-db',
    user: process.env.PGUSER || 'test',
    password: process.env.PGPASSWORD || 'test',
    database: process.env.PGDATABASE || 'mhubdb',
  });
  await client.connect();
  // Seed a user with a known password so the login endpoint can be tested.
  await client.query('INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)', [
    'logintest',
    LOGIN_EMAIL,
    bcrypt.hashSync(LOGIN_PASSWORD, 8),
  ]);
  const ub = await client.query('SELECT user_id, id, building_id FROM user_buildings ORDER BY id LIMIT 1');
  ctx.owner = ub.rows[0].user_id;
  ctx.ub = ub.rows[0].id;
  ctx.building = ub.rows[0].building_id;
  const other = await client.query('SELECT id FROM users WHERE id <> $1 ORDER BY id LIMIT 1', [ctx.owner]);
  ctx.token = mint(ctx.owner);
  ctx.otherToken = mint(other.rows[0].id);
  await client.end();

  // Give node-red's http routes a moment in case health flipped a hair early.
  for (let i = 0; i < 20; i++) {
    try {
      const r = await call('POST', '/api/documents/reserve', null, {});
      if (r.status === 401) break; // routes are live (auth rejects us)
    } catch {
      /* connection refused, retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
});

// --------------------------------------------------------------------------
// reserve
// --------------------------------------------------------------------------
test('reserve: 201, document reserved (file_url null) + scoped upload token', async () => {
  const res = await call('POST', '/api/documents/reserve', ctx.token, {
    building_id: ctx.building,
    user_building_id: ctx.ub,
    name: 'Reserve Test',
    file_type: 'pdf',
    file_original_name: 'my plan.pdf',
  });
  assert.equal(res.status, 201);
  const j = await res.json();
  assert.equal(j.document.file_url, null);
  assert.equal(j.document.file_type, 'pdf');
  assert.equal(j.document.owner_id, ctx.owner);
  assert.equal(j.upload.endpoint, '/upload');
  const c = claimsOf(j.upload.token);
  assert.equal(c.scope, 'upload');
  assert.equal(c.document_id, j.document.id);
  assert.equal(c.user_building_id, ctx.ub);
  assert.equal(c.filename, 'my_plan.pdf'); // sanitized
  assert.equal(c.filetype, 'pdf');
});

test('reserve: no auth -> 401', async () => {
  const res = await call('POST', '/api/documents/reserve', null, {
    building_id: ctx.building,
    user_building_id: ctx.ub,
    name: 'x',
    file_type: 'pdf',
  });
  assert.equal(res.status, 401);
});

test('reserve: missing building_id -> 400', async () => {
  const res = await call('POST', '/api/documents/reserve', ctx.token, {
    user_building_id: ctx.ub,
    name: 'x',
    file_type: 'pdf',
  });
  assert.equal(res.status, 400);
});

test('reserve: unsupported file_type -> 400', async () => {
  const res = await call('POST', '/api/documents/reserve', ctx.token, {
    building_id: ctx.building,
    user_building_id: ctx.ub,
    name: 'x',
    file_type: 'exe',
  });
  assert.equal(res.status, 400);
});

// --------------------------------------------------------------------------
// attach
// --------------------------------------------------------------------------
test('attach: 403 wrong owner, 409 no file, 400 spoofed path, 200 happy', async () => {
  const reserved = await (
    await call('POST', '/api/documents/reserve', ctx.token, {
      building_id: ctx.building,
      user_building_id: ctx.ub,
      name: 'Attach Test',
      file_type: 'pdf',
      file_original_name: 'p.pdf',
    })
  ).json();
  const doc = reserved.document.id;
  const stored = `/mhub/documents/${ctx.ub}/${doc}/p.pdf`;

  // wrong owner -> 403 (ownership checked before storage)
  let res = await call('POST', `/api/documents/${doc}/attach`, ctx.otherToken, { stored_path: stored });
  assert.equal(res.status, 403);

  // right owner but file not in storage yet -> 409
  res = await call('POST', `/api/documents/${doc}/attach`, ctx.token, { stored_path: stored });
  assert.equal(res.status, 409);

  // store the file (what m-hub-upload does on finish)
  const put = await fetch(FILER + stored, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: '%PDF-1.4 integration test',
  });
  assert.ok(put.ok, `filer PUT failed: ${put.status}`);

  // path pointing at a different document dir -> 400
  res = await call('POST', `/api/documents/${doc}/attach`, ctx.token, {
    stored_path: `/mhub/documents/${ctx.ub}/00000000-0000-4000-8000-000000000000/p.pdf`,
  });
  assert.equal(res.status, 400);

  // happy path -> 200, file_url set
  res = await call('POST', `/api/documents/${doc}/attach`, ctx.token, { stored_path: stored });
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.ok(typeof j.file_url === 'string' && j.file_url.endsWith(stored), `file_url: ${j.file_url}`);
});

// --------------------------------------------------------------------------
// import (delete-and-reallocate)
// --------------------------------------------------------------------------
const PARTS = [
  {
    location: 'Regelgeschoss 1',
    name: 'Innenwand A',
    part_type: 'Innenwand',
    part_structure: { type: 'wall', length: 5.2, layers: [{ layer_index: 1, material: 'Ziegel', thickness: 175 }] },
    is_public: true,
  },
  {
    name: 'Boden EG',
    location: 'Regelgeschoss 1',
    part_type: 'Bodenaufbau',
    part_structure: { type: 'slab', area: 42.5, layers: [{ layer_index: 1, material: 'Beton', thickness: 200 }] },
  },
];
const OBJECTS = [
  { name: 'Tuer 1', location: 'Regelgeschoss 1', object_type: 'Tür', count: 2, length: 210, width: 100, height: 20 },
];

test('import: run 1 inserts, run 2 (same extract) reallocates, not doubled', async () => {
  const extract = '22222222-2222-4222-8222-222222222222';
  const body = { building_id: ctx.building, user_building_id: ctx.ub, source_extract_id: extract, parts: PARTS, objects: OBJECTS };

  let res = await call('POST', '/api/import/plan', ctx.token, body);
  assert.equal(res.status, 200);
  let j = await res.json();
  assert.deepEqual(
    [j.parts_deleted, j.objects_deleted, j.parts_inserted, j.objects_inserted],
    [0, 0, 2, 1],
  );

  res = await call('POST', '/api/import/plan', ctx.token, body);
  assert.equal(res.status, 200);
  j = await res.json();
  assert.deepEqual(
    [j.parts_deleted, j.objects_deleted, j.parts_inserted, j.objects_inserted],
    [2, 1, 2, 1],
  );
});

test('import: nothing to import -> 400', async () => {
  const res = await call('POST', '/api/import/plan', ctx.token, {
    building_id: ctx.building,
    user_building_id: ctx.ub,
    source_extract_id: '33333333-3333-4333-8333-333333333333',
    parts: [],
    objects: [],
  });
  assert.equal(res.status, 400);
});

test('import: invalid object_type rejected by constraint -> 400', async () => {
  const res = await call('POST', '/api/import/plan', ctx.token, {
    building_id: ctx.building,
    user_building_id: ctx.ub,
    source_extract_id: '44444444-4444-4444-8444-444444444444',
    parts: [],
    objects: [{ name: 'Bad', location: 'X', object_type: 'NichtImEnum' }],
  });
  assert.equal(res.status, 400);
});

test('import: no auth -> 401', async () => {
  const res = await call('POST', '/api/import/plan', null, {
    building_id: ctx.building,
    user_building_id: ctx.ub,
    source_extract_id: '55555555-5555-4555-8555-555555555555',
    parts: PARTS,
    objects: OBJECTS,
  });
  assert.equal(res.status, 401);
});

// --------------------------------------------------------------------------
// building parts (Bauteile) CRUD
// --------------------------------------------------------------------------
const newPart = () => ({
  building_id: ctx.building,
  user_building_id: ctx.ub,
  name: 'Test Innenwand',
  location: 'Regelgeschoss 1',
  part_type: 'Innenwand',
  part_structure: { type: 'wall', length: 5.2, layers: [{ layer_index: 1, material: 'Ziegel', thickness: 175 }] },
  is_public: true,
});

test('parts: create -> list -> update -> delete', async () => {
  let res = await call('POST', '/api/parts', ctx.token, newPart());
  assert.equal(res.status, 201);
  const created = await res.json();
  assert.ok(created.id, 'created part has no id');
  assert.equal(created.part_type, 'Innenwand');
  assert.equal(created.owner_id, ctx.owner);

  res = await call('GET', `/api/parts/building/${ctx.ub}`, ctx.token);
  assert.equal(res.status, 200);
  const list = await res.json();
  assert.ok(Array.isArray(list) && list.some((p) => p.id === created.id), 'created part not in list');

  res = await call('PUT', `/api/parts/${created.id}`, ctx.token, {
    name: 'Innenwand geaendert',
    location: 'Regelgeschoss 1',
    part_type: 'Brandwand',
    part_structure: { type: 'wall', length: 6, layers: [{ layer_index: 1, material: 'Beton', thickness: 200 }] },
    is_public: false,
  });
  assert.equal(res.status, 200);
  const updated = await res.json();
  assert.equal(updated.name, 'Innenwand geaendert');
  assert.equal(updated.part_type, 'Brandwand');

  res = await call('DELETE', `/api/parts/${created.id}`, ctx.token);
  assert.ok(res.status === 200 || res.status === 204, `delete status ${res.status}`);
});

test('parts: no auth -> 401', async () => {
  const res = await call('POST', '/api/parts', null, newPart());
  assert.equal(res.status, 401);
});

test('parts: invalid part_type -> 400', async () => {
  const res = await call('POST', '/api/parts', ctx.token, { ...newPart(), part_type: 'Zauberwand' });
  assert.equal(res.status, 400);
});

test('parts: missing name -> 400', async () => {
  const p = newPart();
  delete p.name;
  const res = await call('POST', '/api/parts', ctx.token, p);
  assert.equal(res.status, 400);
});

// --------------------------------------------------------------------------
// building objects (Objekte) CRUD
// --------------------------------------------------------------------------
const newObject = () => ({
  building_id: ctx.building,
  user_building_id: ctx.ub,
  name: 'Test Tuer',
  location: 'Regelgeschoss 1',
  object_type: 'Tür',
  count: 2,
  length: 210,
  width: 100,
  height: 20,
  is_public: true,
});

test('objects: create -> list -> update -> delete', async () => {
  let res = await call('POST', '/api/objects', ctx.token, newObject());
  assert.equal(res.status, 201);
  const created = await res.json();
  assert.ok(created.id, 'created object has no id');
  assert.equal(created.object_type, 'Tür');
  assert.equal(created.count, 2);
  assert.ok(Array.isArray(created.images), 'images should be an array');

  res = await call('GET', `/api/objects/building/${ctx.ub}`, ctx.token);
  assert.equal(res.status, 200);
  const list = await res.json();
  assert.ok(Array.isArray(list) && list.some((o) => o.id === created.id), 'created object not in list');

  res = await call('PUT', `/api/objects/${created.id}`, ctx.token, {
    name: 'Tuer geaendert',
    location: 'Regelgeschoss 1',
    object_type: 'Fenster',
    count: 3,
    is_public: false,
  });
  assert.equal(res.status, 200);
  const updated = await res.json();
  assert.equal(updated.object_type, 'Fenster');
  assert.equal(updated.count, 3);

  res = await call('DELETE', `/api/objects/${created.id}`, ctx.token);
  assert.ok(res.status === 200 || res.status === 204, `delete status ${res.status}`);
});

test('objects: no auth -> 401', async () => {
  const res = await call('POST', '/api/objects', null, newObject());
  assert.equal(res.status, 401);
});

test('objects: invalid object_type -> 400', async () => {
  const res = await call('POST', '/api/objects', ctx.token, { ...newObject(), object_type: 'Teleporter' });
  assert.equal(res.status, 400);
});

test('objects: count < 1 -> 400', async () => {
  const res = await call('POST', '/api/objects', ctx.token, { ...newObject(), count: 0 });
  assert.equal(res.status, 400);
});

// --------------------------------------------------------------------------
// documents (inline base64 create)
// --------------------------------------------------------------------------
const SMALL_PDF = 'data:application/pdf;base64,JVBERi0xLjQK'; // "%PDF-1.4\n"

test('documents: create (base64) -> list -> delete', async () => {
  let res = await call('POST', '/api/documents', ctx.token, {
    building_id: ctx.building,
    user_building_id: ctx.ub,
    name: 'Base64 Doc',
    is_public: false,
    file_type: 'pdf',
    file_original_name: 'small.pdf',
    file_mime_type: 'application/pdf',
    file_data_url: SMALL_PDF,
  });
  assert.equal(res.status, 201);
  const created = await res.json();
  assert.ok(created.id, 'created document has no id');
  assert.equal(created.file_type, 'pdf');
  assert.ok(created.file_url, 'file_url should be set');

  res = await call('GET', `/api/documents/building/${ctx.ub}`, ctx.token);
  assert.equal(res.status, 200);
  const list = await res.json();
  assert.ok(Array.isArray(list) && list.some((d) => d.id === created.id), 'created document not in list');

  res = await call('DELETE', `/api/documents/${created.id}`, ctx.token);
  assert.ok(res.status === 200 || res.status === 204, `delete status ${res.status}`);
});

test('documents: missing file_data_url -> 400', async () => {
  const res = await call('POST', '/api/documents', ctx.token, {
    building_id: ctx.building,
    user_building_id: ctx.ub,
    name: 'No file',
    is_public: false,
    file_type: 'pdf',
  });
  assert.equal(res.status, 400);
});

test('documents: no auth -> 401', async () => {
  const res = await call('POST', '/api/documents', null, {
    building_id: ctx.building,
    user_building_id: ctx.ub,
    name: 'X',
    is_public: false,
    file_type: 'pdf',
    file_data_url: SMALL_PDF,
  });
  assert.equal(res.status, 401);
});

// --------------------------------------------------------------------------
// auth / login
// --------------------------------------------------------------------------
test('auth: valid credentials -> 200 + token', async () => {
  const res = await call('POST', '/api/auth/login', null, { email: LOGIN_EMAIL, password: LOGIN_PASSWORD });
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.ok(j.token && typeof j.token === 'string', 'no token issued');
  assert.equal(j.user.email, LOGIN_EMAIL);
  // the issued token must verify with the same secret the API uses
  const decoded = jwt.verify(j.token, SECRET);
  assert.ok(decoded.sub);
});

test('auth: wrong password -> 401', async () => {
  const res = await call('POST', '/api/auth/login', null, { email: LOGIN_EMAIL, password: 'nope' });
  assert.equal(res.status, 401);
});

test('auth: unknown user -> 401', async () => {
  const res = await call('POST', '/api/auth/login', null, { email: 'nobody@mhub.local', password: 'x' });
  assert.equal(res.status, 401);
});

test('auth: missing password -> 400', async () => {
  const res = await call('POST', '/api/auth/login', null, { email: LOGIN_EMAIL });
  assert.equal(res.status, 400);
});

// --------------------------------------------------------------------------
// buildings (read) — user-scoped endpoints. /api/buildings/:ID (geo details)
// is skipped here: it reads the gdal-imported buildings_details table, which
// is intentionally absent from the hermetic test stack.
// --------------------------------------------------------------------------
test('buildings: GET /api/users/me/buildings -> 200, includes own building', async () => {
  const res = await call('GET', '/api/users/me/buildings', ctx.token);
  assert.equal(res.status, 200);
  const list = await res.json();
  assert.ok(Array.isArray(list), 'expected an array');
  assert.ok(list.some((b) => b.id === ctx.ub || b.building_id === ctx.building), 'own building missing');
});

test('buildings: GET /api/users/me/buildings no auth -> 401', async () => {
  const res = await call('GET', '/api/users/me/buildings', null);
  assert.equal(res.status, 401);
});

test('buildings: GET /api/buildings/:ID/latest-structure -> 200', async () => {
  const res = await call('GET', `/api/buildings/${ctx.building}/latest-structure`, ctx.token);
  assert.equal(res.status, 200);
});
