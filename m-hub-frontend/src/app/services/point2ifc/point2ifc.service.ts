import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/** Antwort auf POST /api/point2ifc/start. */
export interface Point2ifcStart {
  job_id: string;
  status: string;
}

/**
 * Startet den Point2IFC-Job (Punktwolke -> reduziertes IFC) ueber node-red
 * (/api/point2ifc/start, JWT via Interceptor automatisch). Der Status wird durabel
 * in der DB gefuehrt; das fertige IFC erscheint als eigenes Dokument (kein Poll/Download hier).
 */
@Injectable({ providedIn: 'root' })
export class Point2ifcService {
  private readonly base = '/api/point2ifc';

  constructor(private readonly http: HttpClient) {}

  /** Startet einen Job fuer ein bereits hochgeladenes Punktwolken-Dokument. */
  startJob(documentId: string): Observable<Point2ifcStart> {
    return this.http.post<Point2ifcStart>(`${this.base}/start`, { document_id: documentId });
  }
}
