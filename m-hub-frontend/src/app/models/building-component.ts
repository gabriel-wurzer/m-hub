import { BuildingComponentType } from '../enums/building-component-type.enum';
import { Document } from "./document";

/**
 * Interface for building components.
 */
export interface BuildingComponent {
    id: string; // UUID of the building part
    buildingId: string;
    ownerId: string;
    location: string; // Storey[];
    name: string;
    description?: string;
    type: BuildingComponentType, // Defines the type of the component (see type enum); furthermore the type defines an upper type via category map --> BuildingComponentTypeCategoryMap[component.type];
    isPublic: boolean;
    documents?: Document[]; // Optional array of appended documents
}
