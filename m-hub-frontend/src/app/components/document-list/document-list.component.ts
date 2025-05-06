import { Component, Input, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Building } from '../../models/building';
import { BuildingPart } from '../../models/building-part';
import { BuildingService } from '../../services/building/building.service';
import { isBuilding } from '../../utils/model-guard';
import { BuildingPartService } from '../../services/building-part/building-part.service';


@Component({
  selector: 'app-document-list',
  standalone: true,
  imports: [CommonModule, MatListModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './document-list.component.html',
  styleUrls: ['./document-list.component.scss']
})
export class DocumentListComponent implements OnInit {
  @Input() entity!: Building | BuildingPart | null;

  documents: any[] = [];
  isLoading = false;
  errorMessage = '';

  constructor(private buildingService: BuildingService, private buildingPartService: BuildingPartService) {}

  ngOnInit() {
    if (!this.entity) return;
    this.loadDocumentsForEntity(this.entity);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['entity'] && this.entity) {
      this.loadDocumentsForEntity(this.entity);
    }
  }

  private loadDocumentsForEntity(entity: Building | BuildingPart): void {
    if (this.isLoading) return;
    this.isLoading = true;
    this.errorMessage = '';
    this.documents = [];

    if(isBuilding(entity)) {
      this.loadDocumentsByBuilding(entity.bw_geb_id);
    }
    else {
      this.loadDocumentsByComponent(entity.id);
    }
  }

  private loadDocumentsByBuilding(buildingId: number): void {
    this.buildingService.getDocumentsByBuilding(buildingId).subscribe({
      next: (docs) => {
        this.documents = docs.map(doc => ({
          ...doc,
          fileType: doc.fileType?.toLowerCase()
        }));
        this.errorMessage = docs.length === 0 ? 'No documents found for this building.' : '';
      },
      error: (error) => {
        console.error('Error loading building documents:', error);
        this.errorMessage = error.status === 404
          ? 'No documents found for this building.'
          : 'An error occurred while loading documents.';
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  private loadDocumentsByComponent(componentId: string): void {
    this.buildingPartService.getDocumentsByBuildingPart(componentId).subscribe({
      next: (docs) => {
        this.documents = docs.map(doc => ({
          ...doc,
          fileType: doc.fileType?.toLowerCase()
        }));
        this.errorMessage = docs.length === 0 ? 'No documents found for this building part.' : '';
      },
      error: (error) => {
        console.error('Error loading building part documents:', error);
        this.errorMessage = error.status === 404
          ? 'No documents found for this building part.'
          : 'An error occurred while loading documents.';
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  
  }
}
