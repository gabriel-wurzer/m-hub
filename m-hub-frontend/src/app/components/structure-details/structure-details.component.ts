import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';

import { BuildingPart } from '../../models/building-part';
import { Building } from '../../models/building';
import { FileType } from '../../enums/file-type.enum';
import { Period, PeriodLabels } from '../../enums/period.enum';
import { Usage, UsageLabels } from '../../enums/usage.enum';
import { StructureTreeComponent } from "../structure-tree/structure-tree.component";
import { BuildingService } from '../../services/building/building.service';


@Component({
  selector: 'app-structure-details',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDividerModule, MatExpansionModule, MatProgressSpinnerModule, MatListModule, StructureTreeComponent],
  templateUrl: './structure-details.component.html',
  styleUrl: './structure-details.component.scss'
})
export class StructureDetailsComponent implements OnInit {

  @Input() entity!: Building | BuildingPart | null;
  @Output() closeDetails = new EventEmitter<void>();

  errorMessage = '';

  // check on init if entity is building or building part
  isBuilding = false;
  building?: Building;
  buildingPart?: BuildingPart;

  periodOptions = Object.values(Period).filter(value => typeof value === 'number') as number[];
  periodLabels = PeriodLabels;

  usageOptions = Object.values(Usage).filter(value => typeof value === 'number') as number[];
  usageLabels = UsageLabels;

  // buildingParts: BuildingPart[] = [];
  documents: BuildingPart[] = [];
  
  isLoading = false;

  constructor(private buildingService: BuildingService) { }

  ngOnInit() {
    if (!this.entity) return;

    if ('bw_geb_id' in this.entity) {
      this.isBuilding = true;
      this.building = this.entity as Building;
      this.#loadDocuments(this.entity.bw_geb_id);
      // this.#loadBuildingParts(this.entity.bw_geb_id);

    } else {
      this.isBuilding = false;
      this.buildingPart = this.entity as BuildingPart;
      this.#loadDocuments(parseInt(this.entity.buildingId));
      // this.#loadBuildingParts(parseInt(this.entity.buildingId));
    }
    
  }

  get periodLabel(): string {
    if (this.building && this.building.bp) {
      const bpValues = this.building.bp.split(',').map(val => val.trim());
      const labels = bpValues.map(bpStr => {
        const bpValue = Number(bpStr);
        return (!isNaN(bpValue) && this.periodLabels[bpValue]) ? this.periodLabels[bpValue] : 'Bauperiode unbekannt';
      });
      return labels.join(', ');
    }
    return 'Bauperiode unbekannt';
  }
  
  get usageLabel(): string {
    if (this.building && this.building.dom_nutzung != null) {
      return this.usageLabels[this.building.dom_nutzung] || 'Nutzung unbekannt';
    }
    return 'Nutzung unbekannt';
  }

  // #loadBuildingParts(buildingId: number) {
  //   if (this.isLoading) return;
  //   this.isLoading = true;
  
  //   console.log('Requesting building parts for building:', buildingId);
  
  //   this.buildingService.getBuildingPartsByBuilding(buildingId).subscribe({
  //     next: (parts) => {
  //       this.buildingParts = parts;
  //       this.errorMessage = parts.length === 0 ? 'No building parts found for this building.' : '';
  //     },
  //     error: (error) => {
  //       console.error('Error loading building parts:', error);
  
  //       if (error.status === 404) {
  //         this.errorMessage = 'No building parts found for this building.';
  //       } else {
  //         this.errorMessage = 'An error occurred while loading building parts. Please try again later.';
  //       }
  
  //       this.buildingParts = [];
  //       this.isLoading = false;
  //     },
  //     complete: () => {
  //       this.isLoading = false;
  //     }
  //   });
  // }
  

  #loadDocuments(buildingId: number) {
    if (this.isLoading) return;
    this.isLoading = true;

    console.log('Requesting documents for building:', buildingId);

    this.buildingService.getDocumentsByBuilding(buildingId).subscribe({
      next: (docs) => {
        this.documents = docs.map(doc => ({
          ...doc,
          fileType: doc.fileType ? doc.fileType.toLowerCase() as FileType : undefined
        }));

        this.errorMessage = docs.length === 0 ? 'No documents found for this building.' : '';
      },
      error: (error) => {
        console.error('Error loading documents:', error);

        if (error.status === 404) {
          this.errorMessage = 'No documents found for this building.';
        } else {
          this.errorMessage = 'An error occurred while loading documents. Please try again later.';
        }

        this.documents = [];
        this.isLoading = false;
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  onClose() {
    this.closeDetails.emit();
  }

}
