import { Component, Input, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
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

  // ngOnInit(): void {
  //   if (this.userId && this.building) {
  //     this.checkIfBuildingAdded();
  //   }
  // }
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

  addBuilding(): void {
    if (!this.building || this.isAdded || this.isLoading) return;

    this.isLoading = true;

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

      // structure was missing OR changed
      if (result.structureChanged || !this.building.structure) {
        
        console.log('Strukturänderung: ', result.structure);

        // this.buildingService.updateBuildingStructure(this.building.bw_geb_id, result.structure).subscribe({
        this.buildingService.updateBuilding(this.building).subscribe({
          next: () => {
            this.runAddBuildingToUser();
          },
          error: (error) => {
            this.errorMessage = 'Fehler beim Aktualisieren der Struktur des Gebäudes.';
            console.error(error);
            this.isLoading = false;
          },
          complete: () => {
            console.log(`Gebäudestruktur wurde erfolgreich aktualisiert: '${this.building.structure}'.`);
          }
        });
      } else {
        // no structure change
        this.runAddBuildingToUser();
      }
    });
  }

  private runAddBuildingToUser(): void {
    this.userService.addBuildingToUser(this.userId, this.building.bw_geb_id).subscribe({
      next: () => {
        this.isAdded = true;
      },
      error: (error) => {
        console.error('Error adding building:', error);
        this.errorMessage = error.status === 404
          ? 'Kein Gebäude für diese ID gefunden.'
          : 'Fehler beim Hinzufügen des Gebäudes.';
      },
      complete: () => {
        this.isLoading = false;
        console.log(`Gebäude '${this.building.bw_geb_id}' erfolgreich hinzugefügt.`);
      }
    });
  }

}
