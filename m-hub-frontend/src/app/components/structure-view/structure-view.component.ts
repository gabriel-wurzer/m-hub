import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
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
import { forkJoin, of, skip, Subscription } from 'rxjs';
import { UserService } from '../../services/user/user.service';
import { AuthenticationService } from '../../services/authentication/authentication.service';
import { EntityContext } from '../../models/entity-context';

@Component({
  selector: 'app-structure-view',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDividerModule, MatExpansionModule, MatProgressSpinnerModule, MatListModule, StructureTreeComponent, StructureDetailsComponent],
  templateUrl: './structure-view.component.html',
  styleUrl: './structure-view.component.scss'
})
export class StructureViewComponent implements OnInit, OnDestroy{

  @Input() entityContext!: EntityContext | null;
  @Output() closeStructureView = new EventEmitter<void>();

  rootBuilding!: Building;
  selectedEntity: Building | BuildingComponent | null = null;

  isLoading = false;
  
  initialLoadComplete = false;
  treeLoading = false;
  detailsLoading = false;

  errorMessage = '';

  private authSubscription: Subscription | undefined;

  constructor(
    private authService: AuthenticationService,
    private buildingService: BuildingService,
    private userService: UserService,
    private partService: BuildingPartService,
    private objectService: BuildingObjectService
  ) {}

  ngOnInit(): void {

    if (!this.entityContext) return;

    this.handleInitialLoad();

    this.authSubscription = this.authService.getUser$()
    .pipe(skip(1))
    .subscribe(() => {
      if (this.entityContext?.type === 'building') {
        console.log('[Structure View] Auth changed. Reloading building...');
        this.loadBuilding(this.entityContext.id);
      }
      else if (this.rootBuilding && this.rootBuilding.bw_geb_id) {
         console.log('[Structure View] Auth state changed. Reloading building...');
         this.loadBuilding(this.rootBuilding.bw_geb_id);
      }
    });

  }
  
  private handleInitialLoad() {
    if (!this.entityContext) return;

    if (this.entityContext.type === 'building') {
      this.loadBuilding(this.entityContext.id);
    } 
    else if (this.entityContext.type === 'component') {
      if (this.entityContext.category) {
        this.loadBuildingComponent(this.entityContext.id, this.entityContext.category);
      } else {
        console.error("Context type is component but category is missing");
      }
    }
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
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

    const userBuildingRequest$ = this.authService.isLoggedIn() 
        ? this.userService.getUserBuilding(buildingId) 
        : of(null);

    forkJoin({
      baseBuilding: this.buildingService.getBuildingById(buildingId),
      userBuilding: userBuildingRequest$
    }).subscribe({
      next: (results) => {

        const mergedBuilding: Building = {
          ...results.baseBuilding,        // clone base building (all FID, geom, etc.)
          userBuilding: results.userBuilding ?? undefined
        };

        this.rootBuilding = mergedBuilding
        this.selectedEntity = mergedBuilding;
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = 'Fehler beim Laden der Gebäudedaten.';
        console.error(this.errorMessage, err);

        this.isLoading = false;
      },
      complete: () => {
        this.isLoading = false;
        // console.log('Selected entity: ', this.selectedEntity);
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
