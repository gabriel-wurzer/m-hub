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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { FloorType } from '../../../enums/floor-type.enum';
import { ObjectType } from '../../../enums/object-type';
import { BuildingObjectImage, Objekt } from '../../../models/building-component';
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
  length: number | null;
  width: number | null;
  height: number | null;
  images: EditObjectDialogImage[];
  existingImageIds: string[];
  imagesChanged: boolean;
};

export type EditObjectDialogImage = {
  file: File;
  fileName: string;
  previewUrl: string;
};

type ExistingObjectDialogImage = {
  id: string | null;
  fileName: string;
  previewUrl: string;
  sortOrder: number;
  sizeBytes: number;
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
    MatSnackBarModule,
    MatTooltipModule,
    MatDividerModule,
    MatIconModule
  ],
  templateUrl: './edit-object-dialog.component.html',
  styleUrl: './edit-object-dialog.component.scss'
})
export class EditObjectDialogComponent {
  private readonly maxImageSizeInBytes = 10 * 1024 * 1024;
  private readonly maxTotalImageSizeInBytes = 100 * 1024 * 1024;
  private readonly allowedImageMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  readonly specialLocationOptions: string[] = ['Individuell (Verortung in Beschreibung angeben)'];
  private readonly specialLocationOptionValue = 'Individuell';
  private readonly floorDescriptionByLocationLabel = new Map<string, string>();
  private previousSelectedLocations: string[] = [];

  private initialExistingImageIds = new Set<string>();
  private imageChangesTouched = false;

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

  existingImages: ExistingObjectDialogImage[] = [];
  selectedImages: EditObjectDialogImage[] = [];
  readonly positiveMeasurementPattern = '^(?:[1-9]\\d*(?:[.,]\\d+)?|0[.,]\\d*[1-9]\\d*)$';

