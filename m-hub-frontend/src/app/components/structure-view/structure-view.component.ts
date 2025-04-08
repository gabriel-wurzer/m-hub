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
import { StructureTreeComponent } from "../structure-tree/structure-tree.component";
import { StructureDetailsComponent } from "../structure-details/structure-details.component";
import { BuildingService } from '../../services/building/building.service';
import { BuildingPartService } from '../../services/building-part/building-part.service';

@Component({
  selector: 'app-structure-view',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDividerModule, MatExpansionModule, MatProgressSpinnerModule, MatListModule, StructureTreeComponent, StructureDetailsComponent],
  templateUrl: './structure-view.component.html',
  styleUrl: './structure-view.component.scss'
})
export class StructureViewComponent implements OnInit{

  @Input() entity!: Building | BuildingPart | null;
  @Output() closeStructureView = new EventEmitter<void>();

  selectedEntity: Building | BuildingPart | null = null;

  isLoading = false;

  errorMessage = '';

  constructor(
    private buildingService: BuildingService, 
    private buildingPartService: BuildingPartService,
  ) {}

  ngOnInit(): void {
    this.selectedEntity = this.entity;
  }
  
  onNodeSelected(node: any) {
    if (!node) return;
    
    node.type === 'building'
      ? this.loadBuilding(node.id)
      : this.loadBuildingPart(node.id);
  }

  private loadBuilding(buildingId: string) {
    if (this.isLoading) return;
    this.isLoading = true;

    const id = parseInt(buildingId);

    console.log('Requesting building by id:', id);

    this.buildingService.getBuildingById(id).subscribe({
      next: (building) => {
        if(building && building.bw_geb_id !== undefined) {
          this.selectedEntity = building;
        }
      },
      error: (error) => {
        console.error('Error loading building:', error);

        this.errorMessage = error.status === 404 ? 'No building found for this buildingId.' : 'An error occurred while loading building. Please try again later.';

        this.selectedEntity = null;
        this.isLoading = false;
      },
      complete: () => {
        this.isLoading = false;
        console.log('Selected entity: ', this.selectedEntity);
      }
    });
  }

  private loadBuildingPart(buildingPartId: string) { 
    if (this.isLoading) return;
    this.isLoading = true;

    console.log('Requesting building-part by id:', buildingPartId);

    this.buildingPartService.getBuildingPartById(buildingPartId).subscribe({
      next: (buildingPart) => {
        if(buildingPart && buildingPart.id !== undefined) {
          this.selectedEntity = buildingPart;
        }
      },
      error: (error) => {
        console.error('Error loading building-part:', error);

        this.errorMessage = error.status === 404 ? 'No building-part found for this buildingPartId.' : 'An error occurred while loading building-part. Please try again later.';

        this.selectedEntity = null;
        this.isLoading = false;
      },
      complete: () => {
        this.isLoading = false;
        console.log('Selected entity: ', this.selectedEntity);

      }
    });
  }


  onClose() {
    this.closeStructureView.emit();
  }

}
