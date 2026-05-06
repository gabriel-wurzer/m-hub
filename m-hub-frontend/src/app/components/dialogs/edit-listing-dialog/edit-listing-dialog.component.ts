import { CommonModule } from '@angular/common';
import { Component, Inject, Optional } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { BuildingComponentCategory } from '../../../enums/component-category';
import { MarketListingStatus } from '../../../enums/market-listing-status';
import { MarketListingUnit } from '../../../enums/market-listing-unit.enum';
import { MarketPotential } from '../../../enums/market-potential.enum';
import { MaterialType } from '../../../enums/material-type.enum';
import { MarketListing, MarketListingImage, UpdateMarketListing } from '../../../models/market-listing';
import { AddListingDialogImage } from '../add-listing-dialog/add-listing-dialog.component';

export type EditListingDialogData = {
  listing: MarketListing;
};

export type EditListingDialogResult = UpdateMarketListing;

type MeasurementInput = number | string | null;

type ExistingListingDialogImage = {
  id: string | null;
  fileName: string;
  previewUrl: string;
  sortOrder: number;
  sizeBytes: number;
};

@Component({
  selector: 'app-edit-listing-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './edit-listing-dialog.component.html',
  styleUrl: './edit-listing-dialog.component.scss'
})
export class EditListingDialogComponent {
  readonly statusOptions: MarketListingStatus[] = Object.values(MarketListingStatus);
  readonly potentialOptions: MarketPotential[] = Object.values(MarketPotential);
  readonly unitOptions: MarketListingUnit[] = Object.values(MarketListingUnit);
  readonly materialOptions: MaterialType[] = Object.values(MaterialType);
  readonly objectUnit = MarketListingUnit.St;
  readonly allowedImageMimeTypes: string[] = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  readonly maxImageSizeInBytes = 10 * 1024 * 1024;
  readonly maxTotalImageSizeInBytes = 100 * 1024 * 1024;
  readonly positiveMeasurementPattern = '^(?:[1-9]\\d*(?:[.,]\\d+)?|0[.,]\\d*[1-9]\\d*)$';

  name = '';
  description = '';
  price: number | null = null;
  status: MarketListingStatus | null = null;
  availableFrom: Date | null = null;
  potential: MarketPotential | null = null;
  material: MaterialType | null = null;
  quantity: number | null = null;
  unit: MarketListingUnit | null = null;
  length: MeasurementInput = null;
  width: MeasurementInput = null;
  height: MeasurementInput = null;
  contact = '';
  isDragActive = false;
  imageError = '';
  existingImages: ExistingListingDialogImage[] = [];
  selectedImages: AddListingDialogImage[] = [];

  private imageChangesTouched = false;

  constructor(
    @Optional() public dialogRef: MatDialogRef<EditListingDialogComponent> | null,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: EditListingDialogData | null
  ) {
    const listing = data?.listing ?? null;
    if (!listing) return;

    this.name = listing.name?.trim() ?? '';
    this.description = listing.description?.trim() ?? '';
    this.price = this.normalizeIncomingNumber(listing.price);
    this.status = listing.status ?? null;
    this.availableFrom = this.parseIncomingDate(listing.available_from);
    this.potential = listing.potential ?? null;
    this.material = listing.material ?? null;
    this.quantity = this.normalizeIncomingNumber(listing.quantity);
    this.unit = listing.component_category === BuildingComponentCategory.Objekt
      ? this.objectUnit
      : listing.unit ?? null;
    this.length = this.normalizeIncomingMeasurement(listing.length);
    this.width = this.normalizeIncomingMeasurement(listing.width);
    this.height = this.normalizeIncomingMeasurement(listing.height);
    this.contact = listing.contact?.trim() ?? '';
    this.existingImages = this.resolveInitialImages(listing);
  }

  get listing(): MarketListing | null {
    return this.data?.listing ?? null;
  }

  get isPart(): boolean {
    return this.listing?.component_category === BuildingComponentCategory.Bauteil;
  }

  get isObject(): boolean {
    return this.listing?.component_category === BuildingComponentCategory.Objekt;
  }

