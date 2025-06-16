import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { CommonModule } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-add-building-dialog',
  standalone: true,
  imports: [CommonModule, MatInputModule, MatButtonModule, FormsModule, MatSelectModule],
  templateUrl: './add-building-dialog.component.html',
  styleUrl: './add-building-dialog.component.scss'
})
export class AddBuildingDialogComponent {
  
  floors = [
    { label: 'Kellergeschoss (KG)', name: 'KG' },
    { label: 'Erdgeschoss (EG)', name: 'EG' },
    { label: 'Obergeschoss (OG)', name: 'OG' },
    { label: 'Dachgeschoss (DG)', name: 'DG' }
  ];

  valueOptions = Array.from({ length: 100 }, (_, i) => i);
  
  floorValues: number[];
  highlightedFloor: string = '';
  svgContent: string = '';

  constructor(
    public dialogRef: MatDialogRef<AddBuildingDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { structure?: number[] }
  ) {
    const defaultStructure = [0, 0, 0, 0];
    this.floorValues = data.structure && data.structure.length === 4
      ? [...data.structure]
      : defaultStructure;
    
    console.log('Dialog data:', data);
    console.log('Floors:', this.floorValues);
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
    this.dialogRef.close(this.floorValues);
  }
}
