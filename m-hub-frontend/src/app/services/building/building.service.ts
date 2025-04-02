import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BuildingPart } from '../../models/building-part';

@Injectable({
  providedIn: 'root'
})
export class BuildingService {

  private apiUrl = 'http://localhost:1880/api/building'; // Node-RED endpoint (development)

  constructor(private http: HttpClient) { }

  getDocumentsByBuilding(buildingId: number): Observable<BuildingPart[]> {
    return this.http.get<BuildingPart[]>(`${this.apiUrl}/${buildingId}/documents`);
  }

  getBuildingPartsByBuilding(buildingId: number): Observable<BuildingPart[]> {
    return this.http.get<BuildingPart[]>(`${this.apiUrl}/${buildingId}/parts`);
  }
}
