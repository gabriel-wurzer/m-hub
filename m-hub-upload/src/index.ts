// m-hub-upload: resumable (tus) upload service. Streams big files to SeaweedFS,
// bypassing node-red and base64. JWT-authenticated. On completion it PUTs the
// assembled file to the filer and returns the stored path.

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { Server } from '@tus/server';
import { FileStore } from '@tus/file-store';
import fs from 'node:fs/promises';
import path from 'node:path';
import jwt from 'jsonwebtoken';

const PORT = Number(process.env.PORT ?? 3300);
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.resolve(process.cwd(), 'data', 'tus');
const FILER_URL = (process.env.SEAWEED_FILER_INTERNAL_URL ?? 'http://seaweed-filer:8888').replace(/\/+$/, '');
const JWT_SECRET = process.env.JWT_SECRET ?? ''; // empty → dev, auth disabled
const MAX_BYTES = Number(process.env.MAX_BYTES ?? 5 * 1024 * 1024 * 1024); // 5 GB

await fs.mkdir(UPLOAD_DIR, { recursive: true });

const sanitize = (n: string) =>
  (n || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 180);

const tus = new Server({
  path: '/upload',
  datastore: new FileStore({ directory: UPLOAD_DIR }),
  maxSize: MAX_BYTES,

  // Auth: verify the m-hub JWT on every incoming request (dev: disabled if no secret).
  async onIncomingRequest(req) {
    if (!JWT_SECRET) return;
    const auth = req.headers['authorization'];
    const token = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : '';
    try {
      jwt.verify(token, JWT_SECRET);
    } catch {
      throw Object.assign(new Error('unauthorized'), { status_code: 401, body: 'Invalid or missing token' });
    }
  },

  // On completion: store the assembled file in the filer, return the path.
  async onUploadFinish(_req, res, upload) {
    const meta: Record<string, string | null> = upload.metadata ?? {};
    const name = sanitize(meta['filename'] ?? upload.id);
    const relPath = `/mhub/documents/${meta['user_id'] ?? 'unknown'}/${meta['document_id'] ?? upload.id}/${name}`;
    const data = await fs.readFile(path.join(UPLOAD_DIR, upload.id));

    const put = await fetch(FILER_URL + relPath, {
      method: 'PUT',
      headers: { 'Content-Type': meta['filetype'] ?? 'application/octet-stream' },
      body: data,
    });
    if (!put.ok) {
      throw Object.assign(new Error('filer store failed'), { status_code: 502, body: `Filer HTTP ${put.status}` });
    }

    await fs.rm(path.join(UPLOAD_DIR, upload.id)).catch(() => {});
    await fs.rm(path.join(UPLOAD_DIR, upload.id + '.json')).catch(() => {});
    res.setHeader('X-Stored-Path', relPath);
    return res;
  },
});

const app = express();

// CORS for the browser tus client (tool frontend is a different origin).
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, PATCH, HEAD, DELETE, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers',
    'Authorization, Content-Type, Location, Upload-Offset, Upload-Length, Upload-Metadata, Upload-Defer-Length, Upload-Concat, Tus-Resumable, X-Requested-With');
  res.setHeader('Access-Control-Expose-Headers',
    'Location, Upload-Offset, Upload-Length, Tus-Resumable, Tus-Version, Tus-Extension, Tus-Max-Size, Upload-Metadata, X-Stored-Path');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true, authEnabled: !!JWT_SECRET }));

const handler = (req: Request, res: Response) => tus.handle(req, res);
app.all('/upload', handler);
app.all('/upload/*', handler);

app.listen(PORT, () => {
  console.log(`[m-hub-upload] listening on :${PORT} · filer=${FILER_URL} · auth=${JWT_SECRET ? 'on' : 'OFF (dev)'}`);
});
