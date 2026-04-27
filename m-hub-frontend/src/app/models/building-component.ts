import { BuildingComponentCategory } from '../enums/component-category';
import { ObjectType } from '../enums/object-type';
import { PartType } from '../enums/part-type.enum';

import { Document } from "./document";
import { PartStructure } from './part-structure';

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
    is_hazardous!: boolean;
    documents?: Document[];
}

export class Bauteil extends BuildingComponent {
    part_structure!: PartStructure;
    part_type!: PartType;        
    location!: string;
}

export type CreateBauteilPayload = {
    building_id: string;
    user_building_id: string;
    owner_id: string;
    category: BuildingComponentCategory.Bauteil;
    name: string;
    description?: string;
    is_public: boolean;
    is_hazardous: boolean;
    part_type: PartType;
    part_structure: PartStructure;
    location: string;
};

export type UpdateBauteilPayload = {
    id: string;
    name: string;
    description?: string;
    is_public: boolean;
    is_hazardous: boolean;
    part_type: PartType;
    part_structure: PartStructure;
    location: string;
};

export class Objekt extends BuildingComponent {
    object_type!: ObjectType;
    count!: number;
    length?: number | null;
    width?: number | null;
    height?: number | null;
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
    is_hazardous: boolean; 
    object_type: ObjectType;
    count: number;
    length?: number | null;
    width?: number | null;
    height?: number | null;
    location: string;
    image_data_url?: string;
    image_mime_type?: string;
    image_original_name?: string;
};

export type UpdateObjektPayload = {
    id: string;
    name: string;
    description?: string;
    is_public: boolean;
    is_hazardous: boolean;
    object_type: ObjectType;
    count: number;
    length?: number | null;
    width?: number | null;
    height?: number | null;
    location: string;
    image_data_url?: string;
    image_mime_type?: string;
    image_original_name?: string;
    remove_image?: boolean;
    removeExistingImage?: boolean;
};
