import fs from 'node:fs/promises';
import path from 'node:path';
import { UPLOADS_DIR } from '../store.js';
import { PlanDoc, WallSegment } from '../types.js';
import { detectWallSegments } from './rasterWalls.js';
import { rasterizePdfPage } from './rasterize.js';

export async function redetectWalls(
  plan: PlanDoc,
  wallColors: Array<[number, number, number]>,
  scaleDenominator?: number,
  toleranceRgb255?: number,
  regions?: Array<{ x: number; y: number; w: number; h: number }>,
): Promise<PlanDoc> {
  const scaleDenom = scaleDenominator ?? plan.calibration?.scaleDenominator ?? 100;
  const mmPerUnit = (25.4 / 72) * scaleDenom;
  const tolerance = toleranceRgb255 ?? 20;

  // Re-rasterize at high resolution for detection.
  const pdfPath = path.join(UPLOADS_DIR, `${plan.id}.pdf`);
  const pdfBuf = await fs.readFile(pdfPath);
  const hiRes = await rasterizePdfPage(pdfBuf, plan.pageIndex, 6000);
  const rasterScale = hiRes.scale;

  console.log(`[redetect] hi-res ${hiRes.width}x${hiRes.height} scale=${rasterScale.toFixed(3)} mmPerUnit=${mmPerUnit.toFixed(3)}`);
  console.log(`[redetect] colors=${wallColors.map((c) => `rgb(${c.join(',')})`).join(', ')} tol=${tolerance}`);

  const rawSegments = await detectWallSegments(hiRes.png, {
    wallColors,
    tolerance,
    rasterScale,
    mmPerUnit,
    minAreaMm2: 1500, // ~15 cm²: drops specks but keeps small real wall runs
    maxThicknessMm: 3000, // Altbau can have 1m+ walls; >3m is definitely wrong
    regions,
  });

  const wallSegments: WallSegment[] = rawSegments.map((s) => ({
    id: s.id,
    polygon: s.polygon,
    measuredThickness: s.measuredThickness,
    wallObjectId: s.id, // initially each segment is its own wall object
  }));

  console.log(`[redetect] result: ${wallSegments.length} wall segments`);

  return {
    ...plan,
    wallSegments,
    // Fresh segments carry new wallObjectIds; drop stale buildups.
    wallGroups: [],
    wallColors,
    rasterScale,
    calibration: {
      mode: 'scale-ratio',
      scaleDenominator: scaleDenom,
      mmPerUnit,
    },
    updatedAt: new Date().toISOString(),
  };
}
