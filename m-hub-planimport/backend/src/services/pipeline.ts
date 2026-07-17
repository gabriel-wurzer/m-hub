// Orchestrates the initial import of a PDF. No wall detection happens here —
// the user triggers that via the setup dialog after picking colors + scale.

import fs from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { rasterizePdfPage } from './rasterize.js';
import { RASTER_DIR, UPLOADS_DIR, savePlan } from '../store.js';
import { PlanDoc } from '../types.js';

export async function importPdf(
  pdfBuffer: Buffer,
  originalFilename: string,
): Promise<PlanDoc> {
  const id = nanoid(12);
  const now = new Date().toISOString();

  await fs.writeFile(path.join(UPLOADS_DIR, `${id}.pdf`), pdfBuffer);

  const raster = await rasterizePdfPage(pdfBuffer, 0);
  await fs.writeFile(path.join(RASTER_DIR, `${id}.png`), raster.png);

  // Page dimensions from the raster viewport.
  const pageWidth = raster.width / raster.scale;
  const pageHeight = raster.height / raster.scale;

  const plan: PlanDoc = {
    id,
    originalFilename,
    createdAt: now,
    updatedAt: now,
    sourceType: 'vector',
    pageIndex: 0,
    pageWidth,
    pageHeight,
    rasterUrl: `/api/plan/${id}/raster`,
    rasterScale: raster.scale,
    wallSegments: [],
    wallGroups: [],
    placemarks: [],
    polygons: [],
  };
  await savePlan(plan);
  return plan;
}
