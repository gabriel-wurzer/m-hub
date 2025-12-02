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
import { forkJoin } from 'rxjs';

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

  rootBuilding!: Building;
  selectedEntity: Building | BuildingComponent | null = null;

  isLoading = false;
  
  initialLoadComplete = false;
  treeLoading = false;
  detailsLoading = false;

  errorMessage = '';

  private _loadingUpdateScheduled = false;
  userId = "c3e5b0fc-cc48-4a6f-8e27-135b6d3a1b71";

  constructor(
    private buildingService: BuildingService,
    private partService: BuildingPartService,
    private objectService: BuildingObjectService
  ) {}

  ngOnInit(): void {

    if (!this.entity) return;

    // Building case
    if ('bw_geb_id' in this.entity) {
      this.loadBuilding(this.entity.bw_geb_id);
      return;
    }

    // Component case
    if ('id' in this.entity) {
      const component = this.entity as BuildingComponent;
      const category = component.category as BuildingComponentCategory;
      this.loadBuildingComponent(component.id, category);
    }
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

  loadBuilding(buildingId: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    console.log('Requesting building by id:', buildingId);

    forkJoin({
      baseBuilding: this.buildingService.getBuildingById(buildingId),
      userBuilding: this.buildingService.getUserBuilding(this.userId, buildingId)
    }).subscribe({
      next: (results) => {
        const building: Building = results.baseBuilding;

        const ub = results.userBuilding;

        if (ub && building) {
            building.userBuilding = ub;
        }

        this.rootBuilding = { ...building };
        this.selectedEntity = { ...building };
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = 'Fehler beim Laden der Gebäudedaten.';
        console.error(this.errorMessage, err);

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
            this.selectedEntity = { ...component };
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
          // console.log('Selected building object: ', this.selectedEntity);
        }
      });
    }
  }

  onClose() {
    this.closeStructureView.emit();
  }

  onTreeLoading(loading: boolean) {
    this.treeLoading = loading;
    this.deferGlobalLoadingUpdate();
  }

  onDetailsLoading(loading: boolean) {
    this.detailsLoading = loading;
    this.deferGlobalLoadingUpdate();
  }

  private deferGlobalLoadingUpdate() {
    Promise.resolve().then(() => this.updateGlobalLoadingState());
  }

  updateGlobalLoadingState() {
    this.isLoading = this.treeLoading || this.detailsLoading;

    if (!this.isLoading && !this.initialLoadComplete && !this.treeLoading) {
      // First full load finished
      this.initialLoadComplete = true;
    }
  }

}
