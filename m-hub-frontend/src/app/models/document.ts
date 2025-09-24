import { FileType } from "../enums/file-type.enum";

/**
 * Interface for documents.
 */
export interface Document {
    id: string; // UUID of the document
    buildingId: string;
    userBuildingId: string;
    componentId?: string;   // ID of the parent component if attached to a component
    ownerId: string;        // ID of the user who uploaded the document
    name: string;
    description: string;
    isPublic: boolean;
    fileUrl?: string; // Optional file URL for documents
    fileType?: FileType; // Optional file type (e.g., 'pdf', 'jpg', 'e57')
}