  get hasMeasurementFields(): boolean {
    return this.isObject || this.isPart;
  }

  getNameError(): string | null {
    return this.name.trim().length === 0 ? 'Name erforderlich' : null;
  }

  getPriceError(): string | null {
    if (this.price === null || this.price === undefined || Number.isNaN(Number(this.price))) {
      return 'Preis erforderlich';
    }

    return Number(this.price) < 0 ? 'Preis darf nicht negativ sein' : null;
  }

  getStatusError(): string | null {
    return this.status ? null : 'Status erforderlich';
  }

  getMaterialError(): string | null {
    if (!this.isPart) return null;
    return this.material ? null : 'Material erforderlich';
  }

  getQuantityError(): string | null {
    if (this.quantity === null || this.quantity === undefined || Number.isNaN(Number(this.quantity))) {
      return 'Menge erforderlich';
    }

    const parsedQuantity = Number(this.quantity);
    if (parsedQuantity <= 0) {
      return 'Menge/Anzahl muss größer als 0 sein';
    }

    if (this.isPart && !this.hasAtMostTwoDecimalPlaces(parsedQuantity)) {
      return 'Für Bauteile sind maximal zwei Nachkommastellen erlaubt';
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

  getUnitError(): string | null {
    if (this.isObject) return null;
    return this.unit ? null : 'Einheit erforderlich';
  }

  getPotentialError(): string | null {
    return this.potential ? null : 'Potential erforderlich';
  }

  getAvailableFromError(): string | null {
    return this.availableFrom ? null : 'Datum erforderlich';
  }

  getContactError(): string | null {
    return this.contact.trim().length === 0 ? 'Kontakt erforderlich' : null;
  }

  isFormValid(): boolean {
    return this.getNameError() === null
      && this.getPriceError() === null
      && this.getStatusError() === null
      && this.getAvailableFromError() === null
      && this.getPotentialError() === null
      && this.getMaterialError() === null
      && this.getQuantityError() === null
      && this.getUnitError() === null
      && this.getLengthError() === null
      && this.getWidthError() === null
      && this.getHeightError() === null
      && this.getContactError() === null;
  }

  confirmEditListing(): void {
    if (!this.isFormValid()) return;
    if (!this.status || !this.availableFrom || !this.potential || this.price === null || this.quantity === null) return;

    const resolvedUnit = this.resolveSelectedUnit();
    if (!resolvedUnit) return;

    const payload: UpdateMarketListing = {
      name: this.name.trim(),
      description: this.normalizeOptionalInput(this.description) ?? undefined,
      price: Number(this.price),
      status: this.status,
      available_from: this.formatDateForPayload(this.availableFrom),
      potential: this.potential,
      material: this.isPart ? this.material ?? undefined : undefined,
      object_type: this.isObject ? this.listing?.object_type : undefined,
      quantity: Number(this.quantity),
      unit: resolvedUnit,
      length: this.normalizeOptionalMeasurement(this.length),
      width: this.normalizeOptionalMeasurement(this.width),
      height: this.normalizeOptionalMeasurement(this.height),
      contact: this.contact.trim()
    };

    if (this.selectedImages.length > 0) {
      payload.images = this.selectedImages.map((image, index) => ({
        image_data_url: image.previewUrl,
        image_mime_type: image.file.type || undefined,
        image_original_name: image.fileName || image.file.name || undefined,
        sort_order: this.existingImages.length + index
      }));
    }

    if (this.imageChangesTouched) {
      const existingImageIds = this.existingImages
        .map((image) => image.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);

      payload.existing_image_ids = existingImageIds;

      if (existingImageIds.length === 0 && this.selectedImages.length === 0) {
        payload.remove_images = true;
      }
    }

    this.dialogRef?.close(payload);
  }

  close(): void {
    this.dialogRef?.close();
  }

  formatPotentialLabel(value: MarketPotential): string {
    if (value === MarketPotential.reuse) return 'Wiederverwendung';
    if (value === MarketPotential.recycle) return 'Recycling';
    return value;
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

  trackBySelectedImage(index: number, image: AddListingDialogImage): string {
    return `${image.fileName}:${image.file.size}:${image.file.lastModified}:${index}`;
  }

  removeExistingImageAt(imageIndex: number): void {
    this.imageError = '';
    this.existingImages = this.existingImages.filter((_, index) => index !== imageIndex);
    this.imageChangesTouched = true;
  }

  trackByExistingImage(index: number, image: ExistingListingDialogImage): string {
    return `${image.id ?? image.previewUrl}:${index}`;
  }

  private resolveInitialImages(listing: MarketListing): ExistingListingDialogImage[] {
    return [...(listing.images ?? [])]
      .map((image, index) => this.toExistingImageVm(image, index))
      .filter((image): image is ExistingListingDialogImage => image !== null)
      .sort((left, right) => left.sortOrder - right.sortOrder);
  }

  private toExistingImageVm(image: MarketListingImage, fallbackSortOrder: number): ExistingListingDialogImage | null {
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

  private resolveImageRecordUrl(image: MarketListingImage): string | null {
    if (typeof image.image_url === 'string' && image.image_url.trim().length > 0) {
      return image.image_url.trim();
    }

    if (typeof image.image_path === 'string' && /^https?:\/\//i.test(image.image_path.trim())) {
      return image.image_path.trim();
    }

    return null;
  }

  private resolveImageRecordName(image: MarketListingImage, imageUrl: string): string {
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

  private normalizeIncomingNumber(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return null;
    }

    return Number(value);
  }

  private normalizeIncomingMeasurement(value: unknown): number | null {
    if (typeof value !== 'number' && typeof value !== 'string') {
      return null;
    }

    const parsedValue = this.parseMeasurementInput(value);
    return parsedValue !== null && Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
  }

  private parseIncomingDate(value: string | null | undefined): Date | null {
    if (!value) return null;

    const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private getMeasurementError(label: string, value: MeasurementInput): string | null {
    const parsedValue = this.parseMeasurementInput(value);
    if (parsedValue === null) return null;
    if (!Number.isFinite(parsedValue)) return `${label} muss eine Zahl sein`;
    if (parsedValue <= 0) return `${label} muss größer 0 sein`;
    return null;
  }

  private normalizeOptionalMeasurement(value: MeasurementInput): number | null {
    const parsedValue = this.parseMeasurementInput(value);
    return parsedValue !== null && Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
  }

  private parseMeasurementInput(value: MeasurementInput): number | null {
    if (value === null || value === undefined) return null;

    if (typeof value === 'number') {
      return value;
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) return null;

    const parsedValue = Number(trimmed.replace(',', '.'));
    return Number.isFinite(parsedValue) ? parsedValue : Number.NaN;
  }

  private hasAtMostTwoDecimalPlaces(value: number): boolean {
    const scaled = value * 100;
    return Math.abs(scaled - Math.round(scaled)) < 0.0000001;
  }

  private async processImageFiles(files: File[]): Promise<void> {
    const nextImages: AddListingDialogImage[] = [];
    const errors: string[] = [];
    const existingImagesSize = this.getExistingImagesSize();
    const selectedImagesSize = this.getSelectedImagesSize();
    let nextImagesSize = 0;

    for (const file of files) {
      const validationError = this.validateImageFile(file);

      if (existingImagesSize + selectedImagesSize + nextImagesSize + file.size > this.maxTotalImageSizeInBytes) {
        errors.push(`Bilder dürfen insgesamt maximal 100MB haben.`);
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

  private getSelectedImagesSize(): number {
    return this.selectedImages.reduce((total, image) => total + image.file.size, 0);
  }

  private getExistingImagesSize(): number {
    return this.existingImages.reduce((total, image) => total + image.sizeBytes, 0);
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

  private resolveSelectedUnit(): MarketListingUnit | null {
    if (this.isObject) return this.objectUnit;
    return this.unit;
  }

  private formatDateForPayload(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private normalizeOptionalInput(input: string): string | null {
    const trimmed = input.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
}
