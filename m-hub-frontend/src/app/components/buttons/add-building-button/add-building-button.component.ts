import { Component, Input, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { of, forkJoin } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { Building } from '../../../models/building';
import { BuildingService } from '../../../services/building/building.service';
import { UserService } from '../../../services/user/user.service';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AddBuildingDialogComponent } from '../../dialogs/add-building-dialog/add-building-dialog.component';


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

  addBuilding(): void {
    if (!this.building || this.isAdded || this.isLoading) return;

    this.isLoading = true;
    this.errorMessage = '';

    const dialogRef = this.dialog.open(AddBuildingDialogComponent, {
      panelClass: 'custom-dialog',
      data: { structure: this.building.userBuilding?.structure }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) {
        console.log('Hinzufügen des Gebäudes von Benutzer abgebrochen.');
        this.isLoading = false;
        return;
      }

      const structureChanged = result.structureChanged || !this.building.userBuilding?.structure;

      // const updateStructure$ = structureChanged
      //   ? this.buildingService.updateBuilding({ ...this.building, structure: result.structure })
      //   : of(null); // Skip if no update needed

      const updateStructure$ = structureChanged
        ? this.buildingService.updateBuilding(Object.assign({}, this.building, { structure: result.structure } as any))
        : of(null); // Skip if no update needed


      const addBuildingToUser$ = this.userService.addBuildingToUser(this.userId, this.building.bw_geb_id);
      const addUserBuildingData$ = this.userService.addUserBuildingData(
        this.userId,
        this.building.bw_geb_id,
        result.name ?? this.building.userBuilding?.name ?? null,
        result.address ?? this.building.userBuilding?.address ?? null
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
          return of(null);
        })
      )
      .subscribe(response => {
        if (response) {
          console.log('Gebäude erfolgreich hinzugefügt.');
          this.isAdded = true;
          
          // Update local building data

          // TODO: change RESPONSE of ADD BUILDING to userBuilding entity!
          // this.building.user = response;
          
          // temp fix to ensure user exists to set the fields of local building.
          if (this.building.userBuilding) { 
            this.building.userBuilding.structure = result.structure;
            if (result.name) this.building.userBuilding.name = result.name;
            if (result.address) this.building.userBuilding.address = result.address;
          }
        }
      });
    });
  }

}
