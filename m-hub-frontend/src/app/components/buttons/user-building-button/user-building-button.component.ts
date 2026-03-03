import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { Building, UserBuilding } from '../../../models/building';
import { Floor } from '../../../models/floor';
import { UserService } from '../../../services/user/user.service';
import { BuildingService } from '../../../services/building/building.service';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AddBuildingDialogComponent } from '../../dialogs/add-building-dialog/add-building-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'user-building-button',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatProgressSpinnerModule, MatDialogModule],
    templateUrl: './user-building-button.component.html',
    styleUrl: './user-building-button.component.scss'
})
export class UserBuildingButtonComponent implements OnInit {

  @Input() building!: Building;
  @Input() isInitiallyAdded: boolean | null = null;
  @Output() editRequested = new EventEmitter<UserBuilding>();

  isAdded = false;
  isLoading = false;
  errorMessage = '';

  constructor(
    private userService: UserService,
    private buildingService: BuildingService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    if (this.isInitiallyAdded !== null) {
      this.isAdded = this.isInitiallyAdded;
    } 
  }

  onButtonClick() {
    if (this.isAdded) {
      this.requestEditView();
    } else {
      this.addBuilding();
    }
  }

  addBuilding(): void {
    if (!this.building || this.isLoading) return;

    this.isLoading = true;

    this.buildingService.getLatestBuildingStructure(this.building.bw_geb_id)
      .pipe(
        catchError(err => {
          console.error('Error loading latest building structure:', err);

          this.snackBar.open('Fehler beim Laden der Gebäudestruktur!', 'OK', {
              duration: 5000,
              verticalPosition: 'top',
              panelClass: ['snackbar-warn', 'snackbar-above-dialog']
          });

          return of([] as Floor[]);
        }),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe(structure => {
        const availableStructure = this.extractAvailableFloors(structure);

        if (availableStructure.length > 0) {
          this.snackBar.open('Vorhandene Gebäudestruktur wurde geladen.', 'OK', {
            duration: 3000,
            verticalPosition: 'top',
            panelClass: 'snackbar-above-dialog'
          });
        }

        this.openAddBuildingDialog(availableStructure);
      });
  }

  private openAddBuildingDialog(structure: Floor[]): void {
    const dialogRef = this.dialog.open(AddBuildingDialogComponent, {
      panelClass: 'custom-dialog',
      disableClose: true,
      data: { structure }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) {
        return;
      }

      this.isLoading = true;

      const payload = {
        name: result.name,
        address: result.address,
        structure: result.structure
      };

      this.userService.createUserBuilding(
        this.building.bw_geb_id,
        payload
      )
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: created => {
          console.log('User building created:', created);
          this.isAdded = true;
          this.building.userBuilding = created;
        },
        complete: () => {
          this.snackBar.open('Gebäude hinzugefügt.', 'OK', {
            duration: 3000,
            verticalPosition: 'top'
          });
        },
        error: err => {
          console.error('Error creating user building:', err);
          this.errorMessage = 'Fehler beim Hinzufügen des Gebäudes.';
          this.snackBar.open('Fehler beim Hinzufügen des Gebäudes!', 'OK', {
            duration: 10000,
            verticalPosition: 'top',
            panelClass: 'snackbar-warn'
          });
        }
      });
    });
  }

  private extractAvailableFloors(value: unknown): Floor[] {
    const candidate = Array.isArray(value) ? value : [];
    const floors = candidate.filter(this.isFloor);

    if (floors.length > 0) {
      return floors;
    }

    const nested = (candidate[0] as { structure?: unknown } | undefined)?.structure;
    return Array.isArray(nested) ? nested.filter(this.isFloor) : [];
  }

  private isFloor(value: unknown): value is Floor {
    return !!value && typeof value === 'object' && 'type' in value;
  }

  requestEditView(): void {
    if (!this.building || !this.building.userBuilding || this.isLoading) return;
    this.editRequested.emit(this.building.userBuilding);
  }

}
