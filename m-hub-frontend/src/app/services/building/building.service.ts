import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Building } from '../../models/building';
import { BuildingComponent } from '../../models/building-component';

@Injectable({
  providedIn: 'root'
})
export class BuildingService {

  private readonly buildingsUrl = 'http://localhost:1880/api/buildings'; // Node-RED endpoint (development)

  constructor(private http: HttpClient) { }

  // --- Base building ---
  getBuildingById(buildingId: string): Observable<Building> {
    return this.http.get<Building>(`${this.buildingsUrl}/${buildingId}`);
  } 

  getAllComponentsByBuilding(buildingId: string): Observable<BuildingComponent[]> {
    return this.http.get<BuildingComponent[]>(`${this.buildingsUrl}/${buildingId}/components`);
  }
}
