import { FileType } from "../enums/file-type.enum";

/**
 * Interface for building parts.
 */
export interface BuildingPart {
    id: string; // UUID of the building part
    buildingId: string;
    name: string;
    description: string;
    type: 'document' | 'building_part'; // Defines whether it is a document or a nested building part
    ownerId: string;
    isPublic: boolean;
    fileUrl?: string; // Optional file URL for documents
    fileType?: FileType; // optional file type (e.g., 'pdf', 'jpg', 'e57')
    children?: BuildingPart[]; // Only exists if it's a non-document building part
}
