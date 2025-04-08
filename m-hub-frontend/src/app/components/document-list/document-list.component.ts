import { Component, Input, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Building } from '../../models/building';
import { BuildingPart } from '../../models/building-part';
import { BuildingService } from '../../services/building/building.service';


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

  constructor(private buildingService: BuildingService) {}

  ngOnInit() {
    if (!this.entity) return;

    const buildingId = 'bw_geb_id' in this.entity ? this.entity.bw_geb_id : parseInt(this.entity.buildingId);
    this.loadDocuments(buildingId);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['entity'] && this.entity) {

      const buildingId = 'bw_geb_id' in this.entity ? this.entity.bw_geb_id : parseInt(this.entity.buildingId);
      this.loadDocuments(buildingId);
    }
  }

  private loadDocuments(buildingId: number) {
    if (this.isLoading) return;
    this.isLoading = true;

    console.log('Requesting documents for building:', buildingId);

    this.buildingService.getDocumentsByBuilding(buildingId).subscribe({
      next: (docs) => {
        this.documents = docs.map(doc => ({
          ...doc,
          fileType: doc.fileType ? doc.fileType.toLowerCase() : undefined
        }));

        this.errorMessage = docs.length === 0 ? 'No documents found for this building.' : '';
      },
      error: (error) => {
        console.error('Error loading documents:', error);

        this.errorMessage = error.status === 404 ? 'No documents found for this building.' : 'An error occurred while loading documents. Please try again later.';

        this.documents = [];
        this.isLoading = false;
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }
}
