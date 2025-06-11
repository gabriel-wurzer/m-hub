import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BuildingComponent } from '../../models/building-component';
import { Document } from '../../models/document';

@Injectable({
  providedIn: 'root'
})
export class BuildingComponentService {

  private apiUrl = 'http://localhost:1880/api/component'; // Node-RED endpoint (development)

  constructor(private http: HttpClient) { }

  getBuildingComponentById(buildingComponentId: string): Observable<BuildingComponent> {
    return this.http.get<BuildingComponent>(`${this.apiUrl}/${buildingComponentId}`);
  } 

  getDocumentsByBuildingComponent(buildingComponentId: string): Observable<Document[]> {
    return this.http.get<Document[]>(`${this.apiUrl}/${buildingComponentId}/documents`);
  }

}
