import { BuildingComponentType } from '../enums//building-component-type.enum';

export type BuildingComponentCategory = 'materialComposition' | 'object';

export const BuildingComponentTypeCategoryMap: Record<BuildingComponentType, BuildingComponentCategory> = {
  [BuildingComponentType.Wand]: 'materialComposition',
  [BuildingComponentType.Decke]: 'materialComposition',
  [BuildingComponentType.Fussbodenaufbau]: 'materialComposition',
  [BuildingComponentType.Dach]: 'materialComposition',
  [BuildingComponentType.Fundament]: 'materialComposition',

  [BuildingComponentType.Abhängung]: 'object',
  [BuildingComponentType.Tür]: 'object',
  [BuildingComponentType.Zarge]: 'object',
  [BuildingComponentType.Fenster]: 'object',
  [BuildingComponentType.Heizkörper]: 'object',
  [BuildingComponentType.Rohre]: 'object',
  [BuildingComponentType.Kabel]: 'object',
  [BuildingComponentType.Sonstige]: 'object',
};
