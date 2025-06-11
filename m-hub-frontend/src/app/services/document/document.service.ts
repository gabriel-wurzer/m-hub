import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BuildingComponent } from '../../models/building-component';
import { Document } from '../../models/document';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {

  private apiUrl = 'http://localhost:1880/api/document'; // Node-RED endpoint (development)

  constructor(private http: HttpClient) { }

  // create document

  // delete document

  // update document

}
