import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateDocumentPayload, Document } from '../../models/document';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private apiUrl = 'http://localhost:1880/api/documents'; // Node-RED endpoint for documents

  constructor(private http: HttpClient) {}

  getDocumentById(documentId: string): Observable<Document> {
    return this.http.get<Document>(`${this.apiUrl}/${documentId}`);
  } 

  /**
   * Generic document fetcher that supports multiple filters.
   */
  getDocuments(filters: { buildingId?: string; componentId?: string; ownerId?: string }): Observable<Document[]> {
    const cleanFilters: any = {};
    Object.keys(filters).forEach(key => {
      const value = (filters as any)[key];
      if (value !== null && value !== undefined && value !== '') {
        cleanFilters[key] = value;
      }
    });

    const params = new HttpParams({ fromObject: cleanFilters });
    return this.http.get<Document[]>(this.apiUrl, { params });
  }

  getDocumentsByUserBuilding(userBuildingId: string): Observable<Document[]> {
    return this.http.get<Document[]>(`${this.apiUrl}/building/${userBuildingId}`);
  }

  createDocument(document: CreateDocumentPayload): Observable<Document> {
    return this.http.post<Document>(this.apiUrl, document);
  }

  updateDocument(document: Document): Observable<Document> {
    return this.http.put<Document>(`${this.apiUrl}/${document.id}`, document);
  }

  deleteDocument(documentId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${documentId}`);
  }
  
}
