import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';

import { BuildingComponent } from '../../../models/building-component';
import { Document } from '../../../models/document';


@Component({
  selector: 'app-edit-building-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatInputModule,
    MatButtonModule
  ],
  templateUrl: './edit-building-dialog.component.html',
  styleUrl: './edit-building-dialog.component.scss'
})
export class EditBuildingDialogComponent {

  name: string = '';
  address: string = '';
  components: BuildingComponent[] = [];
  documents: Document[] = [];

  constructor(
      public dialogRef: MatDialogRef<EditBuildingDialogComponent>,
      @Inject(MAT_DIALOG_DATA) public data: { name: string, address: string, buildingComponents: BuildingComponent[], documents: Document[] }
  ) {
    this.name = data.name || '';
    this.address = data.address || '';
    this.components = data.buildingComponents || [];
    this.documents = data.documents || [];
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
      components: this.components,
      documents: this.documents
    });
  }

}
