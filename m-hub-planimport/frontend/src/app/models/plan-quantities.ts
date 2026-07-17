// Shared quantity computation for a PlanDoc: wall running metres, floor m²,
// object counts. Used by the report (and the m-hub export). Pure, no Angular.

import { FloorPolygon, PlanDoc, Placemark, WallSegment } from './plan.model';
import { MhubLayer, SlabPartType, WallPartType, buildupThicknessMm } from './mhub.model';

// ── geometry helpers ────────────────────────────────────────────────────────

function polygonArea(points: Array<{ x: number; y: number }>): number {
  let a = 0;
  for (let i = 0, n = points.length; i < n; i++) {
    const p = points[i], q = points[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

function runLengthUnits(seg: WallSegment): number {
  if (seg.measuredThickness <= 0) return 0;
  return polygonArea(seg.polygon) / seg.measuredThickness;
}

function polyAreaTuples(pts: Array<[number, number]>): number {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const [px, py] = pts[i], [qx, qy] = pts[(i + 1) % n];
    a += px * qy - qx * py;
  }
  return Math.abs(a) / 2;
}

function centroidXY(pts: Array<{ x: number; y: number }>): { x: number; y: number } {
  let sx = 0, sy = 0;
  for (const p of pts) { sx += p.x; sy += p.y; }
  const n = pts.length || 1;
  return { x: sx / n, y: sy / n };
}

function pointInPoly(pt: { x: number; y: number }, poly: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > pt.y) !== (yj > pt.y)) && (pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// ── row types ───────────────────────────────────────────────────────────────

export interface WallRow {
  name: string;
  partType: WallPartType;
  lengthM: number;
  thicknessMm: number;
  layers: MhubLayer[];
}
export interface FloorRow {
  name: string;
  partType: SlabPartType;
  areaM2: number;
  layers: MhubLayer[];
}
export interface ObjectRow {
  objectType: string;
  name: string;
  count: number;
  length?: number | null;
  width?: number | null;
  height?: number | null;
}

export interface PlanQuantities {
  walls: WallRow[];
  floors: FloorRow[];
  objects: ObjectRow[];
  wallTotalM: number;
  floorTotalM2: number;
  objectTotal: number;
  calibrated: boolean;
}

// ── computation ─────────────────────────────────────────────────────────────

function floorAreaM2(poly: FloorPolygon, plan: PlanDoc, mmPerUnit: number): number {
  if (poly.netAreaM2 != null) return poly.netAreaM2;
  const grossUnits2 = polyAreaTuples(poly.points);
  let wallUnits2 = 0;
  for (const seg of plan.wallSegments) {
    if (seg.excluded) continue;
    if (pointInPoly(centroidXY(seg.polygon), poly.points)) wallUnits2 += polygonArea(seg.polygon);
  }
  const mPerUnit = mmPerUnit / 1000;
  return Math.max(0, grossUnits2 - wallUnits2) * mPerUnit * mPerUnit;
}

export function computeQuantities(plan: PlanDoc): PlanQuantities {
  const mmPerUnit = plan.calibration?.mmPerUnit ?? null;

  const walls: WallRow[] = [];
  for (const g of plan.wallGroups) {
    if (g.layers.length === 0) continue;
    const members = plan.wallSegments.filter((s) => s.wallObjectId === g.id && !s.excluded);
    if (members.length === 0) continue;
    const lengthM = mmPerUnit
      ? (members.reduce((a, s) => a + runLengthUnits(s), 0) * mmPerUnit) / 1000
      : 0;
    walls.push({
      name: g.name || `Wand ${g.id.slice(0, 6)}`,
      partType: g.partType,
      lengthM,
      thicknessMm: buildupThicknessMm(g.layers),
      layers: g.layers,
    });
  }

  const floors: FloorRow[] = [];
  for (const poly of plan.polygons) {
    const layers = poly.layers ?? [];
    if (layers.length === 0) continue;
    floors.push({
      name: poly.name || 'Bodenaufbau',
      partType: poly.partType ?? SlabPartType.Bodenaufbau,
      areaM2: mmPerUnit || poly.netAreaM2 != null ? floorAreaM2(poly, plan, mmPerUnit ?? 1) : 0,
      layers,
    });
  }

  const objMap = new Map<string, ObjectRow>();
  for (const m of plan.placemarks) {
    const key = [m.objectType, m.name, m.length ?? '', m.width ?? '', m.height ?? ''].join('|');
    const ex = objMap.get(key);
    if (ex) { ex.count += m.count; continue; }
    objMap.set(key, {
      objectType: m.objectType, name: m.name || m.objectType, count: m.count,
      length: m.length ?? null, width: m.width ?? null, height: m.height ?? null,
    });
  }
  const objects = [...objMap.values()];

  return {
    walls, floors, objects,
    wallTotalM: walls.reduce((a, w) => a + w.lengthM, 0),
    floorTotalM2: floors.reduce((a, f) => a + f.areaM2, 0),
    objectTotal: objects.reduce((a, o) => a + o.count, 0),
    calibrated: mmPerUnit != null,
  };
}

/** Sum length (m) per wall part type. */
export function wallTotalsByType(walls: WallRow[]): Array<{ partType: string; lengthM: number }> {
  const m = new Map<string, number>();
  for (const w of walls) m.set(w.partType, (m.get(w.partType) ?? 0) + w.lengthM);
  return [...m.entries()].map(([partType, lengthM]) => ({ partType, lengthM }));
}

/** Sum area (m²) per floor part type. */
export function floorTotalsByType(floors: FloorRow[]): Array<{ partType: string; areaM2: number }> {
  const m = new Map<string, number>();
  for (const f of floors) m.set(f.partType, (m.get(f.partType) ?? 0) + f.areaM2);
  return [...m.entries()].map(([partType, areaM2]) => ({ partType, areaM2 }));
}
