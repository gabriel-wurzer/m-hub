import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Building } from '../../models/building';
import { BuildingComponent } from '../../models/building-component';
import { Document } from '../../models/document';

@Injectable({
  providedIn: 'root'
})
export class BuildingService {

  private apiUrl = 'http://localhost:1880/api/building'; // Node-RED endpoint (development)

  constructor(private http: HttpClient) { }

  getBuildingById(buildingId: string): Observable<Building> {
    return this.http.get<Building>(`${this.apiUrl}/${buildingId}`);
  } 

  getDocumentsByBuilding(buildingId: string): Observable<Document[]> {
    return this.http.get<Document[]>(`${this.apiUrl}/${buildingId}/documents`);
  }

  getBuildingComponentsByBuilding(buildingId: string): Observable<BuildingComponent[]> {
    return this.http.get<BuildingComponent[]>(`${this.apiUrl}/${buildingId}/components`);
  }

  updateBuilding(building: Building): Observable<Building> {
    return this.http.put<Building>(`${this.apiUrl}/${building.bw_geb_id}`, building);
  }

}
