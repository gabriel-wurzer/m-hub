import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { BuildingPart } from '../models/building-part';
import { FileType } from '../enums/file-type.enum';

@Injectable({
  providedIn: 'root'
})
export class BuildingService {

  private apiUrl = 'https://api.example.com/buildings'; 

  // constructor(private http: HttpClient) { }
  constructor(private http: HttpClient) { }

  getDocumentsByBuilding(buildingId: number): Observable<BuildingPart[]> {
    // Simulated API response --> TODO: change with node red request
    const dummyResponse: BuildingPart[] = [
      {
        id: "201",
        name: "Bauplan.pdf",
        description: "Architectural blueprint",
        type: "document",
        ownerId: "owner-003",
        isPublic: true,
        fileUrl: "https://example.com/blueprint.pdf",
        fileType: FileType.PDF
      },
      {
        id: "202",
        name: "Sicherheitsbericht.docx",
        description: "Building safety inspection report",
        type: "document",
        ownerId: "owner-004",
        isPublic: false,
        fileUrl: "https://example.com/inspection.docx",
        fileType: FileType.DOCX
      },
      {
        id: "1409",
        name: "Statikbericht.pdf",
        description: "Building static report",
        type: "document",
        ownerId: "owner-002",
        isPublic: false,
        fileUrl: "https://example.com/static.pdf",
        fileType: FileType.PDF
      }
    ];

    return of(dummyResponse); // Simulating API request using RxJS 'of'
  }
}
