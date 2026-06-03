import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { map, Observable, Subscription } from 'rxjs';

import { MATERIAL_GROUP_CATEGORIES, OBJECT_TYPE_CATEGORIES } from '../../utils/market-catalog';
import { MarketCategoryViewComponent } from '../market-category-view/market-category-view.component';
import {
  DEFAULT_MARKET_LISTING_FILTER_BOUNDS,
  MarketCategory,
  MarketListing as MarketCategoryListing,
  MarketListingFilter,
  MarketListingFilterBounds,
  MARKET_LISTING_PRICE_UNBOUNDED_MAX,
  createMarketListingFilter,
  normalizeMarketListingPriceRange,
  parseMarketListingNumericInput
} from '../../models/market.models';
import { MarketListing as ApiMarketListing } from '../../models/market-listing';
import { MarketListingCategoryCount, MarketListingService } from '../../services/market-listing/market-listing.service';
import { MaterialGroup } from '../../enums/material-group';
import { ObjectType } from '../../enums/object-type';
import { BuildingComponentCategory } from '../../enums/component-category';
import { MarketListingStatus } from '../../enums/market-listing-status';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { UserMarketListingsViewComponent } from '../user-market-listings-view/user-market-listings-view.component';
import { AuthenticationService } from '../../services/authentication/authentication.service';
import { MarketListingComponent } from '../market-listing/market-listing.component';

@Component({
  selector: 'app-market',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatDividerModule,
    MatButtonModule,
    MatIconModule,
    MarketCategoryViewComponent,
    MarketListingComponent,
    UserMarketListingsViewComponent
  ],
  templateUrl: './market.component.html',
  styleUrl: './market.component.scss'
})
export class MarketComponent implements OnInit, OnDestroy {
  readonly materialGroups = MATERIAL_GROUP_CATEGORIES;
  readonly objectTypes = OBJECT_TYPE_CATEGORIES;
  readonly isLoggedIn$: Observable<boolean>;

  selectedCategory: MarketCategory | null = null;
  categoryFilterBounds: MarketListingFilterBounds = DEFAULT_MARKET_LISTING_FILTER_BOUNDS;
  categoryFilter: MarketListingFilter = createMarketListingFilter(this.categoryFilterBounds);
  isCategoryLoading = false;
  categoryLoadError: string | null = null;
  isCategoryCountLoading = false;
  categoryCountsLoaded = false;
  isUserListingsViewVisible = false;
  activeMarketListing: ApiMarketListing | null = null;
  isMarketListingViewVisible = false;
  isMarketListingLoading = false;
  marketListingLoadError: string | null = null;

  private categoryLoadSubscription?: Subscription;
  private categoryCountSubscription?: Subscription;
  private marketListingLoadSubscription?: Subscription;
  private readonly categoryCounts = new Map<string, number>();
  private categoryApiListings: ApiMarketListing[] = [];

  constructor(
    private marketListingService: MarketListingService,
    private authService: AuthenticationService
  ) {
    this.isLoggedIn$ = this.authService.getUser$().pipe(
      map(user => !!user)
    );
  }

  ngOnInit(): void {
    this.loadCategoryCounts();
  }

  openCategory(category: MarketCategory): void {
    this.categoryLoadSubscription?.unsubscribe();
    this.selectedCategory = { ...category, listings: [] };
    this.resetCategoryFilterState();
    this.isCategoryLoading = true;
    this.categoryLoadError = null;

    const request = this.getListingsForCategory(category);

    if (!request) {
      this.isCategoryLoading = false;
      this.categoryLoadError = 'Kategorie konnte nicht geladen werden.';
      return;
    }

    this.categoryLoadSubscription = request.subscribe({
      next: listings => {
        const visibleListings = this.filterVisibleCategoryListings(listings);

        this.categoryApiListings = visibleListings;
        this.categoryFilterBounds = this.buildCategoryFilterBounds(visibleListings);
        this.categoryFilter = createMarketListingFilter(this.categoryFilterBounds);
        this.categoryCounts.set(this.getCategoryCountKey(category), visibleListings.length);
        this.renderSelectedCategoryListings(category);
        this.isCategoryLoading = false;
      },
      error: () => {
        this.selectedCategory = { ...category, listings: [] };
        this.resetCategoryFilterState();
        this.categoryLoadError = 'Marktangebote konnten nicht geladen werden.';
        this.isCategoryLoading = false;
      }
    });
  }

