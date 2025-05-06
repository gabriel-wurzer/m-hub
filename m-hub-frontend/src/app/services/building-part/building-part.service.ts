import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BuildingPart } from '../../models/building-part';

@Injectable({
  providedIn: 'root'
})
export class BuildingPartService {

  private apiUrl = 'http://localhost:1880/api/building-part'; // Node-RED endpoint (development)

  constructor(private http: HttpClient) { }

  getBuildingPartById(buildingPartId: string): Observable<BuildingPart> {
    return this.http.get<BuildingPart>(`${this.apiUrl}/${buildingPartId}`);
  } 

  getDocumentsByBuildingPart(buildingPartId: string): Observable<BuildingPart[]> {
    return this.http.get<BuildingPart[]>(`${this.apiUrl}/${buildingPartId}/documents`);
  }
}
