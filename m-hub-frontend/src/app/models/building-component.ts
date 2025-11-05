import { BuildingComponentCategory } from '../enums/component-category';
import { ObjectType } from '../enums/object-type';
import { PartType } from '../enums/part-type.enum';

import { Document } from "./document";

/**
 * Interface for building components. Represents either a 'Bauteil' or 'Objekt'
 */
export abstract class BuildingComponent {
    id!: string;    // UUID of the building component
    buildingId!: string;        
    ownerId!: string;
    category!: BuildingComponentCategory;   // discriminator for filtering & serialization --> 'Bauteil' | 'Objekt'
    name!: string;
    description?: string;
    isPublic!: boolean;
    documents?: Document[];
}

export class Bauteil extends BuildingComponent {
    partStructure!: string;     // TODO: part strucutre model --> contains info for different layers (including layer_index, material, thickness)
    partType!: PartType;        
    location!: string;          // TODO: concrete location --> buildingStructure element reference
}

export class Objekt extends BuildingComponent {
    objectType!: ObjectType;
    count!: number;   
    location?: string;
}
