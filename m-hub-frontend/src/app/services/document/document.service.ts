import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Document } from '../../models/document';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private apiUrl = 'http://localhost:1880/api/documents'; // Node-RED endpoint for documents

  constructor(private http: HttpClient) {}

  getBuildingById(documentId: string): Observable<Document> {
    return this.http.get<Document>(`${this.apiUrl}/${documentId}`);
  } 

  /**
   * Generic document fetcher that supports multiple filters.
   */
  getDocuments(filters: { buildingId?: string; componentId?: string; ownerId?: string }): Observable<Document[]> {
    const params = new HttpParams({ fromObject: filters as any });
    return this.http.get<Document[]>(this.apiUrl, { params });
  }
  
}