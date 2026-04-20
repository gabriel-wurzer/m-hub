import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { OekobaudatHit, PlanDoc } from '../models/plan.model';

@Injectable({ providedIn: 'root' })
export class PlanService {
  private http = inject(HttpClient);
  private base = '/api';

  list(): Observable<Array<Pick<PlanDoc, 'id' | 'originalFilename' | 'createdAt' | 'updatedAt'>>> {
    return this.http.get<any>(`${this.base}/plan`);
  }

  get(id: string): Observable<PlanDoc> {
    return this.http.get<PlanDoc>(`${this.base}/plan/${id}`).pipe(
      map((p) => ({ ...p, wallSegments: p.wallSegments ?? [], polygons: p.polygons ?? [] })),
    );
  }

  save(plan: PlanDoc): Observable<PlanDoc> {
    return this.http.put<PlanDoc>(`${this.base}/plan/${plan.id}`, {
      wallSegments: plan.wallSegments,
      polygons: plan.polygons,
      calibration: plan.calibration,
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

  detectWalls(id: string, wallColors: Array<[number, number, number]>, scaleDenominator?: number, tolerance?: number): Observable<PlanDoc> {
    return this.http.post<PlanDoc>(`${this.base}/plan/${id}/detect-walls`, {
      wallColors, scaleDenominator, tolerance,
    }).pipe(map((p) => ({ ...p, wallSegments: p.wallSegments ?? [], polygons: p.polygons ?? [] })));
  }

  rasterUrl(id: string): string {
    return `${this.base}/plan/${id}/raster`;
  }

  searchMaterials(q: string): Observable<OekobaudatHit[]> {
    return this.http.get<OekobaudatHit[]>(`${this.base}/materials/search`, { params: { q } });
  }
}
