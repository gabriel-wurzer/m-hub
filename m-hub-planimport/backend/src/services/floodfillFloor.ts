// Net floor area via flood-fill, bounded by the convex hull of the walls
// (or an optional user outline). Walls are barriers, so the filled region is
// the reachable floor with wall footprints already excluded. The hull caps
// leaks through door/window gaps.

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { cv } = require('opencv-wasm');

export interface FloodfillOpts {
  /** Non-excluded wall footprints, polygons in plan units. */
  wallPolygons: Array<Array<{ x: number; y: number }>>;
  pageWidth: number;
  pageHeight: number;
  mmPerUnit: number;
  clickX: number;
  clickY: number;
  /** Optional bounding outline (plan units); falls back to convex hull. */
  bound?: Array<[number, number]>;
  /** Extra barrier rectangles [x,y,w,h] (plan units) to carve out leaks. */
  blockers?: Array<[number, number, number, number]>;
}

export type FloodfillResult =
  | { areaM2: number; points: Array<[number, number]> }
  | { error: string };

export function floodfillFloor(opts: FloodfillOpts): FloodfillResult {
  const targetMax = 2000;
  const scale = targetMax / Math.max(opts.pageWidth, opts.pageHeight, 1);
  const W = Math.max(1, Math.round(opts.pageWidth * scale));
  const H = Math.max(1, Math.round(opts.pageHeight * scale));
  const toPx = (x: number, y: number): [number, number] => [Math.round(x * scale), Math.round(y * scale)];

  // ---- wall barrier mask -------------------------------------------------
  const wall = cv.Mat.zeros(H, W, cv.CV_8UC1);
  const wallVec = new cv.MatVector();
  const hullPts: number[] = [];
  for (const poly of opts.wallPolygons) {
    if (poly.length < 3) continue;
    const flat: number[] = [];
    for (const p of poly) {
      const [px, py] = toPx(p.x, p.y);
      flat.push(px, py);
      hullPts.push(px, py);
    }
    const m = cv.matFromArray(poly.length, 1, cv.CV_32SC2, flat);
    wallVec.push_back(m);
    m.delete();
  }
  if (wallVec.size() > 0) cv.fillPoly(wall, wallVec, new cv.Scalar(255));
  wallVec.delete();

  // Close micro-gaps between abutting segments (not doors/windows).
  const k = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
  cv.dilate(wall, wall, k);
  k.delete();

  // User carve rectangles — extra barriers (not part of the hull).
  if (opts.blockers && opts.blockers.length > 0) {
    const bv = new cv.MatVector();
    for (const [bx, by, bw, bh] of opts.blockers) {
      const [x1, y1] = toPx(bx, by);
      const [x2, y2] = toPx(bx + bw, by + bh);
      const m = cv.matFromArray(4, 1, cv.CV_32SC2, [x1, y1, x2, y1, x2, y2, x1, y2]);
      bv.push_back(m);
      m.delete();
    }
    cv.fillPoly(wall, bv, new cv.Scalar(255));
    bv.delete();
  }

  // ---- bounding region: user outline, else convex hull of walls ----------
  const bound = cv.Mat.zeros(H, W, cv.CV_8UC1);
  const boundVec = new cv.MatVector();
  if (opts.bound && opts.bound.length >= 3) {
    const flat: number[] = [];
    for (const [x, y] of opts.bound) {
      const [px, py] = toPx(x, y);
      flat.push(px, py);
    }
    const m = cv.matFromArray(opts.bound.length, 1, cv.CV_32SC2, flat);
    boundVec.push_back(m);
    cv.fillPoly(bound, boundVec, new cv.Scalar(255));
    m.delete();
  } else if (hullPts.length >= 6) {
    const ptsMat = cv.matFromArray(hullPts.length / 2, 1, cv.CV_32SC2, hullPts);
    const hull = new cv.Mat();
    cv.convexHull(ptsMat, hull);
    ptsMat.delete();
    boundVec.push_back(hull);
    cv.fillPoly(bound, boundVec, new cv.Scalar(255));
    hull.delete();
  } else {
    wall.delete(); bound.delete(); boundVec.delete();
    return { error: 'Keine Wände erkannt — Flood-Fill braucht Wände als Grenze.' };
  }
  boundVec.delete();

  // ---- fillable = bound AND NOT wall -------------------------------------
  const notWall = new cv.Mat();
  cv.bitwise_not(wall, notWall);
  const fillable = new cv.Mat();
  cv.bitwise_and(bound, notWall, fillable);
  wall.delete(); notWall.delete(); bound.delete();

  // ---- connected component containing the click --------------------------
  const labels = new cv.Mat();
  cv.connectedComponents(fillable, labels);
  fillable.delete();

  const [cx, cy] = toPx(opts.clickX, opts.clickY);
  const cxx = Math.min(Math.max(cx, 0), W - 1);
  const cyy = Math.min(Math.max(cy, 0), H - 1);
  const ld = labels.data32S as Int32Array;
  const clickLabel = ld[cyy * W + cxx];
  if (clickLabel <= 0) {
    labels.delete();
    return { error: 'Klick nicht im freien Boden — klicke mitten in einen Raum.' };
  }

  const region = cv.Mat.zeros(H, W, cv.CV_8UC1);
  const rd = region.data as Uint8Array;
  let pixelCount = 0;
  for (let i = 0; i < ld.length; i++) {
    if (ld[i] === clickLabel) { rd[i] = 255; pixelCount++; }
  }
  labels.delete();

  const mmPerPx = opts.mmPerUnit / scale;
  const areaM2 = (pixelCount * mmPerPx * mmPerPx) / 1e6;

  // ---- outer contour for display -----------------------------------------
  const cnts = new cv.MatVector();
  const hier = new cv.Mat();
  cv.findContours(region, cnts, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  region.delete(); hier.delete();

  let bestIdx = -1, bestArea = 0;
  for (let i = 0; i < cnts.size(); i++) {
    const a = cv.contourArea(cnts.get(i));
    if (a > bestArea) { bestArea = a; bestIdx = i; }
  }
  const points: Array<[number, number]> = [];
  if (bestIdx >= 0) {
    const approx = new cv.Mat();
    cv.approxPolyDP(cnts.get(bestIdx), approx, 2, true);
    const d = approx.data32S as Int32Array;
    for (let i = 0; i < d.length; i += 2) points.push([d[i] / scale, d[i + 1] / scale]);
    approx.delete();
  }
  cnts.delete();

  return { areaM2, points };
}
