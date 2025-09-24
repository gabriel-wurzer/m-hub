import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { UserService } from '../../services/user/user.service';
import { Building } from '../../models/building';
import { BuildingSidepanelComponent } from "../building-sidepanel/building-sidepanel.component";
import { BuildingService } from '../../services/building/building.service';
import { StructureViewComponent } from "../structure-view/structure-view.component";
import { EditBuildingDialogComponent } from '../dialogs/edit-building-dialog/edit-building-dialog.component';


@Component({
  selector: 'app-user-data',
  standalone: true,
  imports: [
    CommonModule, 
    MatDividerModule, 
    MatListModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatMenuModule,
    MatDialogModule,
    MatProgressSpinnerModule, 
    BuildingSidepanelComponent, 
    StructureViewComponent
  ],
  templateUrl: './user-data.component.html',
  styleUrl: './user-data.component.scss'
})
export class UserDataComponent implements OnInit {

  userId = "c3e5b0fc-cc48-4a6f-8e27-135b6d3a1b71";
  buildings: Building[] = [];

  selectedBuilding: Building | null = null;

  isStructureViewVisible = false;
  isLoading = false;
  isLoadingBuilding = false;
  errorMessage = '';

  constructor(
    private buildingService: BuildingService, 
    private userService: UserService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    if(!this.userId) return;

    this.loadBuildings();
  }

  // private loadBuildings(): void {
  //   this.isLoading = true;
  //   this.userService.getBuildingsByUser(this.userId).subscribe({
  //     next: (buildingList) => {
  //       this.buildings = buildingList;
  //       this.isLoading = false;
  //     },
  //     error: (error) => {
  //       this.errorMessage = 'Failed to load buildings for user.';
  //       this.isLoading = false;
  //       console.error(error);
  //     }
  //   });
  // }

  private loadBuildings(): void {
    this.isLoading = true;

    this.userService.getBuildingsByUser(this.userId).subscribe({
      next: (buildingList) => {
        this.buildings = buildingList;

        const userBuildingDataRequests = this.buildings.map(building =>
          this.userService.getUserBuildingData(this.userId, building.bw_geb_id)
        );

        forkJoin(userBuildingDataRequests).subscribe({
          next: (userBuildingDataList) => {
            this.buildings = this.buildings.map((building, index) => {
              const userBuildingData = userBuildingDataList[index];
              return {
                ...building,
                name: userBuildingData.name || building.userBuilding?.name,
                address: userBuildingData.address || building.userBuilding?.address,
              };
            });

            this.isLoading = false;
          },
          error: (error) => {
            console.error('Failed to load user-specific building data:', error);
            this.errorMessage = 'Benutzerspezifische Gebäudedaten konnten nicht geladen werden.';
            this.isLoading = false;
          }
        });
      },
      error: (error) => {
        console.error('Failed to load buildings for user:', error);
        this.errorMessage = 'Gebäude konnten nicht geladen werden.';
        this.isLoading = false;
      }
    });
  }

  isSelected(building: Building): boolean {
    if (!building || !this.selectedBuilding) return false;
    return this.selectedBuilding.bw_geb_id === building.bw_geb_id;
  }

  deselectBuilding(): void {
    if (this.selectBuilding !== null) {
      console.log(`Building with ID ${this.selectedBuilding?.bw_geb_id} deselected`);
    }
    this.selectedBuilding = null;
  }

  selectBuilding(building: Building): void {
    if (!building) return;
    this.selectedBuilding = building;
  }

  deleteBuilding(buildingId: string): void {
    if (!confirm(`Gebäude mit ID ${buildingId} wirklich entfernen?`)) return;

    this.userService.removeBuildingFromUser(this.userId, buildingId).subscribe({
      next: () => {
        this.buildings = this.buildings.filter(b => b.bw_geb_id !== buildingId);
        if (this.selectedBuilding?.bw_geb_id === buildingId) {
          this.selectedBuilding = null;
        }
      },
      error: (error) => {
        console.error('Failed to delete building:', error);
        this.errorMessage = 'Gebäude konnte nicht entfernt werden.';
      }
    });
  }

  updateBuilding(building: Building): void {
    if (!building || !this.selectedBuilding) return;

    this.isLoading = true;

    const dialogRef = this.dialog.open(EditBuildingDialogComponent, {
      panelClass: 'custom-dialog',
      data: { name:building.userBuilding?.name, address: building.userBuilding?.address, buildingComponents: building.userBuilding?.buildingComponents, documents: building.userBuilding?.documents }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result || !this.selectedBuilding) {
        console.log('Bearbeiten des Gebäudes von Benutzer abgebrochen.');
        this.isLoading = false;
        return;
      }

      const updateUserBuildingData$ = this.userService.updateUserBuildingData(
        this.userId,
        this.selectedBuilding.bw_geb_id,
        result.name ?? this.selectedBuilding.userBuilding?.name,
        result.address ?? this.selectedBuilding.userBuilding?.address
      );

      //TODO: ensure that result contains the full userBuilding entity to seht the user field
      this.selectedBuilding.userBuilding = result.userBuilding;
       
      let requestBuilding = this.selectedBuilding;

      //TODO: Change the requestbuuilding.user to selectedBuilding.user
      if(requestBuilding.userBuilding) {
        requestBuilding.userBuilding.buildingComponents = result.buildingComponents;
        requestBuilding.userBuilding.documents = result.documents;
      }


      const updateBuilding$ = this.buildingService.updateBuilding(requestBuilding);

      forkJoin({
        userDataUpdate: updateUserBuildingData$,
        buildingUpdate: updateBuilding$,
      })
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
        catchError(error => {
          this.errorMessage = 'Fehler beim Aktualisieren des Gebäudes:';
          console.error(this.errorMessage, error);
          return of(null);
        })
      )
      .subscribe(response => {
        if (response) {
          console.log('Gebäude erfolgreich aktualisiert.');

          // Optionally update local building data
          if (this.selectedBuilding) {
            if (this.selectedBuilding.userBuilding) { 
              this.selectedBuilding.userBuilding.name = result.name;
              this.selectedBuilding.userBuilding.address = result.address;
              this.selectedBuilding.userBuilding.buildingComponents = result.buildingComponents;
              this.selectedBuilding.userBuilding.documents = result.documents;            
            }
          }
        }
      });
    });
  }

      // const updatedBuilding: Building = {
      //   ...building,
      //   name: result.name,
      //   address: result.address,
      //   buildingComponents: result.buildingComponents,
      //   documents: result.documents,
      // };


      // console.log('Bearbeitetes Gebäude:', updatedBuilding);

      //TODO: Update local building data and user-specific data

      // TODO: brauche indices in buildings array um local zu verändern!
      
      // this.building.structure = result.structure;
      // if (result.name) this.building.name = result.name;
      // if (result.address) this.building.address = result.address;

  //   });
  // }

  showStructureView(): void {
    this.isStructureViewVisible = true;
  }
  
  hideStructureView(): void {
    this.isStructureViewVisible = false;
  }

}
