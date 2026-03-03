import { CommonModule } from '@angular/common';
import { Component, Inject, Optional } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import { FloorType } from '../../../enums/floor-type.enum';
import { ObjectType } from '../../../enums/object-type';
import { Objekt } from '../../../models/building-component';
import { Floor } from '../../../models/floor';

export type EditObjectDialogData = {
  structure?: Floor[];
  object?: Objekt;
};

export type EditObjectDialogResult = {
  name: string;
  objectType: ObjectType;
  isPublic: boolean;
  isHazardous: boolean;
  description: string | null;
  location: string;
  number: number;
  imageFile: File | null;
  imageFileName: string;
  imagePreviewUrl: string | null;
  removeExistingImage: boolean;
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

@Component({
  selector: 'app-edit-object-dialog',
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
  templateUrl: './edit-object-dialog.component.html',
  styleUrl: './edit-object-dialog.component.scss'
})
export class EditObjectDialogComponent {
  private readonly maxImageSizeInBytes = 10 * 1024 * 1024;
  private readonly allowedImageMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  readonly specialLocationOptions: string[] = ['Individuell (Verortung in Beschreibung angeben)'];
  private readonly specialLocationOptionValue = 'Individuell';
  private readonly floorDescriptionByLocationLabel = new Map<string, string>();

  private initialImagePreviewUrl: string | null = null;
  private initialImageFileName: string = '';

  name: string = '';
  description: string = '';
  selectedLocations: string[] = [];
  number: number = 1;
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
  removeExistingImage: boolean = false;

  constructor(
    @Optional() public dialogRef: MatDialogRef<EditObjectDialogComponent> | null,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: EditObjectDialogData | null
  ) {
    this.floorOptions = this.buildFloorOptions(this.data?.structure ?? []);
    this.rebuildFloorDescriptionByLocationLabel();
    this.locationOptions = [...this.floorOptions.map((option) => option.label), ...this.specialLocationOptions];
    this.locationOptionVms = this.locationOptions.map((value) => this.toLocationOptionVm(value));

    this.prefillFromObject(this.data?.object);
  }

  private prefillFromObject(object: Objekt | undefined): void {
    if (!object) return;

    this.name = object.name ?? '';
    this.description = object.description ?? '';

    const parsedCount = Number(object.count);
    this.number = Number.isInteger(parsedCount) && parsedCount >= 1 ? parsedCount : 1;

    const parsedObjectType = object.object_type as ObjectType;
    this.objectType = this.objectTypes.includes(parsedObjectType) ? parsedObjectType : null;

    this.isPublic = this.coerceBoolean(object.is_public, true);
    this.isHazardous = this.coerceBoolean(object.is_hazardous, false);

    const parsedLocations = this.parseLocations(object.location);
    parsedLocations.forEach((value) => this.ensureLocationValueAvailable(value));
    this.selectedLocations = parsedLocations;

    const imageUrl = this.resolveInitialImageUrl(object);
    if (imageUrl) {
      this.initialImagePreviewUrl = imageUrl;
      this.initialImageFileName = this.resolveInitialImageName(object, imageUrl);
      this.selectedImagePreviewUrl = imageUrl;
      this.selectedImageFileName = this.initialImageFileName;
    }
  }

  private parseLocations(location: string | undefined): string[] {
    if (!location || location.trim().length === 0) return [];

    return location
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map((part) => this.normalizeLocationValue(part));
  }

  private normalizeLocationValue(location: string): string {
    if (location === this.specialLocationOptions[0]) {
      return this.specialLocationOptionValue;
    }
    return location;
  }

  private ensureLocationValueAvailable(value: string): void {
    if (this.locationOptionVms.some((option) => option.value === value)) return;

    this.locationOptions.push(value);
    this.locationOptionVms.push(this.toLocationOptionVm(value));
  }

  private coerceBoolean(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    if (typeof value === 'number') return value === 1;
    return fallback;
  }

  private resolveInitialImageUrl(object: Objekt): string | null {
    if (typeof object.image_url === 'string' && object.image_url.trim().length > 0) {
      return object.image_url.trim();
    }

    if (typeof object.image_path === 'string' && /^https?:\/\//i.test(object.image_path.trim())) {
      return object.image_path.trim();
    }

    return null;
  }

  private resolveInitialImageName(object: Objekt, imageUrl: string): string {
    if (typeof object.image_original_name === 'string' && object.image_original_name.trim().length > 0) {
      return object.image_original_name.trim();
    }

    try {
      const parsed = new URL(imageUrl);
      const fileName = parsed.pathname.split('/').pop();
      if (fileName && fileName.length > 0) {
        return decodeURIComponent(fileName);
      }
    } catch {
      const fileName = imageUrl.split('?')[0].split('#')[0].split('/').pop();
      if (fileName && fileName.length > 0) {
        return decodeURIComponent(fileName);
      }
    }

    return '';
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

  isFormValid(): boolean {
    const isNameValid = this.name.trim().length > 0;
    const isObjectTypeValid = !!this.objectType;
    const parsedNumber = Number(this.number);
    const isNumberValid = Number.isInteger(parsedNumber) && parsedNumber >= 1;
    return isNameValid && isObjectTypeValid && isNumberValid;
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

    if (this.selectedImageFile) {
      this.selectedImageFile = null;

      if (this.initialImagePreviewUrl && !this.removeExistingImage) {
        this.selectedImagePreviewUrl = this.initialImagePreviewUrl;
        this.selectedImageFileName = this.initialImageFileName;
      } else {
        this.selectedImagePreviewUrl = null;
        this.selectedImageFileName = '';
      }
      return;
    }

    if (this.selectedImagePreviewUrl && this.initialImagePreviewUrl) {
      this.selectedImagePreviewUrl = null;
      this.selectedImageFileName = '';
      this.removeExistingImage = true;
      return;
    }

    this.selectedImagePreviewUrl = null;
    this.selectedImageFileName = '';
  }

  private processImageFile(file: File): void {
    this.imageError = '';

    if (!this.allowedImageMimeTypes.includes(file.type)) {
      this.selectedImageFile = null;
      this.selectedImageFileName = '';
      this.selectedImagePreviewUrl = this.initialImagePreviewUrl;
      this.imageError = 'Nur PNG, JPG, JPEG oder WEBP sind erlaubt.';
      return;
    }

    if (file.size > this.maxImageSizeInBytes) {
      this.selectedImageFile = null;
      this.selectedImageFileName = '';
      this.selectedImagePreviewUrl = this.initialImagePreviewUrl;
      this.imageError = 'Datei ist zu groß. Maximal 10MB erlaubt.';
      return;
    }

    this.removeExistingImage = false;
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

  confirmEditObject(): void {
    if (!this.isFormValid()) return;
    if (!this.objectType) return;

    const result: EditObjectDialogResult = {
      name: this.name.trim(),
      objectType: this.objectType,
      isPublic: this.isPublic,
      isHazardous: this.isHazardous,
      description: this.normalizeOptionalInput(this.description),
      location: this.formatLocationForPayload(),
      number: Number(this.number),
      imageFile: this.selectedImageFile,
      imageFileName: this.selectedImageFileName,
      imagePreviewUrl: this.selectedImagePreviewUrl,
      removeExistingImage: this.removeExistingImage
    };

    this.dialogRef?.close(result);
  }

  close(): void {
    this.dialogRef?.close();
  }
}
