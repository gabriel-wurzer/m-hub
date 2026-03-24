import { Material } from '../enums/material.enum';

export interface BasePartLayer {
  layer_index: number;
  material: Material | null;
  thickness: number | null;
}

export interface WallLayer extends BasePartLayer {
  length: number | null;
}

export interface SlabLayer extends BasePartLayer {
  area: number | null;
}

export interface WallStructure {
  type: 'wall';
  layers: WallLayer[];
}

export interface SlabStructure {
  type: 'slab';
  layers: SlabLayer[];
}

export type PartStructure = WallStructure | SlabStructure;
