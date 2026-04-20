// Simple JSON-on-disk store for PlanDoc records.
// One file per plan under data/plans/<id>.json; uploaded PDFs live in data/uploads.

import fs from 'node:fs/promises';
import path from 'node:path';
import { PlanDoc } from './types.js';

const ROOT = path.resolve(process.cwd(), 'data');
export const UPLOADS_DIR = path.join(ROOT, 'uploads');
export const PLANS_DIR = path.join(ROOT, 'plans');
export const RASTER_DIR = path.join(ROOT, 'raster');

export async function ensureDirs() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.mkdir(PLANS_DIR, { recursive: true });
  await fs.mkdir(RASTER_DIR, { recursive: true });
}

export async function savePlan(plan: PlanDoc): Promise<void> {
  plan.updatedAt = new Date().toISOString();
  const file = path.join(PLANS_DIR, `${plan.id}.json`);
  await fs.writeFile(file, JSON.stringify(plan, null, 2), 'utf8');
}

export async function loadPlan(id: string): Promise<PlanDoc | null> {
  const file = path.join(PLANS_DIR, `${id}.json`);
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw) as PlanDoc;
  } catch (err: any) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function deletePlan(id: string): Promise<void> {
  const tryRm = async (p: string) => { try { await fs.unlink(p); } catch {} };
  await tryRm(path.join(PLANS_DIR, `${id}.json`));
  await tryRm(path.join(UPLOADS_DIR, `${id}.pdf`));
  await tryRm(path.join(RASTER_DIR, `${id}.png`));
}

export async function listPlans(): Promise<Array<Pick<PlanDoc, 'id' | 'originalFilename' | 'createdAt' | 'updatedAt'>>> {
  try {
    const files = await fs.readdir(PLANS_DIR);
    const results = [];
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(PLANS_DIR, f), 'utf8');
        const p = JSON.parse(raw) as PlanDoc;
        results.push({
          id: p.id,
          originalFilename: p.originalFilename,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        });
      } catch {
        // skip corrupt entries
      }
    }
    return results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch (err: any) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}
