import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Aufbau {
  folge: string[];
  anteil: number;
}

export interface CatalogCell {
  bauperiode: string;
  ort: string;
  art: string;
  ort_label: string;
  art_label: string;
  quelle: 'gemessen' | 'modell' | string;
  n: number;
  aufbauten: Aufbau[];
}

export interface CatalogResponse {
  cells: CatalogCell[];
  period_order: string[];
  ort_order: string[];
  art_order: string[];
}

/**
 * Aufbauten-Katalog: typische Schichtfolgen je Bauperiode × Ort × Art.
 * Kommt aus dem Markov-/Referenz-Modell (plausibility-service /catalog).
 */
@Injectable({ providedIn: 'root' })
export class AufbautenKatalogService {
  private readonly url = '/api/aufbauten-katalog';

  constructor(private http: HttpClient) {}

  getCatalog(): Observable<CatalogResponse> {
    return this.http.get<CatalogResponse>(this.url);
  }
}
