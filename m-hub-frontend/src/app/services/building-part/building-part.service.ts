import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Bauteil, CreateBauteilPayload, UpdateBauteilPayload } from '../../models/building-component';
import { BuildingComponentService } from '../building-component/building-component.service';

@Injectable({
  providedIn: 'root'
})
export class BuildingPartService extends BuildingComponentService<Bauteil, CreateBauteilPayload, UpdateBauteilPayload> {

  protected override apiUrl = '/api/parts';

  constructor(protected override http: HttpClient) {
    super(http);
  }
}
