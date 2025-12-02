import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';

import { Building, UserBuilding } from '../../models/building';

@Injectable({
  providedIn: 'root'
})
export class BuildingService {

  private readonly buildingsUrl = 'http://localhost:1880/api/buildings'; // Node-RED endpoint (development)

  private readonly userBuildingsUrl = 'http://localhost:1880/api/user-buildings'; // Node-RED endpoint (development)


  constructor(private http: HttpClient) { }

  // --- Base building ---
  getBuildingById(buildingId: string): Observable<Building> {
    return this.http.get<Building>(`${this.buildingsUrl}/${buildingId}`);
  } 

  updateBuilding(building: Building): Observable<Building> {
    return this.http.put<Building>(`${this.buildingsUrl}/${building.bw_geb_id}`, building);
  }


  // --- User-specific building ---
  getUserBuilding(userId: string, buildingId: string): Observable<UserBuilding | null> {
    const params = new HttpParams()
      .set('userId', userId)
      .set('buildingId', buildingId);

    return this.http.get<UserBuilding[]>(this.userBuildingsUrl, { params }).pipe(
      map(results => results.length > 0 ? results[0] : null)
    );
  }

  createUserBuilding(userId: string, buildingId: string, data: Partial<UserBuilding>): Observable<UserBuilding> {
    const payload = { ...data, user_id: userId, building_id: buildingId };
    return this.http.post<UserBuilding>(`${this.userBuildingsUrl}`, payload);
  }

  updateUserBuilding(userBuildingId: string, data: Partial<UserBuilding>): Observable<UserBuilding> {
    const payload = { ...data};
    return this.http.put<UserBuilding>(`${this.userBuildingsUrl}/${userBuildingId}`, payload);
  }

}
