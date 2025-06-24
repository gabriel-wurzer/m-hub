import { Component, Input, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { iif, of, forkJoin } from 'rxjs';
import { switchMap, catchError, finalize } from 'rxjs/operators';
import { Building } from '../../../models/building';
import { BuildingService } from '../../../services/building/building.service';
import { UserService } from '../../../services/user/user.service';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AddBuildingDialogComponent } from '../../dialogs/add-building-dialog/add-building-dialog/add-building-dialog.component';


@Component({
  selector: 'app-add-building-button',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatProgressSpinnerModule, MatDialogModule],
    templateUrl: './add-building-button.component.html',
    styleUrl: './add-building-button.component.scss'
})
export class AddBuildingButtonComponent implements OnInit {
  @Input() building!: Building;
  @Input() userId!: string;
  @Input() isInitiallyAdded: boolean | null = null;

  isAdded = false;
  isLoading = false;
  errorMessage = '';

  constructor(
    private buildingService: BuildingService,
    private userService: UserService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    if (this.isInitiallyAdded !== null) {
      this.isAdded = this.isInitiallyAdded;
    } else if (this.userId && this.building) {
      this.checkIfBuildingAdded();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['building'] && this.building && this.userId) {
      // this.checkIfBuildingAdded();
      if (this.isInitiallyAdded !== null) {
        this.isAdded = this.isInitiallyAdded;
      } else if (this.userId && this.building) {
        this.checkIfBuildingAdded();
      }
    }
  }

  checkIfBuildingAdded(): void {

    this.isLoading = true;
    this.errorMessage = '';

    this.userService.isBuildingInUser(this.userId, this.building.bw_geb_id).subscribe({
      next: (exists) => {
        this.isAdded = exists;
        this.isLoading = false;
      },
      error: () => {
        this.isAdded = false;
        this.isLoading = false;
      }
    });
  }

//   addBuilding(): void {
//   if (!this.building || this.isAdded || this.isLoading) return;

//   this.isLoading = true;
//   this.errorMessage = '';

//   const dialogRef = this.dialog.open(AddBuildingDialogComponent, {
//     panelClass: 'custom-dialog',
//     data: { structure: this.building.structure }
//   });

//   dialogRef.afterClosed().subscribe(result => {
//     if (!result) {
//       console.log('Hinzufügen des Gebäudes von Benutzer abgebrochen.');
//       this.isLoading = false;
//       return;
//     }

//     this.building.structure = result.structure;
//     if (result.name) this.building.name = result.name;
//     if (result.address) this.building.address = result.address;

//     console.log('User-specific data: ', this.building.name, this.building.address);

//     const structureChanged = result.structureChanged || !this.building.structure;

//     iif(
//       () => structureChanged,
//       // If structure changed: first update building
//       this.buildingService.updateBuilding(this.building).pipe(
//         switchMap(() => this.addBuildingToUserAndData())
//       ),
//       // If structure not changed: directly add building to user and data
//       this.addBuildingToUserAndData()
//     ).pipe(
//       catchError(error => {
//         console.error('Fehler im Prozess:', error);
//         this.errorMessage = 'Fehler beim Hinzufügen des Gebäudes oder beim Aktualisieren der Struktur.';
//         return of(null); // trigger finalize
//       }),
//       finalize(() => {
//         this.isLoading = false;
//       })
//     ).subscribe({
//       next: () => {
//         console.log('Gebäude erfolgreich hinzugefügt.');
//         this.isAdded = true;
//       }
//     });
//   });
// }


// private addBuildingToUserAndData() {
//   const name = this.building.name ?? null;
//   const address = this.building.address ?? null;

//   return this.userService.addBuildingToUser(this.userId, this.building.bw_geb_id).pipe(
//     switchMap(() => this.userService.addUserBuildingData(this.userId, this.building.bw_geb_id, name, address))
//   );
// }

  addBuilding(): void {
    if (!this.building || this.isAdded || this.isLoading) return;

    this.isLoading = true;
    this.errorMessage = '';

    const dialogRef = this.dialog.open(AddBuildingDialogComponent, {
      panelClass: 'custom-dialog',
      data: { structure: this.building.structure }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) {
        console.log('Hinzufügen des Gebäudes von Benutzer abgebrochen.');
        this.isLoading = false;
        return;
      }

      // Update local building data
      this.building.structure = result.structure;
      if (result.name) this.building.name = result.name;
      if (result.address) this.building.address = result.address;

      const structureChanged = result.structureChanged || !this.building.structure;

      const updateStructure$ = structureChanged
        ? this.buildingService.updateBuilding(this.building)
        : of(null); // Skip if no update needed

      const addBuildingToUser$ = this.userService.addBuildingToUser(this.userId, this.building.bw_geb_id);
      const addUserBuildingData$ = this.userService.addUserBuildingData(
        this.userId,
        this.building.bw_geb_id,
        this.building.name ?? null,
        this.building.address ?? null
      );

      forkJoin({
        structureUpdate: updateStructure$,
        addBuilding: addBuildingToUser$,
        addUserData: addUserBuildingData$
      })
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
        catchError(error => {
          this.errorMessage = 'Fehler beim Hinzufügen des Gebäudes:';
          console.error(this.errorMessage, error);
          return of(null); // Prevent crash
        })
      )
      .subscribe(result => {
        if (result) {
          console.log('Gebäude erfolgreich hinzugefügt.');
          this.isAdded = true;
        }
      });
    });
  }
}
