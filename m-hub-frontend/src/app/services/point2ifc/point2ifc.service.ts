import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/** Antwort auf POST /api/point2ifc/start. */
export interface Point2ifcStart {
  job_id: string;
  status: string;
}

/** Antwort auf GET /api/point2ifc/:jobId/status. */
export interface Point2ifcStatus {
  status: 'queued' | 'running' | 'done' | 'error';
  result: {
    ifc: string;
    storeys: number;
    walls: number;
    openings: number;
    slabs: number;
    roofs: number;
  } | null;
  error: string | null;
}

/**
 * Startet/pollt den Point2IFC-Job (Punktwolke -> reduziertes IFC) ueber node-red
 * (/api/point2ifc/*, JWT via Interceptor automatisch). Der eigentliche Service
 * ist m-hub-processing/point2ifc (async, ein Worker).
 */
@Injectable({ providedIn: 'root' })
export class Point2ifcService {
  private readonly base = '/api/point2ifc';

  constructor(private readonly http: HttpClient) {}

  /** Startet einen Job fuer ein bereits hochgeladenes Punktwolken-Dokument. */
  startJob(documentId: string): Observable<Point2ifcStart> {
    return this.http.post<Point2ifcStart>(`${this.base}/start`, { document_id: documentId });
  }

  /** Fragt den Job-Status ab. */
  getStatus(jobId: string): Observable<Point2ifcStatus> {
    return this.http.get<Point2ifcStatus>(`${this.base}/${jobId}/status`);
  }

  /** Laedt das fertige reduzierte IFC als Blob (JWT-gated). */
  getIfc(jobId: string): Observable<Blob> {
    return this.http.get(`${this.base}/${jobId}/ifc`, { responseType: 'blob' });
  }
}
