import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Building } from '../../models/building';
import { BuildingComponent } from '../../models/building-component';

@Injectable({
  providedIn: 'root'
})
export class BuildingService {

  private apiUrl = 'http://localhost:1880/api/buildings'; // Node-RED endpoint (development)

  constructor(private http: HttpClient) { }

  getBuildingById(buildingId: string): Observable<Building> {
    return this.http.get<Building>(`${this.apiUrl}/${buildingId}`);
  } 

  updateBuilding(building: Building): Observable<Building> {
    return this.http.put<Building>(`${this.apiUrl}/${building.bw_geb_id}`, building);
  }

}
