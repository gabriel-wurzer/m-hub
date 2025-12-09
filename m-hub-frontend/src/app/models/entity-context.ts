import { BuildingComponentCategory } from "../enums/component-category";

/**
 * Context interface for entity distiction.
 */

export type EntityType = 'building' | 'component';

export interface EntityContext {
  id: string;
  type: EntityType;
  category?: BuildingComponentCategory; // Required only if type is 'component'
}