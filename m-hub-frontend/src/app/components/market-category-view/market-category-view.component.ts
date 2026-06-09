import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';

import { MarketListingStatus } from '../../enums/market-listing-status';
import { MarketListingUnit } from '../../enums/market-listing-unit.enum';
import { MarketPotential } from '../../enums/market-potential.enum';
import { MaterialGroup, getMaterialTypesForGroup } from '../../enums/material-group';
import { MaterialType } from '../../enums/material-type.enum';
import {
  DEFAULT_MARKET_LISTING_FILTER_BOUNDS,
  MarketCategory,
  MarketListing,
  MarketListingFilter,
  MarketListingFilterBounds,
  MARKET_LISTING_PRICE_OPTIONS,
  createMarketListingFilter,
  getMarketListingPriceOptionIndex,
  normalizeMarketListingPriceRange,
  parseMarketListingNumericInput
} from '../../models/market.models';
import { MHUB_DATE_PROVIDERS } from '../../utils/mhub-date-adapter';

@Component({
  selector: 'app-market-category-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSliderModule
  ],
  providers: MHUB_DATE_PROVIDERS,
  templateUrl: './market-category-view.component.html',
  styleUrl: './market-category-view.component.scss'
})
export class MarketCategoryViewComponent implements OnChanges {
  @Input() category: MarketCategory | null = null;
  @Input() materialCategories: MarketCategory[] = [];
  @Input() objectCategories: MarketCategory[] = [];
  @Input() loading = false;
  @Input() loadError: string | null = null;
  @Input() isLoggedIn = false;
  @Input() filterBounds: MarketListingFilterBounds = DEFAULT_MARKET_LISTING_FILTER_BOUNDS;
  @Input() filter: MarketListingFilter = createMarketListingFilter(DEFAULT_MARKET_LISTING_FILTER_BOUNDS);
  @Input() activeFilterCount = 0;
  @Input() totalListingCount = 0;
  @Output() back = new EventEmitter<void>();
  @Output() categorySelect = new EventEmitter<MarketCategory>();
  @Output() filterChange = new EventEmitter<MarketListingFilter>();
  @Output() myListings = new EventEmitter<void>();
  @Output() listingSelect = new EventEmitter<MarketListing>();

  filterDraft: MarketListingFilter = createMarketListingFilter(DEFAULT_MARKET_LISTING_FILTER_BOUNDS);
  availableFromDate: Date | null = null;
  priceMinInput = '0';
  priceMaxInput = 'beliebig';
  quantityInput = '';
  priceSliderMinIndex = 0;
  priceSliderMaxIndex = MARKET_LISTING_PRICE_OPTIONS.length - 1;
  isFilterPanelVisible = false;
  readonly priceSliderOptions = MARKET_LISTING_PRICE_OPTIONS;
  readonly unitOptions = Object.values(MarketListingUnit);
  readonly statusOptions = [MarketListingStatus.eingelagert, MarketListingStatus.verbaut];
  readonly potentialOptions = Object.values(MarketPotential);
  private preserveInputTextOnNextFilterChange = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filter'] || changes['filterBounds']) {
      const shouldPreserveInputText = this.preserveInputTextOnNextFilterChange && !changes['filterBounds'];
      const priceMinInput = this.priceMinInput;
      const priceMaxInput = this.priceMaxInput;
      const quantityInput = this.quantityInput;

      this.filterDraft = this.normalizeFilterForBounds(this.filter, this.filterBounds);
      this.availableFromDate = this.parseDateOnly(this.filterDraft.availableFromMin);
      this.syncPriceControlsFromFilter();
      this.quantityInput = this.formatQuantityInputValue(this.filterDraft.quantityMin);

      if (shouldPreserveInputText) {
        this.priceMinInput = priceMinInput;
        this.priceMaxInput = priceMaxInput;
        this.quantityInput = quantityInput;
      }

