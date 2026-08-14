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
  kerndicke?: boolean;
  /** Kontakt zu Nachbargebaeude (geteilte/beruehrende Wand); nur Aussen-/Brandwand.
   *  Trainings-Feature fuers Materialmodell — entkoppelt vom Bauteiltyp. */
  nachbarkontakt?: boolean;
}

export interface SlabStructure {
  type: 'slab';
  area: number | null;
  layers: Layer[];
}

export type PartStructure = WallStructure | SlabStructure;
