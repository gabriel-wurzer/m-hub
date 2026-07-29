import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/** Antwort des Plausibilitaets-Service (m-hub-processing/plausibility_api.py). */
export interface PlausibilityResult {
  stufe: 1 | 2 | 3;      // 3 = passt, 2 = divergent/bestaetigen, 1 = unplausibel
  label: string;
  detail: string;
  umgekehrt: boolean;    // Aufbau wurde vermutlich verkehrt-herum eingegeben
  referenz_n: number;    // Anzahl Referenz-Aufbauten in der Zelle
}

export interface PlausibilityRequest {
  period?: string | null;      // Bauperiode (Gebaeude)
  floor_type?: string | null;  // FloorType-Wert (KG/RG/Dach)
  part_type?: string | null;   // PartType-Wert (Innenwand/Aussenwand/...)
  materials: string[];         // Material-Namen in Aufbau-Reihenfolge
}

/** Ruft den node-red-Endpoint /api/plausibility (-> Python-Service). */
@Injectable({ providedIn: 'root' })
export class PlausibilityService {
  private readonly apiUrl = '/api/plausibility';

  constructor(private readonly http: HttpClient) {}

  check(request: PlausibilityRequest): Observable<PlausibilityResult> {
    return this.http.post<PlausibilityResult>(this.apiUrl, request);
  }
}
