import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Building } from '../../models/building';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private apiUrl = 'http://localhost:1880/api/user'; // Node-RED endpoint (development)

  constructor(private http: HttpClient) { }

  getBuildingsByUser(userId: string): Observable<Building[]> {
    return this.http.get<Building[]>(`${this.apiUrl}/${userId}/buildings`);
  }

  isBuildingInUser(userId: string, buildingId: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/${userId}/buildings/${buildingId}/exists`);
  }
  
  getUserBuildingData(userId: string, buildingId: number): Observable<{ name: string, address: string }> {
    return this.http.get<{ name: string, address: string }>(`${this.apiUrl}/${userId}/buildings/${buildingId}/data`);
  }

  addUserBuildingData(userId: string, buildingId: number, name: string | null, address: string | null): Observable<{ userId: string, buildingId: number, name: string | null, address: string | null }> {
    const body = { name, address };
    return this.http.post<{ userId: string, buildingId: number, name: string | null, address: string | null }>(`${this.apiUrl}/${userId}/buildings/${buildingId}/data`, body);
  }

  addBuildingToUser(userId: string, buildingId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${userId}/buildings`, { buildingId });
  }

  removeBuildingFromUser(userId: string, buildingId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${userId}/buildings/${buildingId}`);
  }
  
}



