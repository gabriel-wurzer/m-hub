import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Materieller Gebaeudepass (MGP) — CSV-Downloads der M-DAB-Materialbilanz.
 * Alle Endpoints liefern CSV (BOM + Semikolon, Einheit Tonnen); der JWT wird
 * vom AuthenticationInterceptor angehaengt.
 */
@Injectable({ providedIn: 'root' })
export class MaterialPassService {
  private readonly buildingsUrl = '/api/buildings';
  private readonly usersUrl = '/api/users';
  private readonly cityUrl = '/api/material-passport/city';

  constructor(private http: HttpClient) {}

  /** GET /api/buildings/:id/material-passport — MGP eines Gebaeudes. */
  downloadBuildingPassport(buildingId: string): Observable<Blob> {
    return this.http.get(`${this.buildingsUrl}/${buildingId}/material-passport`, {
      responseType: 'blob'
    });
  }

  /** GET /api/users/me/material-passport — meine Objekte, nach Bauperiode. */
  downloadMyPassport(): Observable<Blob> {
    return this.http.get(`${this.usersUrl}/me/material-passport`, { responseType: 'blob' });
  }

  /** GET /api/material-passport/city — stadtweit, nach Bauperiode. */
  downloadCityPassport(): Observable<Blob> {
    return this.http.get(this.cityUrl, { responseType: 'blob' });
  }

  /** Dasselbe City-CSV als Text — Quelle fuer die Statistik-Tabelle. */
  fetchCityCsv(): Observable<string> {
    return this.http.get(this.cityUrl, { responseType: 'text' });
  }

  /** Blob als Datei speichern (Browser-Download). */
  saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
