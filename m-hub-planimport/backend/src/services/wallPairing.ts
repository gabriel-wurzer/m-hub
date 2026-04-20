// Pair raw line segments into walls.
//
// A wall in an architectural plan is drawn as two nearly-parallel line
// segments whose perpendicular distance is the wall thickness (e.g. a
// single-brick wall at ~12 cm, a party wall at ~25 cm, an exterior wall at
// ~40–60 cm). This module scans the raw segment list and groups qualifying
// pairs into Wall objects with a centerline and thickness.
//
// The pairing is a best-effort heuristic — the user can always mark walls
// manually from unpaired segments or override the result in the UI.

import { nanoid } from 'nanoid';

export interface RawSeg {
  id: string;
  x1: number; y1: number; x2: number; y2: number;
  /** Stroke color [r,g,b] 0–1. Used to filter: only dark strokes are wall candidates. */
  strokeColor?: [number, number, number];
  /** Line width in device units. Walls tend to have a consistent width. */
  lineWidth?: number;
}

export interface Wall {
  id: string;
  /** Centerline endpoints (midpoint of the two source segments' projections). */
  cx1: number; cy1: number; cx2: number; cy2: number;
  /** Perpendicular distance between the two source segments, in PDF units. */
  thickness: number;
  /** Source segment ids the wall was built from (hidden from raw view). */
  sourceIds: [string, string];
}

export interface PairingOptions {
  /** Max angle between segment directions to be considered parallel, rad. */
  angleTolRad: number;
  /** Min wall thickness in real mm. */
  minThicknessMm: number;
  /** Max wall thickness in real mm. */
  maxThicknessMm: number;
  /** Min wall length in real mm. */
  minLengthMm: number;
  /** Min fraction of shared overlap along the common direction (0..1). */
  minOverlap: number;
  /** mm per PDF unit (derived from scale). */
  mmPerUnit: number;
}

export const DEFAULT_PAIRING: PairingOptions = {
  angleTolRad: (2 * Math.PI) / 180,
  minThicknessMm: 60,    // thinnest plausible wall (non-structural partition)
  maxThicknessMm: 600,   // thickest plausible wall (massive exterior)
  minLengthMm: 300,      // walls shorter than 30cm are unlikely
  minOverlap: 0.4,
  mmPerUnit: (25.4 / 72) * 100,  // default: 1:100 scale
};

