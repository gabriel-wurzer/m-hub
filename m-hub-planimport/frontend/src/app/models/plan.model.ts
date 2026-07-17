// Domain models — mirror backend/src/types.ts.
// The m-hub vocabularies + payload live in mhub.model.ts; here we describe the
// plan's geometry and the buildups the user assigns.

import { MhubLayer, ObjectType, SlabPartType, WallPartType } from './mhub.model';

export interface WallSegment {
  id: string;
  polygon: Array<{ x: number; y: number }>;
  measuredThickness: number;
  wallObjectId: string;
  excluded?: boolean;
}

/**
 * A buildup (Schichtaufbau) shared by all wall runs with the same wallObjectId.
 * Maps to one m-hub Bauteil; length = Σ member run lengths. `id === wallObjectId`.
 */
export interface WallGroup {
  id: string;
  partType: WallPartType;
  name: string;
  description?: string;
  is_public: boolean;
  is_hazardous: boolean;
  layers: MhubLayer[];
}

export interface FloorPolygon {
  id: string;
  points: Array<[number, number]>;
  label?: string;
  // Slab buildup (Bodenaufbau/Dachaufbau) assigned to this floor area.
  partType?: SlabPartType;
  name?: string;
  description?: string;
  is_public?: boolean;
  is_hazardous?: boolean;
  layers?: MhubLayer[];
  /** Net area (m²) from flood-fill; when set, overrides geometry-based area. */
  netAreaM2?: number;
  /** Flood-fill seed + carve barriers, kept so the fill can be recomputed. */
  floodClick?: { x: number; y: number };
  floodBlockers?: Array<[number, number, number, number]>;
}

/** Detection region-of-interest, in plan units (page coordinate space). */
export interface DetectRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * An object placemark (Objekt). Position is tool-side only — m-hub stores no
 * coordinates; only type/count/name/dimensions export. x/y in plan units.
 */
export interface Placemark {
  id: string;
  x: number;
  y: number;
  fixtureKey: string;       // catalog entry → icon + default type/name
  objectType: ObjectType;
  name: string;
  count: number;
  length?: number | null;   // cm
  width?: number | null;    // cm
  height?: number | null;   // cm
  is_public: boolean;
  is_hazardous: boolean;
}

export type CalibrationMode = 'scale-ratio' | 'two-point';

export interface Calibration {
  mode: CalibrationMode;
  scaleDenominator?: number;
  a?: { x: number; y: number };
  b?: { x: number; y: number };
  realMm?: number;
  mmPerUnit: number;
}

export interface PlanDoc {
  id: string;
  originalFilename: string;
  createdAt: string;
  updatedAt: string;
  sourceType: 'vector' | 'raster';
  pageIndex: number;
  pageWidth: number;
  pageHeight: number;
  rasterUrl?: string;
  rasterScale?: number;
  wallSegments: WallSegment[];
  wallGroups: WallGroup[];
  placemarks: Placemark[];
  polygons: FloorPolygon[];
  calibration?: Calibration;
  wallColors?: Array<[number, number, number]>;
  /** Extrakt: storey label this plan-run represents (chosen at hand-off). */
  location?: string;
}
