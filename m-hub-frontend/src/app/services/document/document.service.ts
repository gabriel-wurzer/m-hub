import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import * as tus from 'tus-js-client';
import {
  CreateDocumentPayload,
  Document,
  DocumentSummaryDto,
  ReserveDocumentPayload,
  ReserveDocumentResponse,
  UpdateDocumentPayload
} from '../../models/document';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private apiUrl = '/api/documents'; // Node-RED endpoint for documents

  constructor(private http: HttpClient) {}

  getDocumentById(documentId: string): Observable<Document> {
    return this.http.get<Document>(`${this.apiUrl}/${documentId}`);
  } 

  getDocumentSummariesByBuilding(buildingId: string, componentId?: string): Observable<DocumentSummaryDto[]> {
    let params = new HttpParams();
    if (componentId) {
      params = params.set('componentId', componentId);
    }

    return this.http.get<DocumentSummaryDto[]>(`${this.apiUrl}/by-building/${buildingId}`, { params });
  }

  // /**
  //  * Generic document fetcher that supports multiple filters.
  //  */
  // getDocuments(filters: { buildingId?: string; componentId?: string; ownerId?: string }): Observable<Document[]> {
  //   const cleanFilters: any = {};
  //   Object.keys(filters).forEach(key => {
  //     const value = (filters as any)[key];
  //     if (value !== null && value !== undefined && value !== '') {
  //       cleanFilters[key] = value;
  //     }
  //   });

  //   const params = new HttpParams({ fromObject: cleanFilters });
  //   return this.http.get<Document[]>(this.apiUrl, { params });
  // }

  getDocumentsByUserBuilding(userBuildingId: string): Observable<Document[]> {
    return this.http.get<Document[]>(`${this.apiUrl}/building/${userBuildingId}`);
  }

  createDocument(document: CreateDocumentPayload): Observable<Document> {
    return this.http.post<Document>(this.apiUrl, document);
  }

  /** Reserve a document (metadata only) and get a scoped upload ticket. */
  reserveDocument(payload: ReserveDocumentPayload): Observable<ReserveDocumentResponse> {
    return this.http.post<ReserveDocumentResponse>(`${this.apiUrl}/reserve`, payload);
  }

  /** Record the stored file on a reserved document after the upload finished. */
  attachDocument(documentId: string, storedPath: string): Observable<Document> {
    return this.http.post<Document>(`${this.apiUrl}/${documentId}/attach`, { stored_path: storedPath });
  }

  /**
   * Resumable upload for big files (point clouds, IFC, large PDFs): reserve ->
   * stream the file to the upload service via tus -> attach. Bytes never go
   * through the base64/node-red path. Emits the created Document on success;
   * `onProgress` reports 0..100. Unsubscribe to abort an in-flight upload.
   */
  uploadResumable(
    file: File,
    meta: ReserveDocumentPayload,
    onProgress?: (percent: number, sentBytes: number, totalBytes: number) => void
  ): Observable<Document> {
    return new Observable<Document>(subscriber => {
      let upload: tus.Upload | null = null;
      let aborted = false;

      // file_size mitschicken: der reserve-Endpoint ist idempotent (UPSERT auf
      // owner+gebaeude+dateiname+groesse), damit ein abgebrochener Upload beim
      // Fortsetzen dieselbe document-Zeile trifft statt neue Waisen zu erzeugen.
      const reserveMeta: ReserveDocumentPayload = { ...meta, file_size: file.size };

      const sub = this.reserveDocument(reserveMeta).subscribe({
        next: reserved => {
          if (aborted) return;
          const { document, upload: ticket } = reserved;
          const m = ticket.metadata;
          // The upload service stores at this deterministic path (built from the
          // same signed-token claims), so we attach with it directly. (The
          // service also returns X-Stored-Path, but browsers block reading that
          // non-safelisted header, and it would be identical anyway.)
          const storedPath = `/mhub/documents/${m.user_building_id}/${m.document_id}/${m.filename}`;

          upload = new tus.Upload(file, {
            endpoint: ticket.endpoint,
            chunkSize: 16 * 1024 * 1024, // 16 MB: kuerzere PATCHes -> ein Chunk kommt eher vor dem naechsten Leitungsabriss durch
            retryDelays: [0, 1000, 3000, 5000, 10000, 30000],
            removeFingerprintOnSuccess: true,
            headers: { Authorization: `Bearer ${ticket.token}` },
            metadata: m as unknown as Record<string, string>,
            onProgress: (sent, total) => {
              if (onProgress && total > 0) onProgress(Math.round((sent / total) * 100), sent, total);
            },
            onError: err => subscriber.error(err),
            onSuccess: () => {
              this.attachDocument(document.id, storedPath).subscribe({
                next: doc => {
                  subscriber.next(doc);
                  subscriber.complete();
                },
                error: err => subscriber.error(err)
              });
            }
          });

          // Wackelige Leitung: bei erneutem Versuch mit derselben Datei den zuvor
          // abgebrochenen Upload per tus-Fingerprint fortsetzen (ab dem Offset)
          // statt bei 0 zu beginnen. tus persistiert die Upload-URL in localStorage.
          const u = upload;
          u.findPreviousUploads()
            .then(prev => {
              if (aborted) return;
              if (prev.length > 0) u.resumeFromPreviousUpload(prev[0]);
              u.start();
            })
            .catch(() => { if (!aborted) u.start(); });
        },
        error: err => subscriber.error(err)
      });

      return () => {
        aborted = true;
        sub.unsubscribe();
        upload?.abort();
      };
    });
  }

  updateDocument(document: UpdateDocumentPayload): Observable<Document> {
    return this.http.put<Document>(`${this.apiUrl}/${document.id}`, document);
  }

  deleteDocument(documentId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${documentId}`);
  }
  
}
