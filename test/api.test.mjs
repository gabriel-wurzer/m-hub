// Integration tests for the m-hub backend endpoints added for the big-file
// upload + 2D-plan import: /api/documents/reserve, /api/documents/:ID/attach,
// /api/import/plan. Runs inside the m-hub-test compose network against a FRESH
// database, so it also fails loudly on schema drift.

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import jwt from 'jsonwebtoken';

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
