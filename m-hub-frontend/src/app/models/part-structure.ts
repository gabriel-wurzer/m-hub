import { Material } from '../enums/material.enum';
import { PartType } from '../enums/part-type.enum';

export enum PartStructureOrientation {
  Vertical = 'vertical',
  Horizontal = 'horizontal'
}

export enum PartStructureMeasureType {
  Length = 'length',
  Area = 'area'
}

export interface PartLayer {
  layer_index: number;
  material: Material | null;
  thickness: number | null;
  length: number | null;
  area: number | null;
}

export interface PartStructure {
  orientation: PartStructureOrientation;
  measureType: PartStructureMeasureType;
  layers: PartLayer[];
}

export const WALL_PART_TYPES: readonly PartType[] = [
  PartType.Innenwand,
  PartType.Aussenwand,
  PartType.Brandwand,
  PartType.Kniestock,
  PartType.Attika
];

export const FLOOR_PART_TYPES: readonly PartType[] = [PartType.Boden, PartType.Dachaufbau];

export function getPartStructureOrientation(partType: PartType | null | undefined): PartStructureOrientation | null {
  if (!partType) return null;
  if (WALL_PART_TYPES.includes(partType)) return PartStructureOrientation.Vertical;
  if (FLOOR_PART_TYPES.includes(partType)) return PartStructureOrientation.Horizontal;
  return null;
}

export function getPartStructureMeasureType(partType: PartType | null | undefined): PartStructureMeasureType | null {
  if (!partType) return null;
  if (WALL_PART_TYPES.includes(partType)) return PartStructureMeasureType.Length;
  if (FLOOR_PART_TYPES.includes(partType)) return PartStructureMeasureType.Area;
  return null;
}
