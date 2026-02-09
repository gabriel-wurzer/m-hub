import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize, map, Observable } from 'rxjs';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { UserService } from '../../services/user/user.service';
import { UserBuilding } from '../../models/building';
import { EditBuildingViewComponent } from '../edit-building-view/edit-building-view.component';
import { AuthenticationService } from '../../services/authentication/authentication.service';
import { EntityContext } from '../../models/entity-context';
import { StructureViewComponent } from '../structure-view/structure-view.component';
import { ConfirmDialogComponent } from '../dialogs/confirm-dialog/confirm-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';


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
    StructureViewComponent,
    EditBuildingViewComponent
  ],
  templateUrl: './user-data.component.html',
  styleUrl: './user-data.component.scss'
})
export class UserDataComponent implements OnInit {

  userBuildings: UserBuilding[] = [];
  selectedBuilding: UserBuilding | null = null;

  isStructureViewVisible = false;
  structureContext: EntityContext | null = null;
  isEditViewVisible = false;
  editingBuilding: UserBuilding | null = null;

  isLoading = false;
  isLoadingBuilding = false;
  errorMessage = '';

  isLoggedIn$: Observable<boolean>;

  constructor(
    private authService: AuthenticationService,
    private userService: UserService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
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
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '450px',
      data: {
        title: 'Gebäude löschen',
        message: `Möchtest du das Gebäude <strong>${building.name}</strong> (ID: ${building.building_id}) wirklich unwiderruflich löschen? Alle zugehörigen Daten gehen verloren.`,
        confirmText: 'Löschen',
        cancelText: 'Behalten',
        requireSlider: true, 
        sliderText: 'Löschen bestätigen' 
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        this.executeDelete(building);
      }
    });
  }

  private executeDelete(building: UserBuilding): void {
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
        complete: () => {
          this.snackBar.open('Gebäude erfolgreich entfernt.', 'OK', {
            duration: 3000,
            verticalPosition: 'top'
          });
        },
        error: (error) => {
          console.error('Failed to delete building:', error);
          this.errorMessage = 'Gebäude konnte nicht entfernt werden.';
                  this.snackBar.open(this.errorMessage, 'OK', {
            duration: 10000,
            verticalPosition: 'top'
          });
        }
      });
  }

  editBuilding(building: UserBuilding): void {
    if (!building) return;
    this.editingBuilding = building;
    this.isEditViewVisible = true;
    this.isStructureViewVisible = false;
    this.structureContext = null;
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
    this.isEditViewVisible = false;
    this.editingBuilding = null;
  }
  
  hideStructureView(): void {
    this.isStructureViewVisible = false;
    this.structureContext = null;
  }

  hideEditBuildingView(): void {
    this.isEditViewVisible = false;
    this.editingBuilding = null;
  }

  onBuildingUpdated(updated: UserBuilding): void {
    if (!updated) return;

    const merged = this.mergeUpdatedBuilding(updated);

    if (this.selectedBuilding?.id === updated.id) {
      this.selectedBuilding = merged ?? { ...this.selectedBuilding, ...updated };
    }

    if (this.editingBuilding?.id === updated.id) {
      this.editingBuilding = merged ?? { ...this.editingBuilding, ...updated };
    }
  }

  private mergeUpdatedBuilding(updated: UserBuilding): UserBuilding | null {
    const index = this.userBuildings.findIndex(building => building.id === updated.id);
    if (index === -1) return null;

    const merged = { ...this.userBuildings[index], ...updated };
    this.userBuildings[index] = merged;
    return merged;
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
