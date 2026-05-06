import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
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
import { MatTooltipModule } from '@angular/material/tooltip';
import { take } from 'rxjs';
import { BuildingComponentCategory } from '../../../enums/component-category';
import { MarketListingUnit } from '../../../enums/market-listing-unit.enum';
import { MarketListingStatus } from '../../../enums/market-listing-status';
import { MarketPotential } from '../../../enums/market-potential.enum';
import { MaterialType } from '../../../enums/material-type.enum';
import { Bauteil, Objekt } from '../../../models/building-component';
import { PartStructure } from '../../../models/part-structure';
import { AuthenticationService } from '../../../services/authentication/authentication.service';

export type AddListingDialogData = {
  component: Bauteil | Objekt;
};

export type AddListingDialogImage = {
  file: File;
  fileName: string;
  previewUrl: string;
};

export type AddListingDialogResult = {
  name: string;
  description: string | null;
  price: number;
  status: MarketListingStatus;
  availableFrom: string;
  potential: MarketPotential;
  material: MaterialType | null;
  quantity: number;
  unit: MarketListingUnit;
  length: number | null;
  width: number | null;
  height: number | null;
  contact: string;
  images: AddListingDialogImage[];
};

type MeasurementInput = number | string | null;

@Component({
  selector: 'app-add-listing-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDividerModule,
    DragDropModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './add-listing-dialog.component.html',
  styleUrl: './add-listing-dialog.component.scss'
})
export class AddListingDialogComponent {
  readonly statusOptions: MarketListingStatus[] = Object
    .values(MarketListingStatus)
    .filter((status) => status !== MarketListingStatus.verkauft);
  readonly potentialOptions: MarketPotential[] = Object.values(MarketPotential);
  readonly unitOptions: MarketListingUnit[] = Object.values(MarketListingUnit);
  readonly objectUnit = MarketListingUnit.St;
  private readonly materialTypeValues = new Set<MaterialType>(Object.values(MaterialType));
  readonly allowedImageMimeTypes: string[] = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  readonly maxImageSizeInBytes = 10 * 1024 * 1024;        // 10 MB Upload limit per image
  readonly maxTotalImageSizeInBytes = 100 * 1024 * 1024;  // 100 MB total Upload limit

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
  availableMaterials: MaterialType[] = [];
  isDragActive = false;
  imageError = '';
  selectedImages: AddListingDialogImage[] = [];
  readonly positiveMeasurementPattern = '^(?:[1-9]\\d*(?:[.,]\\d+)?|0[.,]\\d*[1-9]\\d*)$';

  constructor(
    @Optional() public dialogRef: MatDialogRef<AddListingDialogComponent> | null,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: AddListingDialogData | null,
    private authService: AuthenticationService
  ) {
    const component = data?.component ?? null;

    if (component?.category === BuildingComponentCategory.Objekt) {
      const object = component as Objekt;
      this.name = component.name?.trim() ?? '';
      this.description = component.description?.trim() ?? '';
      this.length = this.normalizeIncomingMeasurement(object.length);
      this.width = this.normalizeIncomingMeasurement(object.width);
      this.height = this.normalizeIncomingMeasurement(object.height);
    }

    this.availableMaterials = this.extractAvailableMaterials(component);
    if (this.availableMaterials.length === 1) {
      this.material = this.availableMaterials[0];
    }

    this.initializeQuantityAndUnit(component);

    this.authService.getUser$().pipe(take(1)).subscribe((user) => {
      this.contact = user?.email?.trim() ?? '';
    });
  }

  get isPart(): boolean {
    return this.data?.component?.category === BuildingComponentCategory.Bauteil;
  }

  get isObject(): boolean {
    return this.data?.component?.category === BuildingComponentCategory.Objekt;
  }

  get hasMeasurementFields(): boolean {
    return this.isObject || this.isPart;
  }

  getNameError(): string | null {
    if (this.name.trim().length === 0) {
      return 'Name erforderlich';
    }

    return null;
  }

  getPriceError(): string | null {
    if (this.price === null || this.price === undefined || Number.isNaN(Number(this.price))) {
      return 'Preis erforderlich';
    }

    if (Number(this.price) < 0) {
      return 'Preis darf nicht negativ sein';
    }

    return null;
  }

  getStatusError(): string | null {
    if (!this.status) {
      return 'Status erforderlich';
    }

    return null;
  }

  getMaterialError(): string | null {
    if (!this.isPart || this.availableMaterials.length === 0) {
      return null;
    }

    if (!this.material) {
      return 'Material erforderlich';
    }

    return null;
  }

