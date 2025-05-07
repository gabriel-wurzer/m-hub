import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { UserService } from '../../services/user/user.service';
import { Building } from '../../models/building';
import { BuildingSidepanelComponent } from "../building-sidepanel/building-sidepanel.component";
import { BuildingService } from '../../services/building/building.service';
import { StructureViewComponent } from "../structure-view/structure-view.component";


@Component({
  selector: 'app-user-data',
  standalone: true,
  imports: [CommonModule, MatDividerModule, MatListModule, MatProgressSpinnerModule, BuildingSidepanelComponent, StructureViewComponent],
  templateUrl: './user-data.component.html',
  styleUrl: './user-data.component.scss'
})
export class UserDataComponent implements OnInit {

  userId = "c3e5b0fc-cc48-4a6f-8e27-135b6d3a1b71";
  buildings: number[] = [];

  selectedBuilding: Building | null = null;

  isStructureViewVisible = false;
  isLoading = false;
  isLoadingBuilding = false;
  errorMessage = '';

  constructor(private buildingService: BuildingService, private userService: UserService) {}

  ngOnInit(): void {
    if(!this.userId) return;

    this.loadBuildings();
  }

  private loadBuildings(): void {
    this.isLoading = true;
    this.userService.getBuildingsByUser(this.userId).subscribe({
      next: (ids) => {
        this.buildings = ids;
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = 'Failed to load buildings.';
        this.isLoading = false;
        console.error(error);
      }
    });
  }

  isSelected(buildingId: number): boolean {
    return this.selectedBuilding?.bw_geb_id === buildingId;
  }

  deselectBuilding(): void {
    if (this.selectBuilding !== null) {
      console.log(`Building with ID ${this.selectedBuilding?.bw_geb_id} deselected`);
    }
    this.selectedBuilding = null;
  }

  selectBuilding(buildingId: number): void {

    if(!buildingId || buildingId===undefined) return;

    this.#loadBuilding(buildingId);
    
    // this.selectedBuildingId = buildingId;
    // You could also emit an event here or call a sidepanel, etc.
  }

  #loadBuilding(buildingId: number) {
    if (this.isLoadingBuilding) return;
    this.isLoadingBuilding = true;

    console.log('Requesting building by id:', buildingId);

    this.buildingService.getBuildingById(buildingId).subscribe({
      next: (building) => {
        if(building && building.bw_geb_id !== undefined) {
          this.selectedBuilding = building;
        }
      },
      error: (error) => {
        console.error('Error loading building:', error);

        this.errorMessage = error.status === 404 ? 'No building found for this buildingId.' : 'An error occurred while loading building. Please try again later.';

        this.selectedBuilding = null;
        this.isLoadingBuilding = false;
      },
      complete: () => {
        this.isLoadingBuilding = false;
        console.log('Selected building: ', this.selectBuilding);
      }
    });
  }



  showStructureView(): void {
    this.isStructureViewVisible = true;
  }
  
  hideStructureView(): void {
    this.isStructureViewVisible = false;
  }

}
