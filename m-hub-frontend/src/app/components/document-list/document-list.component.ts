import { Component, Input, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Document } from '../../models/document';
import { Building } from '../../models/building';
import { BuildingService } from '../../services/building/building.service';
import { isBuilding } from '../../utils/model-guard';
import { BuildingComponent } from '../../models/building-component';
import { BuildingComponentService } from '../../services/component/component.service';


@Component({
  selector: 'app-document-list',
  standalone: true,
  imports: [CommonModule, MatListModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './document-list.component.html',
  styleUrls: ['./document-list.component.scss']
})
export class DocumentListComponent implements OnInit {
  @Input() entity!: Building | BuildingComponent | null;
  @Input() documentsArray!: Document[] | null;
  @Input() skipFetch = false;

  documents: any[] = [];
  isLoading = false;
  errorMessage = '';

  constructor(private buildingService: BuildingService, private buildingComponentService: BuildingComponentService) {}

  ngOnInit() {

    if (this.documentsArray) {
      this.documents = this.documentsArray.map(doc => ({
        ...doc,
        fileType: doc.fileType?.toLowerCase()
      }));
    }

    if (!this.entity || this.skipFetch) return;
    this.loadDocumentsForEntity(this.entity);
  }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['entity'] || changes['skipFetch']) && this.entity && !this.skipFetch) {
      this.loadDocumentsForEntity(this.entity);
    }
  }

  private loadDocumentsForEntity(entity: Building | BuildingComponent): void {
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

  private loadDocumentsByBuilding(buildingId: string): void {
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
    this.buildingComponentService.getDocumentsByBuildingComponent(componentId).subscribe({
      next: (docs) => {
        this.documents = docs.map(doc => ({
          ...doc,
          fileType: doc.fileType?.toLowerCase()
        }));
        this.errorMessage = docs.length === 0 ? 'No documents found for this building component.' : '';
      },
      error: (error) => {
        console.error('Error loading building component documents:', error);
        this.errorMessage = error.status === 404
          ? 'No documents found for this building component.'
          : 'An error occurred while loading documents.';
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  
  }
}
