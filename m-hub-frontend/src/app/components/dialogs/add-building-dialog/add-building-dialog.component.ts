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
import { Floor, RoofFloor, StandardFloor } from '../../../models/floor';
import { FloorType } from '../../../enums/floor-type.enum';
import { RoofType } from '../../../enums/roof-type.enum';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

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
    MatCardModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './add-building-dialog.component.html',
  styleUrl: './add-building-dialog.component.scss'
})
// export class AddBuildingDialogComponent implements OnInit {
export class AddBuildingDialogComponent {

  FloorType = FloorType;
  RoofType = RoofType;

  roofTypes = Object.values(RoofType);
  floorTypes = Object.values(FloorType).filter(ft => ft !== FloorType.D);

  structure: Floor[] = [];




  name: string = '';
  address: string = '';




  floorCountOptions = Array.from({ length: 100 }, (_, i) => i);



  // valueOptions = Array.from({ length: 100 }, (_, i) => i);
  
  // floorValues: (number | null)[];
  // floorHeights: number[] = [300, 300, 300]; // Default heights in cm for KG, OG, DG

  highlightedFloor: string = '';
  // svgUrl = 'assets/images/house_interactive.svg';
  floorSvgUrl = 'assets/images/geschoss.svg';
  roofSvgUrl = 'assets/images/dach.svg';

  structureIsAvailable: boolean = false;
  confirmStructureChange: boolean = false;

  // originalStructure: number[] = [];

  matcher = new FloorSelectMatcher();

  constructor(
    public dialogRef: MatDialogRef<AddBuildingDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { structure?: number[] }
  ) {
    
    // const isValidStructure = !!(data.structure && data.structure.length === 3);
    // this.structureIsAvailable = isValidStructure;
    // this.floorValues = isValidStructure && data.structure ? [...data.structure] : [null, null, null]; // null = unselected    
  }

  // ngOnInit(): void {
  //   if (this.structureIsAvailable && this.data.structure) {
  //     this.originalStructure = [...this.data.structure];
  //   }
  // }

  get roofFloor(): RoofFloor {
    return this.structure.find(f => f.type === FloorType.D) as RoofFloor;
  }

  get upperFloors(): StandardFloor[] {
    return this.structure.filter(
      f => f.type !== FloorType.D && !(f as any).isBasement
    ) as StandardFloor[];
  }

  get basementFloors(): StandardFloor[] {
    return this.structure.filter(
      f => f.type !== FloorType.D && (f as any).isBasement
    ) as StandardFloor[];
  }

  private createRegularFloor(): StandardFloor {
    return {
      type: FloorType.RG,
      count: 1,
      height: 260,
      area: 50,
      name: '',
      isBasement: false
    } as StandardFloor;
  }

  private createBasementFloor(): StandardFloor {
    return {
      type: FloorType.KG,
      count: 1,
      height: 240,
      area: 50,
      name: '',
      isBasement: true
    } as StandardFloor;
  }

  addRegularFloor(): void {
    const index = 1 + this.upperFloors.length; // after roof + upper floors
    this.structure.splice(index, 0, this.createRegularFloor());
  }

  removeUpperFloor(i: number): void {
    const floor = this.upperFloors[i];
    const idx = this.structure.indexOf(floor);
    this.structure.splice(idx, 1);
  }

  addBasementFloor(): void {
    this.structure.push(this.createBasementFloor());
  }

  removeBasementFloor(i: number): void {
    const floor = this.basementFloors[i];
    const idx = this.structure.indexOf(floor);
    this.structure.splice(idx, 1);
  }

  // hasStructureChanged(): boolean {
  //   return this.structureIsAvailable &&
  //     this.originalStructure.some((val, i) => val !== this.floorValues[i]);
  // }

  // onFloorChange(): void {
  //   this.confirmStructureChange = false;
  // }

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
    const isNameValid = !!this.name && this.name.trim().length > 0;

    const isStructureValid = true; 

    return isStructureValid && isNameValid;
  }

  // isFormValid(): boolean {
  //   const allSelected = this.floorValues.every(val => Number.isInteger(val));
  //   const atLeastOneFloor = this.floorValues.some(val => val && val > 0);
  //   const isNameValid = !!this.name && this.name.trim().length > 0;

  //   return allSelected && atLeastOneFloor && isNameValid;
  // }

  // highlightFloor(floor: string): void {
  //   this.highlightedFloor = floor;
  // }

  // clearHighlight(): void {
  //   this.highlightedFloor = '';
  // }

  // confirmAddBuilding(): void {
  //   if (!this.isFormValid()) return;

  //   // if (this.hasStructureChanged() && !this.confirmStructureChange) return;

  //   const trimmedAddress = this.normalizeOptionalInput(this.address);

  //   this.dialogRef.close({
  //     structure: this.floorValues,
  //     name: this.name.trim(),
  //     address: trimmedAddress,
  //     // structureChanged: this.hasStructureChanged()
  //   });
  // }

  // get allFloorsSelectedAndZero(): boolean {
  //   return this.floorValues.every(v => v !== null) && this.floorValues.every(v => v === 0);
  // }


  confirmAddBuilding(): void {
    if (!this.isFormValid()) return;

    // if (this.hasStructureChanged() && !this.confirmStructureChange) return;

    const trimmedAddress = this.normalizeOptionalInput(this.address);

    this.structure = [
      this.roofFloor,
      ...this.upperFloors,
      ...this.basementFloors
    ]

    this.dialogRef.close({
      name: this.name.trim(),
      address: trimmedAddress,
      structure: this.structure
      // structureChanged: this.hasStructureChanged()
    });
  }

  close(): void {
    this.dialogRef.close();
  }

}
