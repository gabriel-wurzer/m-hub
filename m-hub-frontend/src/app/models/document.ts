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
    description?: string;
    is_public: boolean;
    file_url?: string; // Optional file URL for documents
    file_type?: FileType; // Optional file type (e.g., 'pdf', 'jpg', 'e57')
}

/** Zusammenfassung eines Point2IFC-Laufs (persistierter Job-Status). */
export type Point2ifcSummary = {
    storeys?: number;
    walls?: number;
    openings?: number;
    slabs?: number;
    roofs?: number;
};

export type DocumentSummaryDto = Pick<Document, 'id' | 'name' | 'file_type' | 'component_id'> & {
    can_read?: boolean;
    canRead?: boolean;
    // Point2IFC: durabler Job-Status, kommt aus der documents-Zeile (Backend ist die Wahrheit).
    p2i_status?: 'queued' | 'running' | 'done' | 'error' | null;
    p2i_job_id?: string | null;
    p2i_result?: Point2ifcSummary | null;
    p2i_error?: string | null;
};

export type CreateDocumentPayload = {
    building_id: string;
    user_building_id: string;
    component_id?: string;
    name: string;
    description?: string;
    is_public: boolean;
    file_data_url: string;
    file_mime_type?: string;
    file_original_name?: string;
    file_type?: FileType;
};

export type UpdateDocumentPayload = {
    id: string;
    component_id?: string;
    name: string;
    description?: string;
    is_public: boolean;
    file_data_url?: string;
    file_mime_type?: string;
    file_original_name?: string;
    file_type?: FileType;
};

/**
 * Metadata for reserving a document before a resumable (big-file) upload.
 * Same fields as CreateDocumentPayload but WITHOUT the inline file bytes.
 */
export type ReserveDocumentPayload = {
    building_id: string;
    user_building_id: string;
    component_id?: string;
    name: string;
    description?: string;
    is_public: boolean;
    file_type?: FileType;
    file_original_name?: string;
    file_size?: number; // Bytes; ermoeglicht idempotenten reserve (Upload-Resume)
};

/** Short-lived ticket the backend hands out to stream the file to the upload service. */
export type UploadTicket = {
    endpoint: string; // where to POST the tus upload, e.g. '/upload'
    token: string;    // scoped upload JWT (Bearer) for the upload service
    metadata: {
        document_id: string;
        user_building_id: string;
        filename: string;
        filetype: string;
    };
};

export type ReserveDocumentResponse = {
    document: Document;
    upload: UploadTicket;
};
