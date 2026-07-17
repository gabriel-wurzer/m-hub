// Shared domain types for the plan import pipeline.
// These are also consumed (hand-mirrored) by the Angular frontend, which types
// the m-hub vocabularies precisely (see frontend models/mhub.model.ts). Here we
// stay structural (strings) since the backend only persists JSON.

/** One m-hub Schichtaufbau layer. thickness in mm, layer_index 1-based. */
export interface MhubLayer {
  layer_index: number;
  material: string;
  thickness: number;
}

/**
 * A wall segment produced by the watershed-based detection pipeline.
 * Each segment is a closed polygon with a measured thickness.
 * Segments sharing the same wallObjectId belong to the same buildup group.
 */
export interface WallSegment {
  id: string;
  /** Closed polygon in PDF units. */
  polygon: Array<{ x: number; y: number }>;
  /** Measured wall thickness in PDF units. */
  measuredThickness: number;
  /** Buildup group id. Initially same as id; changes on merge/assign. */
  wallObjectId: string;
  /** User can exclude segments (doors, windows). */
  excluded?: boolean;
}

/**
 * A buildup (Schichtaufbau) assigned to a set of wall runs sharing the same
 * wallObjectId. Maps to one m-hub Bauteil; length = Σ member run lengths.
 * `id` equals the segments' wallObjectId.
 */
export interface WallGroup {
  id: string;
  partType: string;
  name: string;
  description?: string;
  is_public: boolean;
  is_hazardous: boolean;
  layers: MhubLayer[];
}

/** Object placemark (Objekt). Position is tool-side only; not stored by m-hub. */
export interface Placemark {
  id: string;
  x: number;
  y: number;
  fixtureKey: string;
  objectType: string;
  name: string;
  count: number;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  is_public: boolean;
  is_hazardous: boolean;
}

export interface FloorPolygon {
  id: string;
  points: Array<[number, number]>;
  label?: string;
  partType?: string;
  name?: string;
  description?: string;
  is_public?: boolean;
  is_hazardous?: boolean;
  layers?: MhubLayer[];
  /** Backend-computed net area (m²) for flood-fill floors; overrides geometry. */
  netAreaM2?: number;
  floodClick?: { x: number; y: number };
  floodBlockers?: Array<[number, number, number, number]>;
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
  /** Buildups keyed by wallObjectId; only present once the user assigns one. */
  wallGroups: WallGroup[];
  /** User-placed object placemarks. */
  placemarks: Placemark[];
  polygons: FloorPolygon[];
  calibration?: Calibration;
  wallColors?: Array<[number, number, number]>;
  /** Extrakt: storey label this plan-run represents. */
  location?: string;
}
