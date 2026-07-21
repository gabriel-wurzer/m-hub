// Resumable-upload test for m-hub-upload. Spawns the built service against a
// mock filer and drives the raw tus protocol: create -> PATCH chunk 1 ->
// HEAD (resume) -> PATCH chunk 2 -> on-finish PUT to filer. Asserts the filer
// received the whole file at the metadata-derived path. Runs in dev mode
// (JWT_SECRET unset => auth off) so no token plumbing is needed.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';

const ROOT = path.resolve(import.meta.dirname, '..');
const PORT = 3399;
const BASE = `http://127.0.0.1:${PORT}`;

let child;
let filer;
let filerPort;
const stored = new Map(); // path -> Buffer

before(async () => {
  // Mock SeaweedFS filer: accept PUT, remember the body.
  filer = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      if (req.method === 'PUT') stored.set(req.url, Buffer.concat(chunks));
      res.writeHead(req.method === 'PUT' ? 201 : 200).end();
    });
  });
  await new Promise((r) => filer.listen(0, '127.0.0.1', r));
  filerPort = filer.address().port;

  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tustest-'));
  child = spawn(process.execPath, ['dist/index.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      JWT_SECRET: '', // dev: auth off
      PORT: String(PORT),
      SEAWEED_FILER_INTERNAL_URL: `http://127.0.0.1:${filerPort}`,
      UPLOAD_DIR: uploadDir,
    },
    stdio: 'ignore',
  });

  // Wait for the service to answer /health.
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('m-hub-upload did not start');
});

after(() => {
  child?.kill();
  filer?.close();
});

const meta = (obj) =>
  Object.entries(obj)
    .map(([k, v]) => `${k} ${Buffer.from(String(v)).toString('base64')}`)
    .join(',');

test('resumable 2-chunk upload lands whole file in the filer', { timeout: 30000 }, async () => {
  const data = Buffer.alloc(120000);
  for (let i = 0; i < data.length; i++) data[i] = i % 251;
  const split = 60000;

  // 1) create
  const create = await fetch(`${BASE}/upload`, {
    method: 'POST',
    headers: {
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(data.length),
      'Upload-Metadata': meta({
        filename: 'test.bin',
        filetype: 'application/octet-stream',
        document_id: 'doc123',
        user_building_id: 'ub456',
      }),
    },
  });
  assert.equal(create.status, 201);
  const location = create.headers.get('location');
  assert.ok(location, 'no Location header');
  const url = location.startsWith('http') ? location : BASE + location;

  // 2) first chunk
  let patch = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Tus-Resumable': '1.0.0',
      'Content-Type': 'application/offset+octet-stream',
      'Upload-Offset': '0',
    },
    body: data.subarray(0, split),
  });
  assert.equal(patch.status, 204);
  assert.equal(patch.headers.get('upload-offset'), String(split));

  // 3) HEAD to confirm the resume offset (simulates a reconnect)
  const head = await fetch(url, { method: 'HEAD', headers: { 'Tus-Resumable': '1.0.0' } });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('upload-offset'), String(split));

  // 4) second chunk from the resume offset
  patch = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Tus-Resumable': '1.0.0',
      'Content-Type': 'application/offset+octet-stream',
      'Upload-Offset': String(split),
    },
    body: data.subarray(split),
  });
  assert.equal(patch.status, 204);
  assert.equal(patch.headers.get('upload-offset'), String(data.length));

  // 5) the service should have PUT the assembled file to the filer
  const key = '/mhub/documents/ub456/doc123/test.bin';
  const got = stored.get(key);
  assert.ok(got, `filer never received ${key} (keys: ${[...stored.keys()].join(', ')})`);
  assert.equal(got.length, data.length);
  assert.ok(got.equals(data), 'stored bytes differ from source');
});

test('auth: valid upload token creates, wrong scope 403, no token 401', { timeout: 30000 }, async () => {
  const SECRET = 'testsecret';
  const PORT2 = 3398;
  const BASE2 = `http://127.0.0.1:${PORT2}`;

  const filer2 = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => res.writeHead(req.method === 'PUT' ? 201 : 200).end());
  });
  await new Promise((r) => filer2.listen(0, '127.0.0.1', r));

  const child2 = spawn(process.execPath, ['dist/index.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      JWT_SECRET: SECRET, // auth ON
      PORT: String(PORT2),
      SEAWEED_FILER_INTERNAL_URL: `http://127.0.0.1:${filer2.address().port}`,
      UPLOAD_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'tusauth-')),
    },
    stdio: 'ignore',
  });

  try {
    for (let i = 0; i < 40; i++) {
      try {
        const r = await fetch(`${BASE2}/health`);
        if (r.ok) break;
      } catch {
        /* not up yet */
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    const createWith = (auth) =>
      fetch(`${BASE2}/upload`, {
        method: 'POST',
        headers: {
          'Tus-Resumable': '1.0.0',
          'Upload-Length': '10',
          'Upload-Metadata': meta({ filename: 'a.bin', document_id: 'd', user_building_id: 'u', filetype: 'application/octet-stream' }),
          ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
        },
      });

    const claims = { document_id: 'd', user_building_id: 'u', filename: 'a.bin', filetype: 'application/octet-stream' };
    const uploadToken = jwt.sign({ sub: 'u1', scope: 'upload', ...claims }, SECRET, { algorithm: 'HS256', expiresIn: '1h' });
    const sessionToken = jwt.sign({ sub: 'u1', ...claims }, SECRET, { algorithm: 'HS256', expiresIn: '1h' }); // no scope

    let res = await createWith(uploadToken);
    assert.equal(res.status, 201, 'a valid upload-scoped token must create the upload');

    res = await createWith(sessionToken);
    assert.equal(res.status, 403, 'a token without scope=upload must be forbidden');

    res = await createWith(null);
    assert.equal(res.status, 401, 'a missing token must be unauthorized');
  } finally {
    child2.kill();
    filer2.close();
  }
});
