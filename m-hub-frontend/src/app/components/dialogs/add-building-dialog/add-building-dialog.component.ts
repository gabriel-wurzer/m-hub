import { AfterViewInit, Component, Inject } from '@angular/core';
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
import { MatTooltipModule } from '@angular/material/tooltip';

import { trigger, transition, style, animate } from '@angular/animations';

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
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './add-building-dialog.component.html',
  styleUrl: './add-building-dialog.component.scss',
  animations: [
    trigger('rowAnimation', [
      transition(':enter', [
        style({ 
          opacity: 0, 
          height: '0px', 
          overflow: 'hidden',
          marginBottom: '0px',
          paddingTop: '0px',
          paddingBottom: '0px',
          transform: 'scale(0.95)',
          backgroundColor: 'rgba(23, 155, 222, 0.15)' 
        }),
        animate('300ms ease-out', style({ 
          opacity: 1, 
          height: '*', 
          marginBottom: '*', 
          paddingTop: '*', 
          paddingBottom: '*',
          transform: 'scale(1)'
        })),
        animate('800ms 200ms ease-in-out', style({ 
          backgroundColor: 'transparent' 
        }))
      ]),
      transition(':leave', [
        style({ overflow: 'hidden' }),
        animate('250ms ease-in', style({ 
          backgroundColor: 'rgba(230, 108, 26, 0.2)',
          transform: 'scale(1.02)' 
        })),
        animate('450ms ease-in', style({ 
          opacity: 0, 
          transform: 'scale(0.9)', 
          height: 0, 
          margin: 0,
          padding: 0 
        }))
      ])
    ])
  ]
})
export class AddBuildingDialogComponent implements AfterViewInit {

  FloorType = FloorType;
  RoofType = RoofType;

  roofTypes = Object.values(RoofType);
  floorTypes = Object.values(FloorType).filter(ft => ft !== FloorType.D);

  structure: Floor[] = [
    { type: FloorType.D } as RoofFloor, 
    this.createRegularFloor()
  ];

  name: string = '';
  address: string = '';

  floorCountOptions = Array.from({ length: 100 }, (_, i) => i);

  floorSvgUrl = 'assets/images/geschoss.svg';
  roofSvgUrl = 'assets/images/dach.svg';

  structureIsAvailable: boolean = false;
  confirmStructureChange: boolean = false;

  matcher = new FloorSelectMatcher();

  animationsDisabled = true;

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

  ngAfterViewInit(): void {
    // Timeout ist wichtig, um "ExpressionChangedAfterItHasBeenCheckedError" zu vermeiden
    setTimeout(() => {
      this.animationsDisabled = false;
    });
  }

  get roofFloor(): RoofFloor {
    return this.structure.find(f => f.type === FloorType.D) as RoofFloor;
  }

  get regularFloors(): StandardFloor[] {
    return this.structure.filter(
      f => f.type === FloorType.RG
    ) as StandardFloor[];
  }

  get basementFloors(): StandardFloor[] {
    return this.structure.filter(
      f => f.type === FloorType.KG
    ) as StandardFloor[];
  }

  private createRegularFloor(): StandardFloor {
    return {
      type: FloorType.RG,
      count: null,
      height: null,
      area: null,
      name: '',
    } as unknown as StandardFloor; // Cast to satisfy strict typing if model requires number
  }


  addRegularFloor(): void {
    const index = 1 + this.regularFloors.length;
    this.structure.splice(index, 0, this.createRegularFloor());
  }

  removeRegularFloor(i: number): void {
    // const floor = this.regularFloors[i];
    // const idx = this.structure.indexOf(floor);
    // this.structure.splice(idx, 1);

    if (this.regularFloors.length <= 1) {
      return;
    }

    const floor = this.regularFloors[i];
    const idx = this.structure.indexOf(floor);
    if (idx > -1) {
      this.structure.splice(idx, 1);
    }
  }


  private createBasementFloor(): StandardFloor {
    return {
      type: FloorType.KG,
      count: null,
      height: null,
      area: null,
      name: '',
    } as unknown as StandardFloor;
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
    
    const isRoofValid = !!this.roofFloor && !!(this.roofFloor as any).roofType;

    const hasRegularFloors = this.regularFloors.length > 0;
    const areRegularFloorsValid = this.regularFloors.every(f => 
      f.count !== null && f.count > 0 && Number.isInteger(f.count) &&
      f.height !== null && f.height > 0 &&
      f.area !== null && f.area > 0
    );

    const areBasementFloorsValid = this.basementFloors.every(f => 
      f.count !== null && f.count > 0 && Number.isInteger(f.count) &&
      f.height !== null && f.height > 0 &&
      f.area !== null && f.area > 0
    );

    const isStrctureValid = isRoofValid && hasRegularFloors && areRegularFloorsValid && areBasementFloorsValid;

    return isNameValid && isStrctureValid;
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
      ...this.regularFloors,
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
