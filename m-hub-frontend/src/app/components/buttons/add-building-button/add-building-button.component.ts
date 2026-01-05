import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { Building } from '../../../models/building';
import { BuildingService } from '../../../services/building/building.service';
import { UserService } from '../../../services/user/user.service';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AddBuildingDialogComponent } from '../../dialogs/add-building-dialog/add-building-dialog.component';
import { EditBuildingDialogComponent } from '../../dialogs/edit-building-dialog/edit-building-dialog.component';

@Component({
  selector: 'app-add-building-button',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatProgressSpinnerModule, MatDialogModule],
    templateUrl: './add-building-button.component.html',
    styleUrl: './add-building-button.component.scss'
})
export class AddBuildingButtonComponent implements OnInit {

  @Input() building!: Building;
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
    } 
  }

  onButtonClick() {
    if (this.isAdded) {
      this.editBuilding();
    } else {
      this.addBuilding();
    }
  }

  addBuilding(): void {
    if (!this.building || this.isLoading) return;

    const dialogRef = this.dialog.open(AddBuildingDialogComponent, {
      panelClass: 'custom-dialog',
      data: { structure: null }
    });

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

      this.userService.createUserBuilding(
        this.building.bw_geb_id,
        payload
      )
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: created => {
          console.log('UserBuilding created:', created);
          this.isAdded = true;
          this.building.userBuilding = created;
        },
        error: err => {
          console.error('Error creating user building:', err);
          this.errorMessage = 'Fehler beim Hinzufügen des Gebäudes.';
        }
      });
    });
  }

  editBuilding(): void {
    if (!this.building || this.isLoading) return;

    const dialogRef = this.dialog.open(EditBuildingDialogComponent, {
      panelClass: 'custom-dialog',
      data: { structure: null }
    });

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
        this.building.bw_geb_id,
        payload
      )
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: created => {
          console.log('UserBuilding created:', created);
          this.isAdded = true;
          this.building.userBuilding = created;
        },
        error: err => {
          console.error('Error creating user building:', err);
          this.errorMessage = 'Fehler beim Hinzufügen des Gebäudes.';
        }
      });
    });

  }

}
