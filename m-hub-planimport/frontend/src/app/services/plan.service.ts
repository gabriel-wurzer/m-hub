import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, switchMap } from 'rxjs';
import { DetectRegion, PlanDoc } from '../models/plan.model';

@Injectable({ providedIn: 'root' })
export class PlanService {
  private http = inject(HttpClient);
  // Relative so it resolves against <base href>: '/api' at root standalone,
  // '/plantool/api' when the app is served under /plantool (base-href=/plantool/).
  // Absolute '/api' would hit m-hub's backend instead when served under a path.
  private base = 'api';

  /**
   * Fehlende Listen auffüllen und die Rasteradresse SELBST setzen.
   *
   * Das Backend kennt den Pfad nicht, unter dem das Tool ausgeliefert wird. Eine
   * dort gebaute absolute Adresse (`/api/plan/<id>/raster`) zeigt unter
   * `/plantool` auf m-hubs node-red statt aufs Tool, der Plan bleibt leer.
   * Deshalb ist die Adresse hier relativ und löst gegen `<base href>` auf.
   * Gilt auch für alte Pläne, in denen die absolute Adresse noch gespeichert ist.
   */
  private normalize = (p: PlanDoc): PlanDoc => ({
    ...p,
    wallSegments: p.wallSegments ?? [],
    wallGroups: p.wallGroups ?? [],
    placemarks: p.placemarks ?? [],
    polygons: p.polygons ?? [],
    rasterUrl: this.rasterUrl(p.id),
  });

  list(): Observable<Array<Pick<PlanDoc, 'id' | 'originalFilename' | 'createdAt' | 'updatedAt'>>> {
    return this.http.get<any>(`${this.base}/plan`);
  }

  get(id: string): Observable<PlanDoc> {
    return this.http.get<PlanDoc>(`${this.base}/plan/${id}`).pipe(map(this.normalize));
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
    return this.http.post<PlanDoc>(`${this.base}/plan/upload`, fd).pipe(map(this.normalize));
  }

  /**
   * Create a plan from the PDF, das m-hub beim Absprung mitgibt.
   *
   * Das Ziehen passiert im BROWSER, nicht im Tool-Backend: die pdf_url ist eine
   * m-hub-Adresse, und das Tool-Backend steht in einem eigenen Container ohne
   * Route dorthin (lokal ist localhost:8910 aus dem Container heraus es selbst).
   * Der Browser hat die Adresse ohnehin offen, also laedt er die Datei und
   * schickt die Bytes durch denselben Upload wie eine handverlesene Datei.
   */
  createFromUrl(url: string, filename?: string): Observable<PlanDoc> {
    return this.http.get(url, { responseType: 'blob' }).pipe(
      switchMap((blob) => {
        const fd = new FormData();
        fd.append('file', new File([blob], filename || 'plan.pdf', { type: 'application/pdf' }));
        return this.http.post<PlanDoc>(`${this.base}/plan/upload`, fd);
      }),
      map(this.normalize),
    );
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${this.base}/plan/${id}`);
  }

  detectWalls(id: string, wallColors: Array<[number, number, number]>, scaleDenominator?: number, tolerance?: number, regions?: DetectRegion[]): Observable<PlanDoc> {
    return this.http.post<PlanDoc>(`${this.base}/plan/${id}/detect-walls`, {
      wallColors, scaleDenominator, tolerance, regions,
    }).pipe(map(this.normalize));
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
