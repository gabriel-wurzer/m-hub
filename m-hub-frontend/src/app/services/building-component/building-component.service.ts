import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BuildingComponent } from '../../models/building-component';

@Injectable({
  providedIn: 'root'
})
export abstract class BuildingComponentService<T extends BuildingComponent, TCreate = T> {

  protected abstract apiUrl: string;  // To be set in subclasses

  constructor(protected http: HttpClient) {}

  getComponentById(componentId: string): Observable<T> {
    return this.http.get<T>(`${this.apiUrl}/${componentId}`);
  }

  getComponentsByUserBuilding(userBuildingId: string): Observable<T[]> {
    return this.http.get<T[]>(`${this.apiUrl}/building/${userBuildingId}`);
  }

  createComponent(component: TCreate): Observable<T> {
    return this.http.post<T>(this.apiUrl, component);
  }

  updateComponent(component: T): Observable<T> {
    return this.http.put<T>(`${this.apiUrl}/${component.id}`, component);
  }

  deleteComponent(componentId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${componentId}`);
  }

}
