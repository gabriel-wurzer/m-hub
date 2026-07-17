import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { DetectRegion, PlanDoc } from '../models/plan.model';

@Injectable({ providedIn: 'root' })
export class PlanService {
  private http = inject(HttpClient);
  private base = '/api';

  list(): Observable<Array<Pick<PlanDoc, 'id' | 'originalFilename' | 'createdAt' | 'updatedAt'>>> {
    return this.http.get<any>(`${this.base}/plan`);
  }

  get(id: string): Observable<PlanDoc> {
    return this.http.get<PlanDoc>(`${this.base}/plan/${id}`).pipe(
      map((p) => ({ ...p, wallSegments: p.wallSegments ?? [], wallGroups: p.wallGroups ?? [], placemarks: p.placemarks ?? [], polygons: p.polygons ?? [] })),
    );
  }

  save(plan: PlanDoc): Observable<PlanDoc> {
    return this.http.put<PlanDoc>(`${this.base}/plan/${plan.id}`, {
      wallSegments: plan.wallSegments,
      wallGroups: plan.wallGroups,
      placemarks: plan.placemarks,
      polygons: plan.polygons,
      calibration: plan.calibration,
      location: plan.location,
    });
  }

  upload(file: File): Observable<PlanDoc> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<PlanDoc>(`${this.base}/plan/upload`, fd);
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${this.base}/plan/${id}`);
  }

  detectWalls(id: string, wallColors: Array<[number, number, number]>, scaleDenominator?: number, tolerance?: number, regions?: DetectRegion[]): Observable<PlanDoc> {
    return this.http.post<PlanDoc>(`${this.base}/plan/${id}/detect-walls`, {
      wallColors, scaleDenominator, tolerance, regions,
    }).pipe(map((p) => ({ ...p, wallSegments: p.wallSegments ?? [], wallGroups: p.wallGroups ?? [], placemarks: p.placemarks ?? [], polygons: p.polygons ?? [] })));
  }

  rasterUrl(id: string): string {
    return `${this.base}/plan/${id}/raster`;
  }

  /** POST the batch import packet to m-hub (integrated hand-off). */
  submitImport(url: string, token: string, packet: unknown): Observable<unknown> {
    return this.http.post(url, packet, { headers: { Authorization: `Bearer ${token}` } });
  }

  floodfill(id: string, x: number, y: number, blockers?: Array<[number, number, number, number]>, bound?: Array<[number, number]>):
    Observable<{ areaM2: number; points: Array<[number, number]> }> {
    return this.http.post<{ areaM2: number; points: Array<[number, number]> }>(
      `${this.base}/plan/${id}/floodfill`, { x, y, blockers, bound });
  }
}
