import { Component, Input, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Document } from '../../models/document';
import { Building } from '../../models/building';
import { isBuilding } from '../../utils/model-guard';
import { BuildingComponent } from '../../models/building-component';
import { DocumentService } from '../../services/document/document.service';
import { MatTooltipModule } from '@angular/material/tooltip';


@Component({
  selector: 'app-document-list',
  standalone: true,
  imports: [CommonModule, MatListModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
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

  userId = "c3e5b0fc-cc48-4a6f-8e27-135b6d3a1b71";

  constructor(private documentService: DocumentService) {}

  ngOnInit() {

    if (this.documentsArray) {
      this.documents = this.documentsArray.map(doc => ({
        ...doc,
        fileType: doc.file_type?.toLowerCase()
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

    // Build filter dynamically
    const filters = isBuilding(entity)
      ? { buildingId: entity.bw_geb_id }
      : { componentId: entity.id };

    this.documentService.getDocuments(filters).subscribe({
      next: (docs) => {
        this.documents = docs.map(doc => ({
          ...doc,
          fileType: doc.file_type?.toLowerCase()
        }));
        this.errorMessage = docs.length === 0
          ? isBuilding(entity)
            ? 'No documents found for this building.'
            : 'No documents found for this building component.'
          : '';
      },
      error: (error) => {
        console.error('Error loading documents:', error);
        this.errorMessage = 'An error occurred while loading documents. Please try again.';
      },
      complete: () => {
        this.isLoading = false;
      }
    });  

  }
}
