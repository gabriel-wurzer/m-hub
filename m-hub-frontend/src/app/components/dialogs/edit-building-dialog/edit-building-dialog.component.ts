import { AfterViewInit, Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTabsModule } from '@angular/material/tabs';

import { Bauteil, BuildingComponent, Objekt } from '../../../models/building-component';
import { Document } from '../../../models/document';
import { DocumentListComponent } from "../../document-list/document-list.component";
import { Floor, RoofFloor, StandardFloor } from '../../../models/floor';
import { MatDividerModule } from '@angular/material/divider';
import { UserBuilding } from '../../../models/building';
import { FloorType } from '../../../enums/floor-type.enum';
import { RoofType } from '../../../enums/roof-type.enum';
import { BuildingStructureListComponent } from "../../building-structure-list/building-structure-list.component";



@Component({
  selector: 'app-edit-building-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatInputModule,
    MatButtonModule,
    MatExpansionModule,
    MatTabsModule,
    MatDividerModule,
    DocumentListComponent,
    BuildingStructureListComponent
],
  templateUrl: './edit-building-dialog.component.html',
  styleUrl: './edit-building-dialog.component.scss'
})
export class EditBuildingDialogComponent {

  selectedTabIndex: number = 0;

  FloorType = FloorType;
  RoofType = RoofType;

  roofTypes = Object.values(RoofType);
  floorTypes = Object.values(FloorType).filter(ft => ft !== FloorType.D);

  name: string = '';
  address: string = '';

  structure: Floor[] = [];
  isStructureValid: boolean = false;

  buildingParts: Bauteil[] = [];
  buildingObjects: Objekt[] = [];
  documents: Document[] = [];

  floorSvgUrl = 'assets/images/geschoss.svg';
  roofSvgUrl = 'assets/images/dach.svg';

  animationsDisabled = true;

  constructor(
      public dialogRef: MatDialogRef<EditBuildingDialogComponent>,
      @Inject(MAT_DIALOG_DATA) public data: { userBuilding: UserBuilding }
  ) {
    if (this.data && this.data.userBuilding) {
      
      // create copy of user building to prevent change of original befor completing dialog--> Immutability principle
      const b = this.data.userBuilding;
      
      this.name = b.name || '';
      this.address = b.address || '';
      
      this.structure = b.structure ? JSON.parse(JSON.stringify(b.structure)) : [];

      // TODO: Fetch usrbuilding related documents, parts and objects
      // this.components = b.buildingComponents || [];
      // this.documents = b.documents || [];
    }
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
    const isNameValid = !!this.name && this.name.trim().length > 0;
    
    return isNameValid && this.isStructureValid;
  }
  
  // ngAfterViewInit(): void {
  //   // Prevent animation glitch on load
  //   setTimeout(() => {
  //     this.animationsDisabled = false;
  //   });
  // }

  // get roofFloor(): RoofFloor {
  //   return this.structure.find(f => f.type === FloorType.D) as RoofFloor;
  // }

  // get regularFloors(): StandardFloor[] {
  //   return this.structure.filter(
  //     f => f.type === FloorType.RG
  //   ) as StandardFloor[];
  // }

  // private createRegularFloor(): StandardFloor {
  //   return {
  //     type: FloorType.RG,
  //     count: null,
  //     height: null,
  //     area: null,
  //     name: '',
  //   } as unknown as StandardFloor; // Cast to satisfy strict typing if model requires number
  // }

  // get basementFloors(): StandardFloor[] {
  //   return this.structure.filter(
  //     f => f.type === FloorType.KG
  //   ) as StandardFloor[];
  // }


  // getNameError(): string | null {
  //   if (this.name.trim().length === 0) {
  //     return 'Bitte Namen für das Gebäude angeben';
  //   }
  //   return null;
  // }

  // private normalizeOptionalInput(input: string): string | null {
  //   const trimmed = input.trim();
  //   return trimmed.length === 0 ? null : trimmed;
  // }

  // isFormValid(): boolean {
  //   const isNameValid = !!this.name && this.name.trim().length > 0;
  //   return isNameValid;
  // }



  confirmEditBuilding(): void {
    if (!this.isFormValid()) return;

    const trimmedAddress = this.normalizeOptionalInput(this.address);

    this.dialogRef.close({
      name: this.name.trim(),
      address: trimmedAddress, 
      structure: this.structure,
      // buildingComponents: this.components,
      // documents: this.documents
    });
  }

    close(): void {
    this.dialogRef.close();
  }

}
