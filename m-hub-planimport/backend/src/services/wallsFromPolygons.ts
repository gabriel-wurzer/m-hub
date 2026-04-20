// Convert filled polygons into Wall objects, using **fill color** as the
// primary signal.
//
// In architectural floor plans (CAD exports), walls are filled polygons with
// a distinct color — typically:
//   - Black / dark grey (existing walls, "Bestand")
//   - Red (new construction, "Neubau")
//   - Dark hatching (party walls, cross-sections)
//
// Everything else — dimension lines ("Koten"), text, door swings, room labels,
// appliance symbols — either uses a different color or is stroke-only (no fill).
//
// Strategy:
//   1. Only consider polygons whose fill color is "dark" (all channels < 0.35)
//      or "red" (r > 0.6, g < 0.25, b < 0.25). These thresholds are
//      deliberately generous — false positives are filtered by geometry next.
//   2. Compute the oriented minimum bounding rectangle (OBR).
//   3. Filter by elongation (L/T > 2) and minimum size.
//   4. The short dimension of the OBR = wall thickness.

import { nanoid } from 'nanoid';
import type { RawPolygon } from './pdfExtract.js';

export interface PolygonWall {
  id: string;
  cx1: number; cy1: number; cx2: number; cy2: number;
  thickness: number;
  sourcePolygonIndex: number;
}

export interface PolygonWallOptions {
  minThickness: number;
  maxThickness: number;
  minLength: number;
  minAspect: number;
  /** Max brightness (0–1) of fill color to count as "dark". */
  darkThreshold: number;
  /**
   * Max deviation from horizontal/vertical in degrees.
   * Walls in floor plans are almost always axis-aligned.
   * Door/window swings are diagonal → filtered out.
   * Set to 90 to disable. Default: 8.
   */
  maxAngleDeviation?: number;
}

export const DEFAULT_POLYGON_WALLS: PolygonWallOptions = {
  minThickness: 1,
  maxThickness: 80,
  minLength: 10,
  minAspect: 2.0,
  darkThreshold: 0.35,
};

/**
 * Returns true if the fill color looks like a wall color:
 *   - Dark: all channels < darkThreshold
 *   - Red: r > 0.6, g < 0.25, b < 0.25
 */
function isWallColor(c: [number, number, number] | undefined, threshold: number): boolean {
  if (!c) return false;
  const [r, g, b] = c;
  // Dark (black / dark grey)
  if (r < threshold && g < threshold && b < threshold) return true;
  // Red (Neubau convention)
  if (r > 0.6 && g < 0.25 && b < 0.25) return true;
  return false;
}

export function wallsFromPolygons(
  polys: RawPolygon[],
  opts: PolygonWallOptions = DEFAULT_POLYGON_WALLS,
): PolygonWall[] {
  const walls: PolygonWall[] = [];
  let colorReject = 0;
  let geoReject = 0;

  polys.forEach((poly, idx) => {
    // --- Color filter first (fast, eliminates most non-wall polygons) ---
    if (!isWallColor(poly.fillColor, opts.darkThreshold)) {
      colorReject++;
      return;
    }

    if (poly.points.length < 3) return;

    // Deduplicate adjacent equal points.
    const pts: Array<[number, number]> = [];
    for (const p of poly.points) {
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(last[0] - p[0], last[1] - p[1]) > 1e-6) pts.push(p);
    }
    if (pts.length < 3) return;

    const obr = minAreaRect(pts);
    if (!obr) return;
    const { width, height, cx1, cy1, cx2, cy2 } = obr;
    const L = Math.max(width, height);
    const T = Math.min(width, height);
    if (L < opts.minLength || T < opts.minThickness || T > opts.maxThickness) {
      geoReject++;
      return;
    }
    if (L / Math.max(T, 1e-6) < opts.minAspect) {
      geoReject++;
      return;
    }

    // Angle filter: reject polygons whose centerline isn't near horizontal
    // or vertical. This eliminates door/window swings which are diagonal.
    const maxDev = (opts.maxAngleDeviation ?? 8) * Math.PI / 180;
    const angle = Math.atan2(Math.abs(cy2 - cy1), Math.abs(cx2 - cx1));
    // angle ∈ [0, π/2]. Near-horizontal → angle ≈ 0, near-vertical → angle ≈ π/2.
    const devFromH = angle;            // deviation from horizontal
    const devFromV = Math.PI / 2 - angle; // deviation from vertical
    if (Math.min(devFromH, devFromV) > maxDev) {
      geoReject++;
      return;
    }

    walls.push({
      id: nanoid(10),
      cx1, cy1, cx2, cy2,
      thickness: T,
      sourcePolygonIndex: idx,
    });
  });

  console.log(
    '[wallsFromPolygons] accepted =', walls.length,
    '| color-rejected =', colorReject,
    '| geo-rejected =', geoReject,
    '| total input =', polys.length,
  );

  return walls;
}

// --- Minimum-area oriented bounding rectangle (rotating calipers) ----------

interface OBR {
  cx1: number; cy1: number; cx2: number; cy2: number;
  width: number; height: number;
}

function minAreaRect(pts: Array<[number, number]>): OBR | null {
  const hull = convexHull(pts);
  if (hull.length < 2) return null;

  let bestArea = Infinity;
  let best: OBR | null = null;

  for (let i = 0; i < hull.length; i++) {
    const [x0, y0] = hull[i];
    const [x1, y1] = hull[(i + 1) % hull.length];
    const edgeDx = x1 - x0, edgeDy = y1 - y0;
    const len = Math.hypot(edgeDx, edgeDy);
    if (len < 1e-9) continue;
    const ux = edgeDx / len, uy = edgeDy / len;
    const nx = -uy, ny = ux;

    let minU = Infinity, maxU = -Infinity;
    let minN = Infinity, maxN = -Infinity;
    for (const [px, py] of hull) {
      const dx = px - x0, dy = py - y0;
      const pu = dx * ux + dy * uy;
      const pn = dx * nx + dy * ny;
      if (pu < minU) minU = pu;
      if (pu > maxU) maxU = pu;
      if (pn < minN) minN = pn;
      if (pn > maxN) maxN = pn;
    }
    const w = maxU - minU, h = maxN - minN;
    const area = w * h;
    if (area < bestArea) {
      bestArea = area;
      const c0x = x0 + minU * ux + minN * nx;
      const c0y = y0 + minU * uy + minN * ny;
      const c1x = x0 + maxU * ux + minN * nx;
      const c1y = y0 + maxU * uy + minN * ny;
      const c2x = x0 + maxU * ux + maxN * nx;
      const c2y = y0 + maxU * uy + maxN * ny;
      const c3x = x0 + minU * ux + maxN * nx;
      const c3y = y0 + minU * uy + maxN * ny;
      let cx1, cy1, cx2, cy2;
      if (w >= h) {
        cx1 = (c0x + c3x) / 2; cy1 = (c0y + c3y) / 2;
        cx2 = (c1x + c2x) / 2; cy2 = (c1y + c2y) / 2;
      } else {
        cx1 = (c0x + c1x) / 2; cy1 = (c0y + c1y) / 2;
        cx2 = (c3x + c2x) / 2; cy2 = (c3y + c2y) / 2;
      }
      best = { cx1, cy1, cx2, cy2, width: w, height: h };
    }
  }
  return best;
}

function convexHull(pts: Array<[number, number]>): Array<[number, number]> {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length <= 2) return p;
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Array<[number, number]> = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Array<[number, number]> = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}
