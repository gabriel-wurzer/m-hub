import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private apiUrl = 'http://localhost:1880/api/user'; // Node-RED endpoint (development)

  constructor(private http: HttpClient) { }

  getBuildingsByUser(userId: string): Observable<number[]> {
    return this.http.get<number[]>(`${this.apiUrl}/${userId}/buildings`);
  }

  isBuildingInUser(userId: string, buildingId: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/${userId}/buildings/${buildingId}/exists`);
  }
  
  addBuildingToUser(userId: string, buildingId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${userId}/buildings`, { buildingId });
  }
  
}



