import { ConnectionType } from '../enums/connection-type.enum';
import { MaterialType } from '../enums/material-type.enum';

export const UNKNOWN_LAYER_MATERIAL = 'Unbekannt' as const;

export type LayerMaterial = MaterialType | ConnectionType | typeof UNKNOWN_LAYER_MATERIAL;

export const LAYER_MATERIAL_OPTIONS: LayerMaterial[] = [
  ...Object.values(MaterialType),
  ...Object.values(ConnectionType),
  UNKNOWN_LAYER_MATERIAL
];
