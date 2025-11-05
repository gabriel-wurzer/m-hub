import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Bauteil } from '../../models/building-component';
import { BuildingComponentService } from '../building-component/building-component.service';

@Injectable({
  providedIn: 'root'
})
export class BuildingPartService extends BuildingComponentService<Bauteil> {

  protected override apiUrl = 'http://localhost:1880/api/parts';  // Node-RED route for Bauteile

  constructor(protected override http: HttpClient) {
    super(http);
  }
}
