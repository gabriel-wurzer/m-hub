import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';

import { Building } from '../../models/building';
import { StructureTreeComponent } from "../structure-tree/structure-tree.component";
import { StructureDetailsComponent } from "../structure-details/structure-details.component";
import { BuildingService } from '../../services/building/building.service';
import { BuildingComponent } from '../../models/building-component';
import { BuildingPartService } from '../../services/building-part/building-part.service';
import { BuildingObjectService } from '../../services/building-object/building-object.service';
import { BuildingComponentCategory } from '../../enums/component-category';

@Component({
  selector: 'app-structure-view',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDividerModule, MatExpansionModule, MatProgressSpinnerModule, MatListModule, StructureTreeComponent, StructureDetailsComponent],
  templateUrl: './structure-view.component.html',
  styleUrl: './structure-view.component.scss'
})
export class StructureViewComponent implements OnInit{

  @Input() entity!: Building | BuildingComponent | null;
  @Output() closeStructureView = new EventEmitter<void>();

  selectedEntity: Building | BuildingComponent | null = null;

  isLoading = false;

  errorMessage = '';

  constructor(
    private buildingService: BuildingService,
    private partService: BuildingPartService,
    private objectService: BuildingObjectService
  ) {}

  ngOnInit(): void {
    this.selectedEntity = this.entity;
  }
  
  onNodeSelected(node: any) {
    if (!node) return;

    const isSameEntity =
    (node.nodeType === 'building' && this.selectedEntity && 'bw_geb_id' in this.selectedEntity && node.id == this.selectedEntity.bw_geb_id) ||
    (node.nodeType === 'component' && this.selectedEntity && 'id' in this.selectedEntity && node.id === this.selectedEntity.id);

  if (isSameEntity) return;
    
    node.nodeType === 'building'
      ? this.loadBuilding(node.id)
      : this.loadBuildingComponent(node.id, node.category as BuildingComponentCategory); // node.category: 'Bauteil' | 'Objekt'
  }

  private loadBuilding(buildingId: string) {
    if (this.isLoading) return;
    this.isLoading = true;

    const id = buildingId;

    console.log('Requesting building by id:', id);

    this.buildingService.getBuildingById(id).subscribe({
      next: (building) => {
        if(building && building.bw_geb_id !== undefined) {
          this.selectedEntity = building;
        }
      },
      error: (error) => {
        console.error('Error loading building:', error);

        this.errorMessage = error.status === 404 ? 'No building found for this ID.' : 'An error occurred while loading building. Please try again later.';

        this.selectedEntity = null;
        this.isLoading = false;
      },
      complete: () => {
        this.isLoading = false;
        console.log('Selected entity: ', this.selectedEntity);
      }
    });
  }

  private loadBuildingComponent(componentId: string, category: BuildingComponentCategory) {
    if (this.isLoading) return;
    this.isLoading = true;

    console.log(`Requesting building component [${category}] by id:`, componentId);

    if (category === BuildingComponentCategory.Bauteil) {
      this.partService.getComponentById(componentId).subscribe({
        next: (component) => {
          if (component && component.id !== undefined) {
            this.selectedEntity = component;
          }
        },
        error: (error) => {
          console.error(`Error loading building part:`, error);
          this.errorMessage =
            error.status === 404
              ? 'No building part found for this ID.'
              : 'An error occurred while loading the building part.';
          this.selectedEntity = null;
          this.isLoading = false;
        },
        complete: () => {
          this.isLoading = false;
          console.log('Selected building part: ', this.selectedEntity);
        }
      });
    } else {
      // Explicitly typed as BuildingObjectService
      this.objectService.getComponentById(componentId).subscribe({
        next: (component) => {
          if (component && component.id !== undefined) {
            this.selectedEntity = component;
          }
        },
        error: (error) => {
          console.error(`Error loading building object:`, error);
          this.errorMessage =
            error.status === 404
              ? 'No building object found for this ID.'
              : 'An error occurred while loading the building object.';
          this.selectedEntity = null;
          this.isLoading = false;
        },
        complete: () => {
          this.isLoading = false;
          console.log('Selected building object: ', this.selectedEntity);
        }
      });
    }
  }

  onClose() {
    this.closeStructureView.emit();
  }

}
