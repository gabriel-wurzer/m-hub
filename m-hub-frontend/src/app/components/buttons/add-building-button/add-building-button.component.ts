import { Component, Input, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Building } from '../../../models/building';
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

  isAdded = false;
  isLoading = false;
  errorMessage = '';

  constructor(
    private userService: UserService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    if (this.userId && this.building) {
      this.checkIfBuildingAdded();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['building'] && this.building && this.userId) {
      this.checkIfBuildingAdded();
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

  // addBuilding(): void {
  //   if (!this.building || this.isAdded || this.isLoading) return;

  //   this.isLoading = true;
  //   this.userService.addBuildingToUser(this.userId, this.building.bw_geb_id).subscribe({
  //     next: () => {
  //       this.isAdded = true;
  //     },
  //     error: (error) => {
  //       console.error('Error loading building exists:', error);
  //       this.errorMessage = error.status === 404
  //         ? 'No buidling found for that buidlingId.'
  //         : 'An error occurred while checking building exists.';
  //     },
  //     complete: () => {
  //       this.isLoading = false;
  //     }
  //   });
  // }

  addBuilding(): void {
    if (!this.building || this.isAdded || this.isLoading) return;

    // Check structure
    if (!this.building.structure) {
      const dialogRef = this.dialog.open(AddBuildingDialogComponent, {
        panelClass: 'custom-dialog',
        data: { structure: this.building.structure }
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          this.building.structure = result;
          this.finalizeAdd();
        }
      });
    } else {
      const dialogRef = this.dialog.open(AddBuildingDialogComponent, {
        panelClass: 'custom-dialog',
        data: { structure: this.building.structure }
      });

      dialogRef.afterClosed().subscribe(() => {
        this.finalizeAdd(); // Proceed even if user only views it
      });
    }
  }

  private finalizeAdd(): void {
    this.isLoading = true;
    this.userService.addBuildingToUser(this.userId, this.building.bw_geb_id).subscribe({
      next: () => {
        this.isAdded = true;
      },
      error: (error) => {
        console.error('Error adding building:', error);
        this.errorMessage = error.status === 404
          ? 'No building found for that buildingId.'
          : 'An error occurred while adding the building.';
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

}