      this.preserveInputTextOnNextFilterChange = false;
    }
  }

  selectCategory(category: MarketCategory): void {
    this.categorySelect.emit(category);
  }

  trackByCategoryId(_: number, item: MarketCategory): string {
    return item.id;
  }

  trackByListingId(_: number, item: MarketListing): string {
    return item.id;
  }

  selectListing(item: MarketListing): void {
    this.listingSelect.emit(item);
  }

  getDimensionValue(item: MarketListing, index: number): string {
    return item.dimensions?.[index]?.value ?? '-';
  }

  isPlaceholderImage(imageSrc: string | null | undefined): boolean {
    return imageSrc?.trim().toLowerCase().startsWith('data:image/svg+xml') ?? false;
  }

  openMyListings(): void {
    this.myListings.emit();
  }

  toggleFilterPanel(): void {
    this.isFilterPanelVisible = !this.isFilterPanelVisible;
  }

  closeFilterPanel(): void {
    this.isFilterPanelVisible = false;
  }

  getListingCountLabel(currentCategory: MarketCategory): string {
    const visibleCount = currentCategory.listings.length;

    if (this.activeFilterCount > 0) {
      return `${visibleCount} von ${this.totalListingCount} ${this.totalListingCount === 1 ? 'Anzeige' : 'Anzeigen'}`;
    }

    return `${visibleCount} ${visibleCount === 1 ? 'Anzeige' : 'Anzeigen'}`;
  }

  getEmptyStateMessage(): string {
    if (this.activeFilterCount > 0 && this.totalListingCount > 0) {
      return 'Keine Marktangebote passen zu den aktuellen Filtern.';
    }

    return 'Für diese Kategorie wurden noch keine Marktangebote inseriert.';
  }

  getPriceRangeLabel(): string {
    return `von ${this.formatPriceValue(this.filterDraft.priceMin)} bis ${this.formatPriceValue(this.filterDraft.priceMax)}`;
  }

  resetFilters(): void {
    this.filterDraft = createMarketListingFilter(this.filterBounds);
    this.availableFromDate = null;
    this.syncPriceControlsFromFilter();
    this.quantityInput = '';
    this.emitFilterChange();
  }

  isResetDisabled(): boolean {
    return this.activeFilterCount === 0 && !this.hasChangedFilterInputText();
  }

  onFilterValueChange(): void {
    this.filterDraft = this.normalizeFilterForBounds(this.filterDraft, this.filterBounds);
    this.emitFilterChange();
  }

  onPriceSliderValueChange(): void {
    const minIndex = Math.min(this.priceSliderMinIndex, this.priceSliderMaxIndex);
    const maxIndex = Math.max(this.priceSliderMinIndex, this.priceSliderMaxIndex);
    const price = normalizeMarketListingPriceRange(
      this.priceSliderOptions[minIndex],
      this.priceSliderOptions[maxIndex]
    );

    this.filterDraft = {
      ...this.filterDraft,
      priceMin: price.min,
      priceMax: price.max
    };
    this.priceSliderMinIndex = minIndex;
    this.priceSliderMaxIndex = maxIndex;
    this.syncPriceInputsFromFilter();
    this.emitFilterChange();
  }

  onPriceInputChange(): void {
    const price = normalizeMarketListingPriceRange(
      this.priceMinInput,
      this.priceMaxInput
    );

    this.filterDraft = {
      ...this.filterDraft,
      priceMin: price.min,
      priceMax: price.max
    };
    this.syncPriceSliderFromFilter();
    this.emitFilterChange(true);
  }

  onQuantityInputChange(): void {
    this.filterDraft = {
      ...this.filterDraft,
      quantityMin: this.normalizeOptionalPositiveNumber(this.quantityInput)
    };
    this.emitFilterChange(true);
  }

  onQuantityUnitSelectionChange(value: MarketListingUnit | null): void {
    this.filterDraft = {
      ...this.filterDraft,
      quantityUnit: value
    };
    this.emitFilterChange();
  }

  onAvailableFromDateChange(value: Date | null): void {
    this.availableFromDate = this.isValidDate(value) ? value : null;
    this.filterDraft = {
      ...this.filterDraft,
      availableFromMin: this.formatDateOnly(this.availableFromDate)
    };
    this.emitFilterChange();
  }

  onMaterialSelectionChange(values: MaterialType[]): void {
    this.filterDraft = {
      ...this.filterDraft,
      materials: [...values]
    };
    this.emitFilterChange();
  }

  onPotentialSelectionChange(values: MarketPotential[]): void {
    this.filterDraft = {
      ...this.filterDraft,
      potentials: [...values]
    };
    this.emitFilterChange();
  }

  onStatusSelectionChange(values: MarketListingStatus[]): void {
    this.filterDraft = {
      ...this.filterDraft,
      statuses: [...values]
    };
    this.emitFilterChange();
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

  getMaterialOptions(category: MarketCategory): readonly MaterialType[] {
    if (category.kind !== 'material') {
      return [];
    }

    const group = this.asMaterialGroup(category.title);
    return group ? getMaterialTypesForGroup(group) : [];
  }

  formatStatusLabel(value: MarketListingStatus): string {
    if (value === MarketListingStatus.eingelagert) {
      return 'Eingelagert';
    }

    if (value === MarketListingStatus.verbaut) {
      return 'Verbaut';
    }

    return value;
  }

  isPriceSliderDisabled(): boolean {
    return this.priceSliderOptions.length <= 1;
  }

  isPriceMinInputInvalid(): boolean {
    return this.isInvalidPriceInput(this.priceMinInput, false);
  }

  isPriceMaxInputInvalid(): boolean {
    return this.isInvalidPriceInput(this.priceMaxInput, true);
  }

  isQuantityInputInvalid(): boolean {
    return this.isInvalidQuantityInput(this.quantityInput);
  }

  private emitFilterChange(preserveInputText = false): void {
    this.preserveInputTextOnNextFilterChange = preserveInputText;
    this.filterChange.emit({
      ...this.filterDraft,
      materials: [...this.filterDraft.materials],
      potentials: [...this.filterDraft.potentials],
      statuses: [...this.filterDraft.statuses],
      availableFromMin: this.filterDraft.availableFromMin || null
    });
  }

  private normalizeFilterForBounds(
    filter: MarketListingFilter,
    _bounds: MarketListingFilterBounds
  ): MarketListingFilter {
    const price = normalizeMarketListingPriceRange(filter.priceMin, filter.priceMax);

    return {
      priceMin: price.min,
      priceMax: price.max,
      quantityMin: this.normalizeOptionalPositiveNumber(filter.quantityMin),
      quantityUnit: filter.quantityUnit,
      availableFromMin: filter.availableFromMin || null,
      materials: [...(filter.materials ?? [])],
      potentials: [...filter.potentials],
      statuses: [...filter.statuses],
    };
  }

  private asMaterialGroup(title: string): MaterialGroup | null {
    return (Object.values(MaterialGroup) as string[]).includes(title) ? title as MaterialGroup : null;
  }

  private normalizeOptionalPositiveNumber(value: unknown): number | null {
    const numericValue = parseMarketListingNumericInput(value);

    if (numericValue === null || !Number.isFinite(numericValue) || numericValue <= 0) {
      return null;
    }

    return numericValue;
  }

  private isInvalidPriceInput(value: string, allowUnbounded: boolean): boolean {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return false;
    }

    const numericValue = parseMarketListingNumericInput(trimmedValue);
    return numericValue === null || (!allowUnbounded && !Number.isFinite(numericValue));
  }

  private isInvalidQuantityInput(value: string): boolean {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return false;
    }

    const numericValue = parseMarketListingNumericInput(trimmedValue);
    return numericValue === null || !Number.isFinite(numericValue) || numericValue <= 0;
  }

  private parseDateOnly(value: string | null): Date | null {
    if (!value) {
      return null;
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (!match) {
      return null;
    }

    const [, year, month, day] = match;
    const numericYear = Number(year);
    const numericMonth = Number(month) - 1;
    const numericDay = Number(day);
    const parsedDate = new Date(0, numericMonth, numericDay);
    parsedDate.setFullYear(numericYear);

    return this.isValidDate(parsedDate)
      && parsedDate.getFullYear() === numericYear
      && parsedDate.getMonth() === numericMonth
      && parsedDate.getDate() === numericDay
      ? parsedDate
      : null;
  }

  private formatDateOnly(value: Date | null): string | null {
    if (!this.isValidDate(value)) {
      return null;
    }

    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0')
    ].join('-');
  }

  private isValidDate(value: Date | null): value is Date {
    return value instanceof Date && !Number.isNaN(value.getTime());
  }

  private syncPriceControlsFromFilter(): void {
    this.syncPriceInputsFromFilter();
    this.syncPriceSliderFromFilter();
  }

  private syncPriceInputsFromFilter(): void {
    this.priceMinInput = this.formatPriceInputValue(this.filterDraft.priceMin);
    this.priceMaxInput = this.formatPriceInputValue(this.filterDraft.priceMax);
  }

  private syncPriceSliderFromFilter(): void {
    this.priceSliderMinIndex = getMarketListingPriceOptionIndex(this.filterDraft.priceMin, false);
    this.priceSliderMaxIndex = getMarketListingPriceOptionIndex(this.filterDraft.priceMax, true);
  }

  private hasChangedFilterInputText(): boolean {
    const defaultFilter = createMarketListingFilter(this.filterBounds);
    const defaultPriceMin = this.formatPriceInputValue(defaultFilter.priceMin);
    const defaultPriceMax = this.formatPriceInputValue(defaultFilter.priceMax);

    return this.normalizeInputText(this.priceMinInput) !== this.normalizeInputText(defaultPriceMin)
      || this.normalizeInputText(this.priceMaxInput) !== this.normalizeInputText(defaultPriceMax)
      || this.quantityInput.trim().length > 0;
  }

  private normalizeInputText(value: string): string {
    return value.trim().toLowerCase();
  }

  private formatPriceInputValue(value: number): string {
    return Number.isFinite(value) ? String(value) : 'beliebig';
  }

  private formatPriceValue(value: number): string {
    return Number.isFinite(value) ? `${this.formatNumber(value)} €` : 'beliebig';
  }

  private formatQuantityInputValue(value: number | null): string {
    return value === null ? '' : String(value);
  }

  private formatNumber(value: number): string {
    const hasFraction = Math.abs(value % 1) > Number.EPSILON;
    return new Intl.NumberFormat('de-AT', {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2
    }).format(value);
  }

}
