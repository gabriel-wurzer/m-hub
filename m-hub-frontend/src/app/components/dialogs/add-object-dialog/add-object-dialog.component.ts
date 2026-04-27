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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
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
  isHazardous: boolean;
  description: string | null;
  location: string;
  number: number;
  length: number | null;
  width: number | null;
  height: number | null;
  imageFile: File | null;
  imageFileName: string;
  imagePreviewUrl: string | null;
};

type FloorOption = {
  label: string;
  description?: string;
};

type LocationOptionVm = {
  value: string;
  main: string;
  note?: string;
};

type MeasurementInput = number | string | null;

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
    MatSnackBarModule,
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
  readonly specialLocationOptions: string[] = ['Individuell (Verortung in Beschreibung angeben)'];
  private readonly specialLocationOptionValue = 'Individuell';
  private readonly floorDescriptionByLocationLabel = new Map<string, string>();
  private previousSelectedLocations: string[] = [];

  name: string = '';
  description: string = '';
  selectedLocations: string[] = [];
  number: number = 1;
  length: MeasurementInput = null;
  width: MeasurementInput = null;
  height: MeasurementInput = null;
  objectType: ObjectType | null = null;
  isPublic: boolean = true;
  isHazardous: boolean = false;

  floorOptions: FloorOption[] = [];
  locationOptions: string[] = [];
  locationOptionVms: LocationOptionVm[] = [];
  objectTypes: ObjectType[] = Object.values(ObjectType);

  isDragActive: boolean = false;
  imageError: string = '';

  selectedImageFile: File | null = null;
  selectedImageFileName: string = '';
  selectedImagePreviewUrl: string | null = null;
  readonly positiveMeasurementPattern = '^(?:[1-9]\\d*(?:[.,]\\d+)?|0[.,]\\d*[1-9]\\d*)$';

  constructor(
    @Optional() public dialogRef: MatDialogRef<AddObjectDialogComponent> | null,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: AddObjectDialogData | null,
    private snackBar: MatSnackBar
  ) {
    this.floorOptions = this.buildFloorOptions(this.data?.structure ?? []);
    this.rebuildFloorDescriptionByLocationLabel();
    this.locationOptions = [...this.floorOptions.map((option) => option.label), ...this.specialLocationOptions];
    this.locationOptionVms = this.locationOptions.map((value) => this.toLocationOptionVm(value));
  }

  private toLocationOptionVm(value: string): LocationOptionVm {
    const floorDesc = this.floorDescriptionByLocationLabel.get(value);
    if (floorDesc) {
      return { value, main: value, note: this.formatLocationNote(floorDesc) };
    }

    if (!this.specialLocationOptions.includes(value)) {
      return { value, main: value };
    }

    const match = value.match(/^(.*?)(\s*\(.*\))$/);
    if (!match) {
      return { value, main: value };
    }

    const main = match[1].trimEnd();
    const note = match[2].trimStart();

    return { value: this.specialLocationOptionValue, main, note };
  }

  private formatLocationNote(description: string): string | undefined {
    const trimmed = description.trim();
    if (trimmed.length === 0) return undefined;

    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      return trimmed;
    }

    return `(${trimmed})`;
  }

  private rebuildFloorDescriptionByLocationLabel(): void {
    this.floorDescriptionByLocationLabel.clear();

    for (const option of this.floorOptions) {
      if (!option.description) continue;
      this.floorDescriptionByLocationLabel.set(option.label, option.description);
    }
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

  getLengthError(): string | null {
    return this.getMeasurementError('Länge', this.length);
  }

  getWidthError(): string | null {
    return this.getMeasurementError('Breite', this.width);
  }

  getHeightError(): string | null {
    return this.getMeasurementError('Höhe', this.height);
  }

  // getLocationError(): string | null {
  //   if (this.selectedLocations.length === 0) {
  //     return 'Geschoss erforderlich';
  //   }
  //   return null;
  // }

  isFormValid(): boolean {
    const isNameValid = this.name.trim().length > 0;
    const isObjectTypeValid = !!this.objectType;
    // const isLocationValid = this.selectedLocations.length > 0;
    const parsedNumber = Number(this.number);
    const isNumberValid = Number.isInteger(parsedNumber) && parsedNumber >= 1;
    const areMeasurementsValid = [
      this.isOptionalMeasurementValid(this.length),
      this.isOptionalMeasurementValid(this.width),
      this.isOptionalMeasurementValid(this.height)
    ].every(Boolean);
    return isNameValid && isObjectTypeValid && isNumberValid && areMeasurementsValid;
  }

  onLocationsChange(selectedLocations: string[]): void {
    const hadIndividualSelected = this.previousSelectedLocations.includes(this.specialLocationOptionValue);
    const hasIndividualSelected = selectedLocations.includes(this.specialLocationOptionValue);

    if (hasIndividualSelected && selectedLocations.length > 1) {
      if (hadIndividualSelected) {
        this.selectedLocations = selectedLocations.filter((location) => location !== this.specialLocationOptionValue);
        this.openLocationSelectionHint('"Individuell" wurde abgewählt, da eine andere Verortung ausgewählt wurde.');
      } else {
        this.selectedLocations = [this.specialLocationOptionValue];
        this.openLocationSelectionHint('"Individuell" wurde ausgewählt. Andere Verortungen wurden abgewählt.');
      }
    } else if (hasIndividualSelected) {
      this.selectedLocations = [this.specialLocationOptionValue];
    } else {
      this.selectedLocations = selectedLocations;
    }

    this.previousSelectedLocations = [...this.selectedLocations];
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

  private getMeasurementError(label: string, value: MeasurementInput): string | null {
    const parsedValue = this.parseMeasurementInput(value);

    if (parsedValue === null) {
      return null;
    }

    if (!Number.isFinite(parsedValue)) {
      return `${label} muss eine Zahl sein`;
    }

    if (parsedValue <= 0) {
      return `${label} muss größer 0 sein`;
    }

    return null;
  }

  private isOptionalMeasurementValid(value: MeasurementInput): boolean {
    const parsedValue = this.parseMeasurementInput(value);
    return parsedValue === null || (Number.isFinite(parsedValue) && parsedValue > 0);
  }

  private normalizeOptionalMeasurement(value: MeasurementInput): number | null {
    const parsedValue = this.parseMeasurementInput(value);
    return parsedValue !== null && Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
  }

  private parseMeasurementInput(value: MeasurementInput): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'number') {
      return value;
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    const normalized = trimmed.replace(',', '.');
    const parsedValue = Number(normalized);

    return Number.isFinite(parsedValue) ? parsedValue : Number.NaN;
  }

  private buildFloorOptions(structure: Floor[]): FloorOption[] {
    const floorTypeIndex = {
      [FloorType.KG]: 0,
      [FloorType.RG]: 0
    };

    return structure.map((floor) => {
      const description =
        typeof floor.description === 'string' && floor.description.trim().length > 0
          ? floor.description.trim()
          : undefined;

      if (floor.type === FloorType.KG || floor.type === FloorType.RG) {
        floorTypeIndex[floor.type] += 1;
        return { label: `${floor.type} ${floorTypeIndex[floor.type]}`, description };
      }

      return { label: floor.type, description };
    });
  }

  private formatLocationForPayload(): string {
    return this.selectedLocations.join(', ');
  }

  private openLocationSelectionHint(message: string): void {
    this.snackBar.open(message, 'OK', {
      duration: 3000,
      verticalPosition: 'top'
    });
  }

  confirmAddObject(): void {
    if (!this.isFormValid()) return;
    if (!this.objectType) return;

    const result: AddObjectDialogResult = {
      name: this.name.trim(),
      objectType: this.objectType,
      isPublic: this.isPublic,
      isHazardous: this.isHazardous,
      description: this.normalizeOptionalInput(this.description),
      location: this.formatLocationForPayload(),
      number: Number(this.number),
      length: this.normalizeOptionalMeasurement(this.length),
      width: this.normalizeOptionalMeasurement(this.width),
      height: this.normalizeOptionalMeasurement(this.height),
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
