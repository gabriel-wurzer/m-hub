import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { Building, UserBuilding } from '../../../models/building';
import { UserService } from '../../../services/user/user.service';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AddBuildingDialogComponent } from '../../dialogs/add-building-dialog/add-building-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'user-add-building-button',
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

  requestEditView(): void {
    if (!this.building || !this.building.userBuilding || this.isLoading) return;
    this.editRequested.emit(this.building.userBuilding);
  }

}
