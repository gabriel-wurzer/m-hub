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

const readBearer = (req: { headers: Record<string, unknown> }): string => {
  const auth = req.headers['authorization'];
  return typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : '';
};

// The upload token is minted by node-red's /api/documents/reserve and binds this
// upload to exactly one document (scope + document_id + user_building_id + filename).
type UploadClaims = {
  scope?: string;
  document_id?: string;
  user_building_id?: string;
  filename?: string;
  filetype?: string;
};

const tus = new Server({
  path: '/upload',
  datastore: new FileStore({ directory: UPLOAD_DIR }),
  maxSize: MAX_BYTES,

  // Auth: verify the m-hub JWT on every incoming request (dev: disabled if no secret).
  async onIncomingRequest(req) {
    if (!JWT_SECRET) return;
    let claims: UploadClaims;
    try {
      claims = jwt.verify(readBearer(req), JWT_SECRET) as UploadClaims;
    } catch {
      throw Object.assign(new Error('unauthorized'), { status_code: 401, body: 'Invalid or missing token' });
    }
    // Reject general session tokens: only reserve-issued upload tokens may store files.
    if (claims.scope !== 'upload') {
      throw Object.assign(new Error('forbidden'), { status_code: 403, body: 'Token not scoped for upload' });
    }
  },

  // On completion: store the assembled file in the filer, return the path.
  async onUploadFinish(req, res, upload) {
    const meta: Record<string, string | null> = upload.metadata ?? {};
    // Path components come from the signed token, NOT client metadata, so a token
    // for document A can never write into document B's path. Dev (no secret) falls
    // back to metadata.
    let userBuilding = meta['user_building_id'] ?? undefined;
    let documentId = meta['document_id'] ?? undefined;
    let filename = meta['filename'] ?? undefined;
    let filetype = meta['filetype'] ?? undefined;
    if (JWT_SECRET) {
      const claims = jwt.verify(readBearer(req), JWT_SECRET) as UploadClaims;
      userBuilding = claims.user_building_id ?? userBuilding;
      documentId = claims.document_id ?? documentId;
      filename = claims.filename ?? filename;
      filetype = claims.filetype ?? filetype;
    }

    const name = sanitize(filename ?? upload.id);
    const relPath = `/mhub/documents/${userBuilding ?? 'unknown'}/${documentId ?? upload.id}/${name}`;
    const data = await fs.readFile(path.join(UPLOAD_DIR, upload.id));

    const put = await fetch(FILER_URL + relPath, {
      method: 'PUT',
      headers: { 'Content-Type': filetype ?? 'application/octet-stream' },
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