  getQuantityError(): string | null {
    if (this.quantity === null || this.quantity === undefined || Number.isNaN(Number(this.quantity))) {
      return 'Menge erforderlich';
    }

    const parsedQuantity = Number(this.quantity);
    if (parsedQuantity < 0) {
      return 'Menge/Anzahl darf nicht negativ sein';
    }

    if (parsedQuantity === 0) {
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
    if (this.isObject) {
      return null;
    }

    if (!this.unit) {
      return 'Einheit erforderlich';
    }

    return null;
  }

  getPotentialError(): string | null {
    if (!this.potential) {
      return 'Potential erforderlich';
    }

    return null;
  }

  getAvailableFromError(): string | null {
    if (!this.availableFrom) {
      return 'Datum erforderlich';
    }

    return null;
  }

  getContactError(): string | null {
    if (this.contact.trim().length === 0) {
      return 'Kontakt erforderlich';
    }

    return null;
  }

  isFormValid(): boolean {
    const isNameValid = this.name.trim().length > 0;
    const isPriceValid = this.price !== null && this.price !== undefined && !Number.isNaN(Number(this.price)) && Number(this.price) >= 0;
    const isStatusValid = !!this.status;
    const isAvailableFromValid = !!this.availableFrom;
    const isPotentialValid = !!this.potential;
    const isMaterialValid = !this.isPart || this.availableMaterials.length === 0 || !!this.material;
    const isQuantityValid = this.getQuantityError() === null;
    const isUnitValid = this.isObject || !!this.unit;
    const areMeasurementsValid = [
      this.isOptionalMeasurementValid(this.length),
      this.isOptionalMeasurementValid(this.width),
      this.isOptionalMeasurementValid(this.height)
    ].every(Boolean);
    const isContactValid = this.contact.trim().length > 0;

    return isNameValid
      && isPriceValid
      && isStatusValid
      && isAvailableFromValid
      && isPotentialValid
      && isMaterialValid
      && isQuantityValid
      && isUnitValid
      && areMeasurementsValid
      && isContactValid;
  }

  confirmAddListing(): void {
    if (!this.isFormValid()) return;
    if (!this.status || !this.availableFrom || !this.potential || this.price === null || this.price === undefined || this.quantity === null || this.quantity === undefined) return;

    const resolvedUnit = this.resolveSelectedUnit();
    if (!resolvedUnit) return;

    const result: AddListingDialogResult = {
      name: this.name.trim(),
      description: this.normalizeOptionalInput(this.description),
      price: Number(this.price),
      status: this.status,
      availableFrom: this.formatDateForPayload(this.availableFrom),
      potential: this.potential,
      material: this.isPart ? this.material : null,
      quantity: Number(this.quantity),
      unit: resolvedUnit,
      length: this.normalizeOptionalMeasurement(this.length),
      width: this.normalizeOptionalMeasurement(this.width),
      height: this.normalizeOptionalMeasurement(this.height),
      contact: this.contact.trim(),
      images: [...this.selectedImages]
    };

    this.dialogRef?.close(result);
  }

  close(): void {
    this.dialogRef?.close();
  }

  formatPotentialLabel(value: MarketPotential): string {
    if (value === MarketPotential.reuse) {
      return 'Wiederverwendung';
    }

    if (value === MarketPotential.recycle) {
      return 'Recycling';
    }

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
  }

  dropSelectedImage(event: CdkDragDrop<AddListingDialogImage[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    moveItemInArray(this.selectedImages, event.previousIndex, event.currentIndex);
  }

  moveSelectedImage(imageIndex: number, direction: -1 | 1): void {
    const nextIndex = imageIndex + direction;
    if (nextIndex < 0 || nextIndex >= this.selectedImages.length) return;
    moveItemInArray(this.selectedImages, imageIndex, nextIndex);
  }

  trackBySelectedImage(index: number, image: AddListingDialogImage): string {
    return `${image.fileName}:${image.file.size}:${image.file.lastModified}:${index}`;
  }

  private initializeQuantityAndUnit(component: Bauteil | Objekt | null): void {
    if (!component) return;

    if (component.category === BuildingComponentCategory.Objekt) {
      const object = component as Objekt;
      this.quantity = Number.isInteger(Number(object.count)) && Number(object.count) > 0 ? Number(object.count) : null;
      this.unit = this.objectUnit;
      return;
    }

    const part = component as Bauteil;
    const structure = part.part_structure as PartStructure | null | undefined;
    if (!structure) return;

    if (structure.type === 'wall') {
      this.quantity = this.normalizePartQuantity(structure.length);
      if (this.quantity !== null) {
        this.unit = MarketListingUnit.m;
      }
      return;
    }

    if (structure.type === 'slab') {
      this.quantity = this.normalizePartQuantity(structure.area);
      if (this.quantity !== null) {
        this.unit = MarketListingUnit.m2;
      }
    }
  }

  private extractAvailableMaterials(component: Bauteil | Objekt | null): MaterialType[] {
    if (!component || component.category !== BuildingComponentCategory.Bauteil) {
      return [];
    }

    const part = component as Bauteil;
    const seen = new Set<MaterialType>();

    return (part.part_structure?.layers ?? [])
      .map((layer) => layer.material)
      .filter((material): material is MaterialType => typeof material === 'string' && this.materialTypeValues.has(material as MaterialType))
      .filter((material) => {
        if (seen.has(material)) {
          return false;
        }

        seen.add(material);
        return true;
      });
  }

  private normalizePartQuantity(value: number | null | undefined): number | null {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return null;
    }

    return Number(Number(value).toFixed(2));
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

  private hasAtMostTwoDecimalPlaces(value: number): boolean {
    const scaled = value * 100;
    return Math.abs(scaled - Math.round(scaled)) < 0.0000001;
  }

  private async processImageFiles(files: File[]): Promise<void> {
    const nextImages: AddListingDialogImage[] = [];
    const errors: string[] = [];
    const selectedImagesSize = this.getSelectedImagesSize();
    let nextImagesSize = 0;

    for (const file of files) {
      const validationError = this.validateImageFile(file);

      if (selectedImagesSize + nextImagesSize + file.size > this.maxTotalImageSizeInBytes) {
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
    }

    this.imageError = errors.join(' | ');
  }

  private validateImageFile(file: File): string | null {
    if (!this.allowedImageMimeTypes.includes(file.type)) {
      return 'Nur PNG, JPG, JPEG oder WEBP sind erlaubt.';
    }

    if (file.size > this.maxImageSizeInBytes) {
      return 'Datei ist zu groß. Maximal 20MB erlaubt.';
    }

    return null;
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

  private resolveSelectedUnit(): MarketListingUnit | null {
    if (this.isObject) {
      return this.objectUnit;
    }

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
