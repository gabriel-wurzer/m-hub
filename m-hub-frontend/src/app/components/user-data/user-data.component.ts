import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { catchError, finalize, forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { UserService } from '../../services/user/user.service';
import { UserBuilding } from '../../models/building';
import { BuildingService } from '../../services/building/building.service';
import { EditBuildingDialogComponent } from '../dialogs/edit-building-dialog/edit-building-dialog.component';
import { AuthenticationService } from '../../services/authentication/authentication.service';
import { EntityContext } from '../../models/entity-context';
import { StructureViewComponent } from '../structure-view/structure-view.component';


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
    StructureViewComponent
  ],
  templateUrl: './user-data.component.html',
  styleUrl: './user-data.component.scss'
})
export class UserDataComponent implements OnInit {

  userBuildings: UserBuilding[] = [];
  selectedBuilding: UserBuilding | null = null;

  isStructureViewVisible = false;
  structureContext: EntityContext | null = null;

  isLoading = false;
  isLoadingBuilding = false;
  errorMessage = '';

  isLoggedIn$: Observable<boolean>;

  constructor(
    private authService: AuthenticationService,
    private buildingService: BuildingService, 
    private userService: UserService,
    private dialog: MatDialog
  ) {    
    this.isLoggedIn$ = this.authService.getUser$().pipe(
      map(user => !!user)
    );
  }

  ngOnInit(): void {
    if(!this.isLoggedIn$) return;

    this.loadBuildings();
  }

  private loadBuildings(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.userService.getUserBuildingsList().subscribe({
      next: (data) => {
        this.userBuildings = data || []; 
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Failed to load user buildings:', error);
        this.errorMessage = 'Gebäudeliste konnten nicht geladen werden.';
        this.isLoading = false;
      }
    });
  }

  
  isSelected(building: UserBuilding): boolean {
    if (!building || !this.selectedBuilding) return false;
    return this.selectedBuilding.id === building.id;
  }

  deselectBuilding(): void {
    if (this.selectBuilding !== null) {
      console.log(`Building with ID ${this.selectedBuilding?.id} deselected`);
    }
    this.selectedBuilding = null;
  }

  selectBuilding(building: UserBuilding): void {
    if (!building) return;
    this.selectedBuilding = building;
  }

  deleteBuilding(building: UserBuilding): void {
    if (!confirm(`Gebäude ${building.name} (ID: ${building.building_id}) wirklich entfernen?`)) return;

    this.isLoading = true;

    this.userService.deleteUserBuilding(building.id)
    .pipe(finalize(() => this.isLoading = false))
    .subscribe({
      next: () => {
        this.userBuildings = this.userBuildings.filter(b => b.id !== building.id);

        if (this.selectedBuilding?.id === building.id) {
          this.selectedBuilding = null;
        }
      },
      error: (error) => {
        console.error('Failed to delete building:', error);
        this.errorMessage = 'Gebäude konnte nicht entfernt werden.';
      }
    });
  }

  editBuilding(building: UserBuilding): void {
    if (!building) return;

    const dialogRef = this.dialog.open(EditBuildingDialogComponent, {
      panelClass: 'custom-dialog',
      data: { userBuilding: building }
    });

    console.log('Opening edit dialog for building:', building);

    dialogRef.afterClosed().subscribe(result => {
      if (!result) {
        this.isLoading = false;
        return;
      }

      this.isLoading = true;

      const payload = {
        name: result.name,
        address: result.address,
        structure: result.structure
      };

      this.userService.updateUserBuilding(
        building.id, 
        payload
      )
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: updated => {
          console.log('User building updated:', updated);

          this.selectedBuilding = updated;
          
          // Update local list to reflect changes immediately
          const index = this.userBuildings.findIndex(b => b.id === updated.id);
          if (index !== -1) {
            this.userBuildings[index] = updated;
          }

          // // If the currently selected building was edited, update that reference too
          // if (this.selectedBuilding?.id === updated.id) {
          //   this.selectedBuilding = updated;
          // }
        },
        error: err => {
          console.error('Error updating user building:', err);
          this.errorMessage = 'Fehler beim Aktualisieren des Gebäudes.';
        }
      });
    });
  }

  showBuildingInfo(building: UserBuilding): void {

    const context: EntityContext = {
      id: building.building_id, // Use the external Building ID
      type: 'building'
    };
    
    this.showStructureView(context);
  }

  showStructureView(context: EntityContext): void {
    this.structureContext = context;
    this.isStructureViewVisible = true;
  }
  
  hideStructureView(): void {
    this.isStructureViewVisible = false;
    this.structureContext = null;
  }


  // updateBuilding(building: UserBuilding): void {
  //   if (!building || !this.selectedBuilding) return;

    // this.isLoading = true;

    // const dialogRef = this.dialog.open(EditBuildingDialogComponent, {
    //   panelClass: 'custom-dialog',
    //   data: { name:building.userBuilding?.name, address: building.userBuilding?.address, buildingComponents: building.userBuilding?.building_components, documents: building.userBuilding?.documents }
    // });

    // dialogRef.afterClosed().subscribe(result => {
    //   if (!result || !this.selectedBuilding) {
    //     console.log('Bearbeiten des Gebäudes von Benutzer abgebrochen.');
    //     this.isLoading = false;
    //     return;
    //   }

    //   const updateUserBuildingData$ = this.userService.updateUserBuildingData(
    //     this.userId,
    //     this.selectedBuilding.bw_geb_id,
    //     result.name ?? this.selectedBuilding.userBuilding?.name,
    //     result.address ?? this.selectedBuilding.userBuilding?.address
    //   );

    //   //TODO: ensure that result contains the full userBuilding entity to seht the user field
    //   this.selectedBuilding.userBuilding = result.userBuilding;
       
    //   let requestBuilding = this.selectedBuilding;

    //   //TODO: Change the requestbuuilding.user to selectedBuilding.user
    //   if(requestBuilding.userBuilding) {
    //     requestBuilding.userBuilding.building_components = result.buildingComponents;
    //     requestBuilding.userBuilding.documents = result.documents;
    //   }


    //   const updateBuilding$ = this.buildingService.updateBuilding(requestBuilding);

    //   forkJoin({
    //     userDataUpdate: updateUserBuildingData$,
    //     buildingUpdate: updateBuilding$,
    //   })
    //   .pipe(
    //     finalize(() => {
    //       this.isLoading = false;
    //     }),
    //     catchError(error => {
    //       this.errorMessage = 'Fehler beim Aktualisieren des Gebäudes:';
    //       console.error(this.errorMessage, error);
    //       return of(null);
    //     })
    //   )
    //   .subscribe(response => {
    //     if (response) {
    //       console.log('Gebäude erfolgreich aktualisiert.');

    //       // Optionally update local building data
    //       if (this.selectedBuilding) {
    //         if (this.selectedBuilding.userBuilding) { 
    //           this.selectedBuilding.userBuilding.name = result.name;
    //           this.selectedBuilding.userBuilding.address = result.address;
    //           this.selectedBuilding.userBuilding.building_components = result.buildingComponents;
    //           this.selectedBuilding.userBuilding.documents = result.documents;            
    //         }
    //       }
    //     }
    //   });
    // });
  // }


}
