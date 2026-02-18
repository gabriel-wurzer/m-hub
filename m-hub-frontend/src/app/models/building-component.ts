import { BuildingComponentCategory } from '../enums/component-category';
import { ObjectType } from '../enums/object-type';
import { PartType } from '../enums/part-type.enum';

import { Document } from "./document";

/**
 * Interface for building components. Represents either a 'Bauteil' or 'Objekt'
 */
export abstract class BuildingComponent {
    id!: string;    // UUID of the building component
    building_id!: string;
    user_building_id!: string;        
    owner_id!: string;
    category!: BuildingComponentCategory;   // discriminator for filtering & serialization --> 'Bauteil' | 'Objekt'
    name!: string;
    description?: string;
    is_public!: boolean;
    documents?: Document[];
}

export class Bauteil extends BuildingComponent {
    part_structure!: string;     // TODO: part strucutre model --> contains info for different layers (including layer_index, material, thickness)
    part_type!: PartType;        
    location!: string;
}

export class Objekt extends BuildingComponent {
    object_type!: ObjectType;
    count!: number;   
    location!: string;
    image_path?: string;
    image_mime_type?: string;
    image_original_name?: string;
    image_size_bytes?: number;
    image_url?: string;
}

export type CreateObjektPayload = {
    building_id: string;
    user_building_id: string;
    owner_id: string;
    category: BuildingComponentCategory.Objekt;
    name: string;
    description?: string;
    is_public: boolean;
    object_type: ObjectType;
    count: number;
    location: string;
    image_data_url?: string;
    image_mime_type?: string;
    image_original_name?: string;
};
