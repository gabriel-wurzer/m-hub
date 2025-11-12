import { FileType } from "../enums/file-type.enum";

/**
 * Interface for documents.
 */
export interface Document {
    id: string; // UUID of the document
    building_id: string;
    user_building_id: string;
    component_id?: string;   // ID of the parent component if attached to a component
    owner_id: string;        // ID of the user who uploaded the document
    name: string;
    description: string;
    is_public: boolean;
    file_url?: string; // Optional file URL for documents
    file_type?: FileType; // Optional file type (e.g., 'pdf', 'jpg', 'e57')
}
