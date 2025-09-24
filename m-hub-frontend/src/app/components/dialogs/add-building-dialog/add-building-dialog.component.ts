import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { FormControl } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCardModule } from '@angular/material/card';

class FloorSelectMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null): boolean {
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}


@Component({
  selector: 'app-add-building-dialog',
  standalone: true,
  imports: [
    CommonModule, 
    MatInputModule, 
    MatButtonModule, 
    FormsModule, 
    MatSelectModule, 
    MatSlideToggleModule,
    MatCardModule
  ],
  templateUrl: './add-building-dialog.component.html',
  styleUrl: './add-building-dialog.component.scss'
})
export class AddBuildingDialogComponent implements OnInit {
  
  name: string = '';
  address: string = '';

  // floors = [
  //   { label: 'Kellergeschoss (KG)', name: 'KG' },
  //   { label: 'Erdgeschoss (EG)', name: 'EG' },
  //   { label: 'Obergeschoss (OG)', name: 'OG' },
  //   { label: 'Dachgeschoss (DG)', name: 'DG' }
  // ];

  floors = [
    { label: 'unter Erdniveau', name: 'KG' },
    { label: 'über Erdniveau', name: 'OG' },
    { label: 'Dach', name: 'DG' }
  ];

  valueOptions = Array.from({ length: 100 }, (_, i) => i);
  
  floorValues: (number | null)[];
  floorHeights: number[] = [300, 300, 300]; // Default heights in cm for KG, OG, DG

  highlightedFloor: string = '';
  svgUrl = 'assets/images/house_interactive.svg';

  structureIsAvailable: boolean = false;
  confirmStructureChange: boolean = false;

  originalStructure: number[] = [];

  matcher = new FloorSelectMatcher();

  constructor(
    public dialogRef: MatDialogRef<AddBuildingDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { structure?: number[] }
  ) {
    
    const isValidStructure = !!(data.structure && data.structure.length === 3);
    this.structureIsAvailable = isValidStructure;

    this.floorValues = isValidStructure && data.structure ? [...data.structure] : [null, null, null]; // null = unselected    
  }

  ngOnInit(): void {
    if (this.structureIsAvailable && this.data.structure) {
      this.originalStructure = [...this.data.structure];
    }
  }

  hasStructureChanged(): boolean {
    return this.structureIsAvailable &&
      this.originalStructure.some((val, i) => val !== this.floorValues[i]);
  }

  onFloorChange(): void {
    this.confirmStructureChange = false;
  }

  getNameError(): string | null {
    if (this.name.trim().length === 0) {
      return 'Bitte Namen für das Gebäude angeben';
    }
    return null;
  }

  private normalizeOptionalInput(input: string): string | null {
    const trimmed = input.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  isFormValid(): boolean {
    const allSelected = this.floorValues.every(val => Number.isInteger(val));
    const atLeastOneFloor = this.floorValues.some(val => val && val > 0);
    const isNameValid = !!this.name && this.name.trim().length > 0;

    return allSelected && atLeastOneFloor && isNameValid;
  }

  highlightFloor(floor: string): void {
    this.highlightedFloor = floor;
  }

  clearHighlight(): void {
    this.highlightedFloor = '';
  }

  close(): void {
    this.dialogRef.close();
  }

  confirmAddBuilding(): void {
    if (!this.isFormValid()) return;

    if (this.hasStructureChanged() && !this.confirmStructureChange) return;

    const trimmedAddress = this.normalizeOptionalInput(this.address);

    this.dialogRef.close({
      structure: this.floorValues,

      name: this.name.trim(),
      address: trimmedAddress,
      structureChanged: this.hasStructureChanged()
    });
  }

  get allFloorsSelectedAndZero(): boolean {
    return this.floorValues.every(v => v !== null) && this.floorValues.every(v => v === 0);
  }

}
