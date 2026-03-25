import { LayerMaterial } from './layer-material';

export interface Layer {
  layer_index: number;
  material: LayerMaterial | null;
  thickness: number | null;
}

export interface WallStructure {
  type: 'wall';
  length: number | null;
  layers: Layer[];
}

export interface SlabStructure {
  type: 'slab';
  area: number | null;
  layers: Layer[];
}

export type PartStructure = WallStructure | SlabStructure;
