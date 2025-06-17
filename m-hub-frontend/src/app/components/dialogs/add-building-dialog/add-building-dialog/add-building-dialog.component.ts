import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { FormControl, FormGroupDirective, NgForm } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {MatCardModule} from '@angular/material/card';

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

  floors = [
    { label: 'Kellergeschoss (KG)', name: 'KG' },
    { label: 'Erdgeschoss (EG)', name: 'EG' },
    { label: 'Obergeschoss (OG)', name: 'OG' },
    { label: 'Dachgeschoss (DG)', name: 'DG' }
  ];

  valueOptions = Array.from({ length: 100 }, (_, i) => i);
  
  floorValues: (number | null)[];
  highlightedFloor: string = '';
  svgContent: string = '';

  structureIsAvailable: boolean = false;
  confirmStructureChange: boolean = false;

  originalStructure: number[] = [];

  matcher = new FloorSelectMatcher();

  constructor(
    public dialogRef: MatDialogRef<AddBuildingDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { structure?: number[] }
  ) {
    
    const isValidStructure = !!(data.structure && data.structure.length === 4);
    this.structureIsAvailable = isValidStructure;

    this.floorValues = isValidStructure && data.structure ? [...data.structure] : [null, null, null, null]; // null = unselected    
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

  isFormValid(): boolean {
    return this.floorValues.every(val => Number.isInteger(val));
  }


  highlightFloor(floor: string): void {
    this.highlightedFloor = `highlight-${floor}`;
  }

  clearHighlight(): void {
    this.highlightedFloor = '';
  }

  close(): void {
    this.dialogRef.close();
  }

  save(): void {
    if (!this.isFormValid()) return;

    if (this.hasStructureChanged() && !this.confirmStructureChange) return;

    this.dialogRef.close({
      structure: this.floorValues,
      name: this.name,
      address: this.address,
      structureChanged: this.hasStructureChanged()
    });
  }

}
