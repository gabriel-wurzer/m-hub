import { Component, Inject } from '@angular/core';
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
import { Floor } from '../../../models/floor';
import { MatDividerModule } from '@angular/material/divider';
import { UserBuilding } from '../../../models/building';



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
    DocumentListComponent
  ],
  templateUrl: './edit-building-dialog.component.html',
  styleUrl: './edit-building-dialog.component.scss'
})
export class EditBuildingDialogComponent {

  selectedTabIndex: number = 0;

  name: string = '';
  address: string = '';
  structure: Floor[] = [];
  buildingParts: Bauteil[] = [];
  buildingObjects: Objekt[] = [];
  documents: Document[] = [];

  constructor(
      public dialogRef: MatDialogRef<EditBuildingDialogComponent>,
      @Inject(MAT_DIALOG_DATA) public data: { userBuilding: UserBuilding }
  ) {
    if (this.data && this.data.userBuilding) {
      
      // create copy of user building to prevent change of original befor completing dialog--> Immutability principle
      const b = this.data.userBuilding;
      
      this.name = b.name || '';
      this.address = b.address || '';
      
      // WICHTIG: Erstelle eine tiefe Kopie der Struktur, 
      // damit Änderungen im Dialog nicht sofort das Original-Objekt 
      // außerhalb des Dialogs verändern (Stichwort: )
      this.structure = b.structure ? JSON.parse(JSON.stringify(b.structure)) : [];

      // TODO: Fetch usrbuilding related documents, parts and objects
      // this.components = b.buildingComponents || [];
      // this.documents = b.documents || [];
    }
  }
  
  // {
  //   this.name = data.name || '';
  //   this.address = data.address || '';
  //   // this.components = data.buildingComponents || [];
  //   this.documents = data.documents || [];
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
    return isNameValid;
  }

  close(): void {
    this.dialogRef.close();
  }

  confirmEditBuilding(): void {
    if (!this.isFormValid()) return;

    const trimmedAddress = this.normalizeOptionalInput(this.address);

    this.dialogRef.close({
      name: this.name.trim(),
      address: trimmedAddress, 
      structure: this.structure,
      // buildingComponents: this.components,
      documents: this.documents
    });
  }

}
