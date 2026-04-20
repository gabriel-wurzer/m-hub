// Domain models — mirror backend/src/types.ts.

export interface MaterialLayer {
  oekobaudatUuid?: string;
  name: string;
  thicknessMm: number;
  order: number;
}

export interface WallSegment {
  id: string;
  polygon: Array<{ x: number; y: number }>;
  measuredThickness: number;
  wallObjectId: string;
  excluded?: boolean;
  materials?: MaterialLayer[];
}

export interface FloorPolygon {
  id: string;
  points: Array<[number, number]>;
  label?: string;
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
  polygons: FloorPolygon[];
  calibration?: Calibration;
  wallColors?: Array<[number, number, number]>;
}

export interface OekobaudatHit {
  uuid: string;
  name: string;
  category?: string;
  sourceUrl?: string;
}