  constructor(
    @Optional() public dialogRef: MatDialogRef<EditObjectDialogComponent> | null,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: EditObjectDialogData | null,
    private snackBar: MatSnackBar
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
    this.length = this.normalizeIncomingMeasurement(object.length);
    this.width = this.normalizeIncomingMeasurement(object.width);
    this.height = this.normalizeIncomingMeasurement(object.height);

    const parsedObjectType = object.object_type as ObjectType;
    this.objectType = this.objectTypes.includes(parsedObjectType) ? parsedObjectType : null;

    this.isPublic = this.coerceBoolean(object.is_public, true);
    this.isHazardous = this.coerceBoolean(object.is_hazardous, false);

    const parsedLocations = this.parseLocations(object.location);
    parsedLocations.forEach((value) => this.ensureLocationValueAvailable(value));
    this.selectedLocations = parsedLocations;
    this.previousSelectedLocations = [...this.selectedLocations];

    this.existingImages = this.resolveInitialImages(object);
    this.initialExistingImageIds = new Set(
      this.existingImages
        .map((image) => image.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    );
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

  private resolveInitialImages(object: Objekt): ExistingObjectDialogImage[] {
    const objectImages = Array.isArray(object.images) ? object.images : [];
    const normalizedImages = objectImages
      .map((image, index) => this.toExistingImageVm(image, index))
      .filter((image): image is ExistingObjectDialogImage => image !== null)
      .sort((left, right) => left.sortOrder - right.sortOrder);

    return normalizedImages;
  }

  private toExistingImageVm(image: BuildingObjectImage, fallbackSortOrder: number): ExistingObjectDialogImage | null {
    const previewUrl = this.resolveImageRecordUrl(image);
    if (!previewUrl) return null;

    return {
      id: typeof image.id === 'string' && image.id.trim().length > 0 ? image.id.trim() : null,
      fileName: this.resolveImageRecordName(image, previewUrl),
      previewUrl,
      sortOrder: Number.isInteger(Number(image.sort_order)) ? Number(image.sort_order) : fallbackSortOrder,
      sizeBytes: this.normalizeImageSize(image.image_size_bytes)
    };
  }

  private resolveImageRecordUrl(image: BuildingObjectImage): string | null {
    if (typeof image.image_url === 'string' && image.image_url.trim().length > 0) {
      return image.image_url.trim();
    }

    if (typeof image.image_path === 'string' && /^https?:\/\//i.test(image.image_path.trim())) {
      return image.image_path.trim();
    }

    return null;
  }

  private resolveImageRecordName(image: BuildingObjectImage, imageUrl: string): string {
    if (typeof image.image_original_name === 'string' && image.image_original_name.trim().length > 0) {
      return image.image_original_name.trim();
    }

    return this.resolveFileNameFromUrl(imageUrl);
  }

  private resolveFileNameFromUrl(imageUrl: string): string {
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

  private normalizeImageSize(value: unknown): number {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
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

  isFormValid(): boolean {
    const isNameValid = this.name.trim().length > 0;
    const isObjectTypeValid = !!this.objectType;
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
    const files = Array.from(input.files ?? []);

    if (files.length === 0) return;

    void this.processImageFiles(files);
    input.value = '';
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

    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length === 0) return;

    void this.processImageFiles(files);
  }

  removeSelectedImage(imageIndex: number): void {
    this.imageError = '';
    this.selectedImages = this.selectedImages.filter((_, index) => index !== imageIndex);
    this.imageChangesTouched = true;
  }

  removeExistingImageAt(imageIndex: number): void {
    this.imageError = '';
    this.existingImages = this.existingImages.filter((_, index) => index !== imageIndex);
    this.imageChangesTouched = true;
  }

  trackByExistingImage(index: number, image: ExistingObjectDialogImage): string {
    return `${image.id ?? image.previewUrl}:${index}`;
  }

  trackBySelectedImage(index: number, image: EditObjectDialogImage): string {
    return `${image.fileName}:${image.file.size}:${image.file.lastModified}:${index}`;
  }

  private async processImageFiles(files: File[]): Promise<void> {
    const nextImages: EditObjectDialogImage[] = [];
    const errors: string[] = [];
    const existingImagesSize = this.getExistingImagesSize();
    const selectedImagesSize = this.getSelectedImagesSize();
    let nextImagesSize = 0;

    for (const file of files) {
      const validationError = this.validateImageFile(file);

      if (existingImagesSize + selectedImagesSize + nextImagesSize + file.size > this.maxTotalImageSizeInBytes) {
        errors.push(`${file.name}: Bilder dürfen insgesamt maximal 100MB haben.`);
        continue;
      }

      if (validationError) {
        errors.push(`${file.name}: ${validationError}`);
        continue;
      }

      if (this.isImageAlreadySelected(file) || nextImages.some((image) => this.isSameFile(image.file, file))) {
        errors.push(`${file.name}: Datei bereits ausgewählt.`);
        continue;
      }

      try {
        const previewUrl = await this.readFileAsDataUrl(file);
        nextImages.push({
          file,
          fileName: file.name,
          previewUrl
        });
        nextImagesSize += file.size;
      } catch {
        errors.push(`${file.name}: Vorschau konnte nicht geladen werden.`);
      }
    }

    if (nextImages.length > 0) {
      this.selectedImages = [...this.selectedImages, ...nextImages];
      this.imageChangesTouched = true;
    }

    this.imageError = errors.join(' | ');
  }

  private validateImageFile(file: File): string | null {
    if (!this.allowedImageMimeTypes.includes(file.type)) {
      return 'Nur PNG, JPG, JPEG oder WEBP sind erlaubt.';
    }

    if (file.size > this.maxImageSizeInBytes) {
      return 'Datei ist zu groß. Maximal 10MB erlaubt.';
    }

    return null;
  }

  private getExistingImagesSize(): number {
    return this.existingImages.reduce((total, image) => total + image.sizeBytes, 0);
  }

  private getSelectedImagesSize(): number {
    return this.selectedImages.reduce((total, image) => total + image.file.size, 0);
  }

  private isImageAlreadySelected(file: File): boolean {
    return this.selectedImages.some((image) => this.isSameFile(image.file, file));
  }

  private isSameFile(left: File, right: File): boolean {
    return left.name === right.name && left.size === right.size && left.lastModified === right.lastModified;
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }

        reject(new Error('Invalid preview result'));
      };
      reader.onerror = () => reject(reader.error ?? new Error('Preview read failed'));
      reader.readAsDataURL(file);
    });
  }

  private normalizeOptionalInput(input: string): string | null {
    const trimmed = input.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  private normalizeIncomingMeasurement(value: unknown): number | null {
    if (typeof value !== 'number' && typeof value !== 'string') {
      return null;
    }

    const parsedValue = this.parseMeasurementInput(value);
    return parsedValue !== null && Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
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

  confirmEditObject(): void {
    if (!this.isFormValid()) return;
    if (!this.objectType) return;

    const existingImageIds = this.existingImages
      .map((image) => image.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    const result: EditObjectDialogResult = {
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
      images: [...this.selectedImages],
      existingImageIds,
      imagesChanged: this.imageChangesTouched
    };

    this.dialogRef?.close(result);
  }

  close(): void {
    this.dialogRef?.close();
  }
}
