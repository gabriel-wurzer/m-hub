import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CreateObjektPayload, Objekt } from '../../models/building-component';
import { BuildingComponentService } from '../building-component/building-component.service';

@Injectable({
  providedIn: 'root'
})
export class BuildingObjectService extends BuildingComponentService<Objekt, CreateObjektPayload> {

  protected override apiUrl = 'http://localhost:1880/api/objects';  // Node-RED route for Objekte

  constructor(protected override http: HttpClient) {
    super(http);
  }
}