export function pairWalls(
  segs: RawSeg[],
  opts: PairingOptions = DEFAULT_PAIRING,
): { walls: Wall[]; consumedIds: Set<string> } {
  const walls: Wall[] = [];
  const consumed = new Set<string>();

  // Pre-filter: walls are dark strokes with a heavier line weight than
  // dimension lines (Koten). In typical CAD exports:
  //   - Walls: lineWidth ≈ 0.35–0.50 (the thickest strokes on the page)
  //   - Koten/dimensions: lineWidth ≈ 0.15–0.25 (thinner)
  //   - Fine detail: lineWidth < 0.15
  //
  // Strategy: find the dominant (most common) lineWidth among dark strokes,
  // then only accept segments within ±30% of that dominant width. This
  // adapts to different CAD export conventions automatically.
  const isDark = (c?: [number, number, number]) => {
    if (!c) return true;
    return c[0] < 0.45 && c[1] < 0.45 && c[2] < 0.45;
  };
  // Only consider stroke-origin segments (paint === 'stroke' or 'fillStroke'),
  // not pure fills which have lineWidth = 0.
  const darkStrokeSegs = segs.filter((s) => isDark(s.strokeColor) && (s.lineWidth ?? 0) > 0);

  // Find the dominant line width among dark strokes.
  const lwBuckets = new Map<string, { count: number; lw: number }>();
  for (const s of darkStrokeSegs) {
    const lw = s.lineWidth ?? 0;
    const key = lw.toFixed(2);
    const bucket = lwBuckets.get(key);
    if (bucket) bucket.count++;
    else lwBuckets.set(key, { count: 1, lw });
  }
  const sortedBuckets = [...lwBuckets.values()].sort((a, b) => b.count - a.count);
  const dominantLw = sortedBuckets.length > 0 ? sortedBuckets[0].lw : 0;
  const lwTolerance = 0.3;
  const lwMin = dominantLw * (1 - lwTolerance);
  const lwMax = dominantLw * (1 + lwTolerance);

  const eligible = darkStrokeSegs.filter((s) => {
    const lw = s.lineWidth ?? 0;
    return lw >= lwMin && lw <= lwMax;
  });
  console.log(
    `[wallPairing] dominant lineWidth = ${dominantLw.toFixed(2)}`,
    `| eligible (dark + dominant lw) = ${eligible.length} / ${segs.length}`,
    `| lw buckets =`, sortedBuckets.slice(0, 5).map((b) => `${b.lw.toFixed(2)}:${b.count}`),
  );

  // Pre-compute geometry
  interface Info {
    id: string;
    x1: number; y1: number; x2: number; y2: number;
    len: number;
    ang: number; // in [0, π) so opposite directions are considered equal
    // unit direction (from endpoint 1 to endpoint 2)
    ux: number; uy: number;
    // midpoint
    mx: number; my: number;
  }
  const infos: Info[] = eligible.map((s) => {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    const len = Math.hypot(dx, dy);
    let ang = Math.atan2(dy, dx);
    if (ang < 0) ang += Math.PI;
    if (ang >= Math.PI) ang -= Math.PI;
    return {
      id: s.id,
      x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2,
      len,
      ang,
      ux: len > 0 ? dx / len : 1,
      uy: len > 0 ? dy / len : 0,
      mx: (s.x1 + s.x2) / 2,
      my: (s.y1 + s.y2) / 2,
    };
  }).filter((i) => i.len * opts.mmPerUnit >= opts.minLengthMm);

  // Sort by angle so we can do a sweep: only compare segments within the
  // angle tolerance. This cuts the O(n^2) down to ~O(n * k).
  infos.sort((a, b) => a.ang - b.ang);

  const angleDiff = (a: number, b: number) => {
    let d = Math.abs(a - b);
    if (d > Math.PI / 2) d = Math.PI - d;
    return d;
  };

  // Perpendicular distance from point p to the infinite line through seg A.
  const perpDist = (A: Info, px: number, py: number) => {
    // line normal = (-uy, ux); signed distance = (p - A.start) · n
    return (px - A.x1) * -A.uy + (py - A.y1) * A.ux;
  };

  // Project point onto A's direction axis, returning a scalar t along A.
  const project = (A: Info, px: number, py: number) =>
    (px - A.x1) * A.ux + (py - A.y1) * A.uy;

  for (let i = 0; i < infos.length; i++) {
    if (consumed.has(infos[i].id)) continue;
    const A = infos[i];
    let best: { j: number; thickness: number; score: number; overlap: [number, number]; sign: number } | null = null;

    for (let j = i + 1; j < infos.length; j++) {
      if (consumed.has(infos[j].id)) continue;
      const B = infos[j];
      // Early out: angles are sorted — once we exceed tolerance we can stop.
      if (angleDiff(A.ang, B.ang) > opts.angleTolRad) {
        // Because we wrap angles into [0,π) the sort doesn't perfectly
        // cluster near 0 and π, so we can't `break` — just `continue`.
        continue;
      }

      // Both endpoints of B must be at approximately the same perpendicular
      // distance from A's line.
      const d1 = perpDist(A, B.x1, B.y1);
      const d2 = perpDist(A, B.x2, B.y2);
      // If B is not nearly parallel to A (residual from angle check), the
      // two distances will differ — enforce small residual.
      if (Math.abs(d1 - d2) > 1.5) continue;
      const thickness = Math.abs((d1 + d2) / 2);
      const thicknessMm = thickness * opts.mmPerUnit;
      if (thicknessMm < opts.minThicknessMm || thicknessMm > opts.maxThicknessMm) continue;

      // Check overlap along A's direction.
      const tA1 = project(A, A.x1, A.y1); // = 0
      const tA2 = project(A, A.x2, A.y2); // = A.len
      const tB1 = project(A, B.x1, B.y1);
      const tB2 = project(A, B.x2, B.y2);
      const aMin = Math.min(tA1, tA2), aMax = Math.max(tA1, tA2);
      const bMin = Math.min(tB1, tB2), bMax = Math.max(tB1, tB2);
      const overlap = Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin));
      const minLen = Math.min(A.len, B.len);
      if (overlap / Math.max(1e-6, minLen) < opts.minOverlap) continue;

      // Prefer the closest parallel candidate, with a slight preference for
      // greater overlap.
      const score = thickness - overlap * 0.01;
      if (!best || score < best.score) {
        const sign = (d1 + d2) >= 0 ? 1 : -1;
        best = {
          j, thickness, score,
          overlap: [Math.max(aMin, bMin), Math.min(aMax, bMax)],
          sign,
        };
      }
    }

    if (!best) continue;
    const B = infos[best.j];
    consumed.add(A.id);
    consumed.add(B.id);

    // Centerline: take the overlapping span in A's parameter space,
    // then offset by half the thickness perpendicular to A toward B.
    const [t0, t1] = best.overlap;
    const ax0 = A.x1 + A.ux * t0, ay0 = A.y1 + A.uy * t0;
    const ax1 = A.x1 + A.ux * t1, ay1 = A.y1 + A.uy * t1;
    const nx = -A.uy * best.sign, ny = A.ux * best.sign;
    const half = best.thickness / 2;
    walls.push({
      id: nanoid(10),
      cx1: ax0 + nx * half,
      cy1: ay0 + ny * half,
      cx2: ax1 + nx * half,
      cy2: ay1 + ny * half,
      thickness: best.thickness,
      sourceIds: [A.id, B.id],
    });
  }

  return { walls, consumedIds: consumed };
}
