import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UserBuilding } from '../../models/building';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private apiUrl = 'http://localhost:1880/api/users'; // Node-RED endpoint (development)

  constructor(private http: HttpClient) { }

    /**
   * GET /api/users/me//buildings
   */
  getUserBuildingsList(): Observable<UserBuilding[]> {
    return this.http.get<UserBuilding[]>(`${this.apiUrl}/me/buildings`);
  }

    /**
   * GET /api/users/me/buildings/:buildingId
   */
  getUserBuilding(buildingId: string): Observable<UserBuilding | null> {
      return this.http.get<UserBuilding | null>(`${this.apiUrl}/me/buildings/${buildingId}`);
  }

    /**
   * POST /api/users/me/buildings/
   */
  createUserBuilding(buildingId: string, data: Partial<UserBuilding>): Observable<UserBuilding> {
    const payload = { ...data, building_id: buildingId };
    return this.http.post<UserBuilding>(`${this.apiUrl}/me/buildings`, payload);
  }

    /**
   * PUT /api/users/me/buildings/:userBuildingId
   */
  updateUserBuilding(userBuildingId: string, data: Partial<UserBuilding>): Observable<UserBuilding> {
    const payload = { ...data};
    return this.http.put<UserBuilding>(`${this.apiUrl}/me/buildings/${userBuildingId}`, payload);
  }

    /**
   * DELETE /api/users/me/buildings/:userBuildingId
   */
  deleteUserBuilding(userBuildingId: string): Observable<UserBuilding> {
    return this.http.delete<UserBuilding>(`${this.apiUrl}/me/buildings/${userBuildingId}`);
  }

}



