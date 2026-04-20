// Shared domain types for the plan import pipeline.
// These are also consumed (hand-mirrored) by the Angular frontend.

export interface MaterialLayer {
  oekobaudatUuid?: string;
  name: string;
  thicknessMm: number;
  order: number;
}

/**
 * A wall segment produced by the watershed-based detection pipeline.
 * Each segment is a closed polygon with a measured thickness.
 * Segments sharing the same wallObjectId are considered parts of
 * the same logical wall (user-merged).
 */
export interface WallSegment {
  id: string;
  /** Closed polygon in PDF units. */
  polygon: Array<{ x: number; y: number }>;
  /** Measured wall thickness in PDF units. */
  measuredThickness: number;
  /** Logical wall grouping id. Initially same as id; changes on merge. */
  wallObjectId: string;
  /** User can exclude segments (doors, windows). */
  excluded?: boolean;
  /** Material layers assigned to this wall object (shared by wallObjectId group). */
  materials?: MaterialLayer[];
}

export interface FloorPolygon {
  id: string;
  points: Array<[number, number]>;
  label?: string;
}

export interface CalibrationPoint {
  x: number;
  y: number;
}

export type CalibrationMode = 'scale-ratio' | 'two-point';

export interface Calibration {
  mode: CalibrationMode;
  scaleDenominator?: number;
  a?: CalibrationPoint;
  b?: CalibrationPoint;
  realMm?: number;
  mmPerUnit: number;
}

export type PlanSourceType = 'vector' | 'raster';

export interface PlanDoc {
  id: string;
  originalFilename: string;
  createdAt: string;
  updatedAt: string;
  sourceType: PlanSourceType;
  pageIndex: number;
  pageWidth: number;
  pageHeight: number;
  rasterUrl?: string;
  rasterScale?: number;
  /** Wall segments from watershed pipeline. */
  wallSegments: WallSegment[];
  polygons: FloorPolygon[];
  calibration?: Calibration;
  wallColors?: Array<[number, number, number]>;
}