  closeCategory(): void {
    this.categoryLoadSubscription?.unsubscribe();
    this.selectedCategory = null;
    this.resetCategoryFilterState();
    this.isCategoryLoading = false;
    this.categoryLoadError = null;
  }

  ngOnDestroy(): void {
    this.categoryLoadSubscription?.unsubscribe();
    this.categoryCountSubscription?.unsubscribe();
    this.marketListingLoadSubscription?.unsubscribe();
  }

  trackByCategoryId(_: number, item: MarketCategory): string {
    return item.id;
  }

  formatCategoryListingCount(category: MarketCategory): string {
    const count = this.categoryCounts.get(this.getCategoryCountKey(category));

    const safeCount = count ?? 0;
    return `${safeCount} ${safeCount === 1 ? 'Inserat' : 'Inserate'}`;
  }

  get currentCategoryTotalListingCount(): number {
    return this.categoryApiListings.length;
  }

  get activeCategoryFilterCount(): number {
    return this.countActiveCategoryFilters(this.categoryFilter, this.categoryFilterBounds);
  }

  onCategoryFilterChange(filter: MarketListingFilter): void {
    this.categoryFilter = this.normalizeFilterForBounds(filter, this.categoryFilterBounds);

    if (!this.selectedCategory) {
      return;
    }

    this.renderSelectedCategoryListings(this.selectedCategory);
  }

  private loadCategoryCounts(): void {
    this.categoryCountSubscription?.unsubscribe();
    this.isCategoryCountLoading = true;
    this.categoryCountsLoaded = false;

    this.categoryCountSubscription = this.marketListingService.getMarketListingCategoryCounts().subscribe({
      next: counts => {
        this.categoryCounts.clear();

        for (const count of counts) {
          this.categoryCounts.set(this.getCategoryCountKeyFromCount(count), Number(count.count) || 0);
        }

        this.isCategoryCountLoading = false;
        this.categoryCountsLoaded = true;
      },
      error: error => {
        console.error('Error loading market listing category counts:', error);
        this.categoryCounts.clear();
        this.isCategoryCountLoading = false;
        this.categoryCountsLoaded = false;
      }
    });
  }

  private getCategoryCountKey(category: MarketCategory): string {
    return `${category.kind}:${category.title}`;
  }

  private getCategoryCountKeyFromCount(count: MarketListingCategoryCount): string {
    return `${count.kind}:${count.value}`;
  }

  private getListingsForCategory(category: MarketCategory): Observable<ApiMarketListing[]> | null {
    if (category.kind === 'material') {
      const group = this.asMaterialGroup(category.title);
      return group ? this.marketListingService.getMarketListingsByMaterialGroup(group) : null;
    }

    const objectType = this.asObjectType(category.title);
    return objectType ? this.marketListingService.getMarketListingsByObjectType(objectType) : null;
  }

  private filterVisibleCategoryListings(listings: ApiMarketListing[]): ApiMarketListing[] {
    return listings.filter(listing => listing.status !== MarketListingStatus.verkauft);
  }

  private renderSelectedCategoryListings(category: MarketCategory): void {
    const filteredListings = this.filterCategoryListings(this.categoryApiListings);

    this.selectedCategory = {
      ...category,
      listings: filteredListings.map(listing => this.mapApiListingToCategoryListing(listing, category))
    };
  }

  private filterCategoryListings(listings: ApiMarketListing[]): ApiMarketListing[] {
    return listings.filter(listing => this.matchesCategoryFilter(listing, this.categoryFilter));
  }

  private matchesCategoryFilter(
    listing: ApiMarketListing,
    filter: MarketListingFilter
  ): boolean {
    if (!this.matchesRequiredNumberRange(listing.price, filter.priceMin, filter.priceMax)) {
      return false;
    }

    if (filter.availableFromMin) {
      const listingDate = this.toDateOnlyTime(listing.available_from);
      const filterDate = this.toDateOnlyTime(filter.availableFromMin);

      if (listingDate === null || filterDate === null || listingDate < filterDate) {
        return false;
      }
    }

    if (filter.potentials.length > 0 && !filter.potentials.includes(listing.potential)) {
      return false;
    }

    if (filter.statuses.length > 0 && !filter.statuses.includes(listing.status)) {
      return false;
    }

    if (filter.quantityUnit && listing.unit !== filter.quantityUnit) {
      return false;
    }

    if (filter.quantityMin !== null && !this.matchesMinimumNumber(listing.quantity, filter.quantityMin)) {
      return false;
    }

    return true;
  }

