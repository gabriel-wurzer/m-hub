import { CommonModule } from '@angular/common';
import { Component, Inject, Optional } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FloorType } from '../../../enums/floor-type.enum';
import { ObjectType } from '../../../enums/object-type';
import { Floor } from '../../../models/floor';

type AddObjectDialogData = {
  structure?: Floor[];
};

export type AddObjectDialogResult = {
  name: string;
  objectType: ObjectType;
  isPublic: boolean;
  description: string | null;
  location: string;
  number: number;
  imageFile: File | null;
  imageFileName: string;
  imagePreviewUrl: string | null;
};

type FloorOption = {
  label: string;
};

@Component({
  selector: 'app-add-object-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    MatDividerModule,
    MatIconModule
  ],
  templateUrl: './add-object-dialog.component.html',
  styleUrl: './add-object-dialog.component.scss'
})
export class AddObjectDialogComponent {
  private readonly maxImageSizeInBytes = 10 * 1024 * 1024; //10 MB Upload limit
  private readonly allowedImageMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  private readonly specialLocationOptions: string[] = [
    'Einzelgeschoss ohne Typ (Details in Beschreibung angeben)'
  ];

  name: string = '';
  description: string = '';
  selectedLocations: string[] = [];
  number: number = 1;
  objectType: ObjectType | null = null;
  isPublic: boolean = true;

  floorOptions: FloorOption[] = [];
  locationOptions: string[] = [];
  objectTypes: ObjectType[] = Object.values(ObjectType);

  isDragActive: boolean = false;
  imageError: string = '';

  selectedImageFile: File | null = null;
  selectedImageFileName: string = '';
  selectedImagePreviewUrl: string | null = null;

  constructor(
    @Optional() public dialogRef: MatDialogRef<AddObjectDialogComponent> | null,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: AddObjectDialogData | null
  ) {
    this.floorOptions = this.buildFloorOptions(this.data?.structure ?? []);
    this.locationOptions = [...this.floorOptions.map((option) => option.label), ...this.specialLocationOptions];
  }

  getNameError(): string | null {
    if (this.name.trim().length === 0) {
      return 'Objektname erforderlich';
    }
    return null;
  }

  getObjectTypeError(): string | null {
    if (!this.objectType) {
      return 'Objekttyp erforderlich';
    }
    return null;
  }

  getNumberError(): string | null {
    const parsedNumber = Number(this.number);
    if (!Number.isInteger(parsedNumber) || parsedNumber < 1) {
      return 'Anzahl muss mindestens 1 sein';
    }
    return null;
  }

  getLocationError(): string | null {
    if (this.selectedLocations.length === 0) {
      return 'Geschoss erforderlich';
    }
    return null;
  }

  isFormValid(): boolean {
    const isNameValid = this.name.trim().length > 0;
    const isObjectTypeValid = !!this.objectType;
    const isLocationValid = this.selectedLocations.length > 0;
    const parsedNumber = Number(this.number);
    const isNumberValid = Number.isInteger(parsedNumber) && parsedNumber >= 1;
    return isNameValid && isObjectTypeValid && isLocationValid && isNumberValid;
  }

  onLocationSelectionChange(): void {
    const selectedSpecials = this.selectedLocations.filter((value) => this.isSpecialLocationOption(value));

    if (selectedSpecials.length === 0) return;

    // Special options are exclusive and replace regular floor selections.
    this.selectedLocations = [selectedSpecials[0]];
  }

  onImageFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    this.processImageFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragActive = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragActive = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragActive = false;

    const file = event.dataTransfer?.files?.[0];
    if (!file) return;

    this.processImageFile(file);
  }

  removeSelectedImage(): void {
    this.imageError = '';
    this.selectedImageFile = null;
    this.selectedImageFileName = '';
    this.selectedImagePreviewUrl = null;
  }

  private processImageFile(file: File): void {
    this.imageError = '';

    if (!this.allowedImageMimeTypes.includes(file.type)) {
      this.removeSelectedImage();
      this.imageError = 'Nur PNG, JPG, JPEG oder WEBP sind erlaubt.';
      return;
    }

    if (file.size > this.maxImageSizeInBytes) {
      this.removeSelectedImage();
      this.imageError = 'Datei ist zu groß. Maximal 10MB erlaubt.';
      return;
    }

    this.selectedImageFile = file;
    this.selectedImageFileName = file.name;

    const reader = new FileReader();
    reader.onload = () => {
      this.selectedImagePreviewUrl = typeof reader.result === 'string' ? reader.result : null;
    };
    reader.readAsDataURL(file);
  }

  private normalizeOptionalInput(input: string): string | null {
    const trimmed = input.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  private buildFloorOptions(structure: Floor[]): FloorOption[] {
    const floorTypeIndex = {
      [FloorType.KG]: 0,
      [FloorType.RG]: 0
    };

    return structure.map((floor) => {
      if (floor.type === FloorType.KG || floor.type === FloorType.RG) {
        floorTypeIndex[floor.type] += 1;
        return { label: `${floor.type} ${floorTypeIndex[floor.type]}` };
      }

      return { label: FloorType.D };
    });
  }

  private isSpecialLocationOption(value: string): boolean {
    return this.specialLocationOptions.includes(value);
  }

  private formatLocationForPayload(): string {
    return this.selectedLocations.join(', ');
  }

  confirmAddObject(): void {
    if (!this.isFormValid()) return;
    if (!this.objectType) return;

    const result: AddObjectDialogResult = {
      name: this.name.trim(),
      objectType: this.objectType,
      isPublic: this.isPublic,
      description: this.normalizeOptionalInput(this.description),
      location: this.formatLocationForPayload(),
      number: Number(this.number),
      imageFile: this.selectedImageFile,
      imageFileName: this.selectedImageFileName,
      imagePreviewUrl: this.selectedImagePreviewUrl
    };

    this.dialogRef?.close(result);
  }

  close(): void {
    this.dialogRef?.close();
  }
}
