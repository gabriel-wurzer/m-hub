import { Component, Inject } from '@angular/core';
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
import { Floor } from '../../../models/floor';
import { FloorType } from '../../../enums/floor-type.enum';
import { RoofType } from '../../../enums/roof-type.enum';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { trigger, transition, style, animate } from '@angular/animations';
import { BuildingStructureListComponent } from "../../building-structure-list/building-structure-list.component";

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
    MatProgressSpinnerModule,
    BuildingStructureListComponent
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

export class AddBuildingDialogComponent {

  FloorType = FloorType;
  RoofType = RoofType;

  roofTypes = Object.values(RoofType);
  floorTypes = Object.values(FloorType).filter(ft => ft !== FloorType.D);

  structure: Floor[] = [];
  isStructureValid: boolean = false;  

  name: string = '';
  address: string = '';

  floorSvgUrl = 'assets/images/geschoss.svg';
  roofSvgUrl = 'assets/images/dach.svg';

  structureIsAvailable: boolean = false;
  confirmStructureChange: boolean = false;

  matcher = new FloorSelectMatcher();

  animationsDisabled = true;

  constructor(
    public dialogRef: MatDialogRef<AddBuildingDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    // const isValidStructure = !!(data.structure && data.structure.length === 3);
    // this.structureIsAvailable = isValidStructure;
  }

  // // ngOnInit(): void {
  // //   if (this.structureIsAvailable && this.data.structure) {
  // //     this.originalStructure = [...this.data.structure];
  // //   }
  // // }

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
    
    return isNameValid && this.isStructureValid;
  }

  confirmAddBuilding(): void {
    if (!this.isFormValid()) return;

    // if (this.hasStructureChanged() && !this.confirmStructureChange) return;

    const trimmedAddress = this.normalizeOptionalInput(this.address);
    
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
