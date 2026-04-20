// Express entry point for the plan-import backend.

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import { ensureDirs, listPlans, loadPlan, savePlan, RASTER_DIR, UPLOADS_DIR } from './store.js';
import { importPdf } from './services/pipeline.js';
import { searchOekobaudat } from './services/oekobaudat.js';
import { PlanDoc } from './types.js';

const PORT = Number(process.env.PORT ?? 3200);

async function main() {
  await ensureDirs();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '25mb' }));

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // --- Plans ---------------------------------------------------------------

  app.get('/api/plan', async (_req, res) => {
    res.json(await listPlans());
  });

  app.post('/api/plan/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'file required' });
    try {
      const plan = await importPdf(req.file.buffer, req.file.originalname);
      res.json(plan);
    } catch (err: any) {
      console.error('[upload] failed', err);
      res.status(500).json({ error: err?.message ?? 'import failed' });
    }
  });

  app.get('/api/plan/:id', async (req, res) => {
    const plan = await loadPlan(req.params.id);
    if (!plan) return res.status(404).json({ error: 'not found' });
    res.json(plan);
  });

  app.put('/api/plan/:id', async (req, res) => {
    const existing = await loadPlan(req.params.id);
    if (!existing) return res.status(404).json({ error: 'not found' });
    const incoming = req.body as Partial<PlanDoc>;
    // Only allow mutating the user-editable parts.
    const merged: PlanDoc = {
      ...existing,
      wallSegments: incoming.wallSegments ?? existing.wallSegments,
      polygons: incoming.polygons ?? existing.polygons,
      calibration: incoming.calibration ?? existing.calibration,
    };
    await savePlan(merged);
    res.json(merged);
  });

  // Re-run wall detection with user-picked wall colors.
  app.post('/api/plan/:id/detect-walls', async (req, res) => {
    const existing = await loadPlan(req.params.id);
    if (!existing) return res.status(404).json({ error: 'not found' });
    const { wallColors, scaleDenominator, tolerance } = req.body as {
      wallColors: Array<[number, number, number]>;
      scaleDenominator?: number;
      tolerance?: number;
    };
    if (!wallColors || wallColors.length === 0) {
      return res.status(400).json({ error: 'wallColors required' });
    }
    try {
      const { redetectWalls } = await import('./services/redetect.js');
      const updated = await redetectWalls(existing, wallColors, scaleDenominator, tolerance);
      await savePlan(updated);
      res.json(updated);
    } catch (err: any) {
      console.error('[detect-walls] failed', err);
      res.status(500).json({ error: err?.message ?? 'detection failed' });
    }
  });

  app.delete('/api/plan/:id', async (req, res) => {
    const id = req.params.id;
    try {
      const { deletePlan } = await import('./store.js');
      await deletePlan(id);
      res.json({ ok: true });
    } catch {
      res.status(404).json({ error: 'not found' });
    }
  });

  app.get('/api/plan/:id/raster', async (req, res) => {
    const file = path.join(RASTER_DIR, `${req.params.id}.png`);
    try {
      const buf = await fs.readFile(file);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(buf);
    } catch {
      res.status(404).end();
    }
  });

  app.get('/api/plan/:id/pdf', async (req, res) => {
    const file = path.join(UPLOADS_DIR, `${req.params.id}.pdf`);
    try {
      const buf = await fs.readFile(file);
      res.setHeader('Content-Type', 'application/pdf');
      res.send(buf);
    } catch {
      res.status(404).end();
    }
  });

  // --- ÖKOBAU.dat proxy ----------------------------------------------------

  app.get('/api/materials/search', async (req, res) => {
    const q = String(req.query.q ?? '');
    try {
      const hits = await searchOekobaudat(q);
      res.json(hits);
    } catch (err: any) {
      console.error('[materials] search failed', err);
      res.status(500).json({ error: err?.message ?? 'search failed' });
    }
  });

  app.listen(PORT, () => {
    console.log(`[planimport-backend] listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
