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

  getBuildingsByUser(userId: string): Observable<Building> {
    return this.http.get<Building>(`${this.apiUrl}/${userId}/buildings`);
  } 

}



