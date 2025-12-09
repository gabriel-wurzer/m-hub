import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Building } from '../../models/building';

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

  updateBuilding(building: Building): Observable<Building> {
    return this.http.put<Building>(`${this.buildingsUrl}/${building.bw_geb_id}`, building);
  }
}