  private buildCategoryFilterBounds(_listings: ApiMarketListing[]): MarketListingFilterBounds {
    return {
      price: { min: 0, max: MARKET_LISTING_PRICE_UNBOUNDED_MAX }
    };
  }

  private matchesRequiredNumberRange(value: unknown, min: number, max: number): boolean {
    const numericValue = this.toFiniteNumber(value);
    return numericValue !== null && numericValue >= min && numericValue <= max;
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
      potentials: [...filter.potentials],
      statuses: [...filter.statuses],
    };
  }

  private matchesMinimumNumber(value: unknown, min: number): boolean {
    const numericValue = this.toFiniteNumber(value);
    return numericValue !== null && numericValue >= min;
  }

  private normalizeOptionalPositiveNumber(value: unknown): number | null {
    const numericValue = this.toFiniteNumber(value);

    if (numericValue === null || !Number.isFinite(numericValue) || numericValue <= 0) {
      return null;
    }

    return numericValue;
  }

  private toFiniteNumber(value: unknown): number | null {
    return parseMarketListingNumericInput(value);
  }

  private toDateOnlyTime(value: string | null | undefined): number | null {
    if (!value) {
      return null;
    }

    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (!match) {
      return null;
    }

    const [, year, month, day] = match;
    return Date.UTC(Number(year), Number(month) - 1, Number(day));
  }

  private countActiveCategoryFilters(filter: MarketListingFilter, bounds: MarketListingFilterBounds): number {
    let count = 0;

    if (filter.priceMin !== bounds.price.min || filter.priceMax !== bounds.price.max) {
      count++;
    }

    if (filter.availableFromMin) {
      count++;
    }

    if (filter.potentials.length > 0) {
      count++;
    }

    if (filter.statuses.length > 0) {
      count++;
    }

    if (filter.quantityMin !== null || filter.quantityUnit !== null) {
      count++;
    }

    return count;
  }

  private resetCategoryFilterState(): void {
    this.categoryApiListings = [];
    this.categoryFilterBounds = DEFAULT_MARKET_LISTING_FILTER_BOUNDS;
    this.categoryFilter = createMarketListingFilter(this.categoryFilterBounds);
  }

  private mapApiListingToCategoryListing(listing: ApiMarketListing, category: MarketCategory): MarketCategoryListing {
    return {
      id: listing.id,
      title: listing.name,
      price: this.formatPrice(listing.price),
      quantity: this.formatListingQuantity(listing),
      quantityLabel: this.getQuantityLabel(listing),
      material: listing.component_category === BuildingComponentCategory.Bauteil ? listing.material ?? null : null,
      potential: this.formatPotential(listing.potential),
      status: this.formatStatus(listing.status),
      availableFrom: listing.available_from ? this.formatDate(listing.available_from) : null,
      dimensions: this.buildDimensions(listing),
      location: listing.location || '-',
      address: listing.address,
      imageSrc: this.getListingImageSrc(listing, category),
      imageAlt: `Bild zu ${listing.name}`
    };
  }

  private getQuantityLabel(listing: ApiMarketListing): string {
    return listing.component_category === BuildingComponentCategory.Objekt ? 'Anzahl' : 'Menge';
  }

  private getListingImageSrc(listing: ApiMarketListing, category: MarketCategory): string {
    const images = [...(listing.images ?? [])].sort((left, right) => left.sort_order - right.sort_order);
    return images[0]?.image_url || category.imageSrc;
  }

  private formatPrice(price: number): string {
    return `${this.formatNumber(price)} €`;
  }

  private formatListingQuantity(listing: ApiMarketListing): string {
    const quantity = this.formatNumber(listing.quantity);

    if (listing.component_category === BuildingComponentCategory.Objekt) {
      return `${quantity} Stück`;
    }

    return `${quantity} ${this.formatUnit(listing.unit)}`;
  }

  private buildDimensions(listing: ApiMarketListing) {
    const dimensions = [
      { label: 'Länge', rawValue: listing.length },
      { label: 'Breite', rawValue: listing.width },
      { label: 'Höhe', rawValue: listing.height }
    ]
      .map((dimension) => {
        const rawValue = typeof dimension.rawValue === 'string' ? Number(dimension.rawValue) : dimension.rawValue;
        if (typeof rawValue !== 'number' || !Number.isFinite(rawValue) || rawValue <= 0) {
          return {
            label: dimension.label,
            value: '-'
          };
        }

        return {
          label: dimension.label,
          value: `${this.formatNumber(rawValue)} cm`
        };
      });

    return dimensions;
  }

  private formatNumber(value: number): string {
    const hasFraction = Math.abs(value % 1) > Number.EPSILON;
    return new Intl.NumberFormat('de-AT', {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2
    }).format(value);
  }

  private formatDate(value: string): string {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('de-AT').format(parsed);
  }

  private formatStatus(status: string): string {
    switch (status) {
      case 'eingelagert':
        return 'Eingelagert';
      case 'verbaut':
        return 'Verbaut';
      case 'verkauft':
        return 'Verkauft';
      case 'verfuegbar':
      case 'verfügbar':
      case 'verfÃ¼gbar':
        return 'Verfuegbar';
      default:
        return status;
    }
  }

  private formatPotential(potential: string): string {
    switch (potential) {
      case 'reuse':
        return 'Reuse';
      case 'recycle':
        return 'Recycle';
      default:
        return potential;
    }
  }

  private formatUnit(unit: string): string {
    switch (unit) {
      case 'Stueck':
      case 'Stück':
      case 'StÃ¼ck':
        return 'Stück';
      case 'Quadratmeter':
        return 'm²';
      case 'Kubikmeter':
        return 'm³';
      case 'Meter':
        return 'm';
      case 'Kilogramm':
        return 'kg';
      default:
        return unit;
    }
  }

  private asMaterialGroup(title: string): MaterialGroup | null {
    return (Object.values(MaterialGroup) as string[]).includes(title) ? title as MaterialGroup : null;
  }

  private asObjectType(title: string): ObjectType | null {
    return (Object.values(ObjectType) as string[]).includes(title) ? title as ObjectType : null;
  }

  openMyListings(): void {
    this.isUserListingsViewVisible = true;
  }

  closeMyListings(): void {
    this.isUserListingsViewVisible = false;
  }

  openMarketListing(listing: Pick<ApiMarketListing, 'id'>): void {
    if (!listing?.id) {
      return;
    }

    this.marketListingLoadSubscription?.unsubscribe();
    this.activeMarketListing = null;
    this.isMarketListingViewVisible = true;
    this.isMarketListingLoading = true;
    this.marketListingLoadError = null;

    this.marketListingLoadSubscription = this.marketListingService.getMarketListingById(listing.id).subscribe({
      next: marketListing => {
        this.activeMarketListing = marketListing;
        this.isMarketListingLoading = false;
      },
      error: error => {
        console.error('Error loading market listing:', error);
        this.activeMarketListing = null;
        this.isMarketListingLoading = false;
        this.marketListingLoadError = 'Marktinserat konnte nicht geladen werden.';
      }
    });
  }

  closeMarketListing(): void {
    this.marketListingLoadSubscription?.unsubscribe();
    this.activeMarketListing = null;
    this.isMarketListingViewVisible = false;
    this.isMarketListingLoading = false;
    this.marketListingLoadError = null;
  }

  onUserListingDeleted(deletedListing: ApiMarketListing): void {
    this.loadCategoryCounts();

    if (this.activeMarketListing?.id === deletedListing.id) {
      this.closeMarketListing();
    }

    if (!this.selectedCategory) {
      return;
    }

    const listings = this.categoryApiListings.filter(listing => listing.id !== deletedListing.id);

    if (listings.length === this.categoryApiListings.length) {
      return;
    }

    this.categoryApiListings = listings;
    this.categoryFilterBounds = this.buildCategoryFilterBounds(this.categoryApiListings);
    this.categoryFilter = this.normalizeFilterForBounds(this.categoryFilter, this.categoryFilterBounds);
    this.renderSelectedCategoryListings(this.selectedCategory);
    this.categoryCounts.set(this.getCategoryCountKey(this.selectedCategory), this.categoryApiListings.length);
  }

  onUserListingUpdated(): void {
    this.loadCategoryCounts();

    if (this.selectedCategory) {
      this.openCategory(this.selectedCategory);
    }
  }
  
}
