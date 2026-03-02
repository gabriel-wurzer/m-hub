import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Building } from '../../models/building';
import { BuildingComponent } from '../../models/building-component';
import { Floor } from '../../models/floor';

@Injectable({
  providedIn: 'root'
})
export class BuildingService {

  private readonly buildingsUrl = 'http://localhost:1880/api/buildings'; // Node-RED endpoint (development)

  constructor(private http: HttpClient) { }

  // --- Base building ---

    /**
   * GET /api/buildings/:buildingId
   */
  getBuildingById(buildingId: string): Observable<Building> {
    return this.http.get<Building>(`${this.buildingsUrl}/${buildingId}`);
  } 

    /**
   * GET /api/buildings/:buildingId/components
   */ 
  getAllComponentsByBuilding(buildingId: string): Observable<BuildingComponent[]> {
    return this.http.get<BuildingComponent[]>(`${this.buildingsUrl}/${buildingId}/components`);
  }

    /**
   * GET /api/buildings/:buildingId/latest-structure
   */
  getLatestBuildingStructure(buildingId: string): Observable<Floor[]> {
    return this.http.get<Floor[]>(`${this.buildingsUrl}/${buildingId}/latest-structure`); 
  }
}
