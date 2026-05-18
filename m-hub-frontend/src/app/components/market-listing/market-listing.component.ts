import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';

import { BuildingComponentCategory } from '../../enums/component-category';
import { MarketListingStatus } from '../../enums/market-listing-status';
import { MarketListingUnit } from '../../enums/market-listing-unit.enum';
import { MarketListing } from '../../models/market-listing';
import { MarketListingMapPreviewComponent } from '../market-listing-map-preview/market-listing-map-preview.component';

type ListingImageVm = {
  key: string;
  url: string;
  label: string;
  sortOrder: number;
  fit?: 'cover' | 'contain';
};

@Component({
  selector: 'app-market-listing',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MarketListingMapPreviewComponent
  ],
  templateUrl: './market-listing.component.html',
  styleUrl: './market-listing.component.scss'
})
export class MarketListingComponent implements OnChanges {
  @Input() listing: MarketListing | null = null;
  @Input() loading = false;
  @Input() loadError: string | null = null;
  @Output() closeMarketListing = new EventEmitter<void>();

  listingImages: ListingImageVm[] = [];
  activeListingImageIndex = 0;

  constructor(private router: Router) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['listing']) {
      this.listingImages = this.resolveListingImages();
      this.activeListingImageIndex = 0;
    }
  }

  get currentListingImage(): ListingImageVm | null {
    return this.listingImages[this.activeListingImageIndex] ?? this.listingImages[0] ?? null;
  }

  getListingTypeLabel(listing: MarketListing): string {
    return listing.component_category === BuildingComponentCategory.Objekt ? 'Kategorie' : 'Material';
  }

  getListingType(listing: MarketListing): string {
    return listing.component_category === BuildingComponentCategory.Objekt
      ? listing.object_type || '-'
      : listing.material || '-';
  }

  getQuantityLabel(listing: MarketListing): string {
    return listing.component_category === BuildingComponentCategory.Objekt ? 'Anzahl' : 'Menge';
  }

  getQuantityValue(listing: MarketListing): string {
    const quantity = this.formatNumber(listing.quantity);

    if (listing.component_category === BuildingComponentCategory.Objekt) {
      return `${quantity} Stück`;
    }

    return `${quantity} ${this.formatUnit(listing.unit)}`;
  }

  getDimensionValue(value: number | string | null | undefined): string {
    const numericValue = typeof value === 'string' ? Number(value) : value;

    if (typeof numericValue !== 'number' || !Number.isFinite(numericValue) || numericValue <= 0) {
      return '-';
    }

    return `${this.formatNumber(numericValue)} cm`;
  }

  formatPrice(price: number): string {
    return `${this.formatNumber(price)} EUR`;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('de-AT').format(parsed);
  }

  formatStatus(status: string | null | undefined): string {
    switch (status) {
      case MarketListingStatus.eingelagert:
        return 'Eingelagert';
      case MarketListingStatus.verbaut:
        return 'Verbaut';
      case MarketListingStatus.verkauft:
        return 'Verkauft';
      default:
        return status || '-';
    }
  }

  getStatusTagValue(status: string | null | undefined): string {
    switch (status) {
      case MarketListingStatus.eingelagert:
      case MarketListingStatus.verbaut:
        return 'Aktiv';
      case MarketListingStatus.verkauft:
        return 'Verkauft';
      default:
        return status || '-';
    }
  }

  isInactiveStatus(status: string | null | undefined): boolean {
    return status === MarketListingStatus.verkauft;
  }

  formatPotential(potential: string | null | undefined): string {
    switch (potential) {
      case 'reuse':
        return 'Reuse';
      case 'recycle':
        return 'Recycle';
      default:
        return potential || '-';
    }
  }

  openBuildingOnMap(): void {
    if (!this.listing?.building_id) {
      return;
    }

    this.router.navigate(['/map'], {
      queryParams: {
        buildingId: this.listing.building_id
      }
    });
  }

  hasMultipleListingImages(): boolean {
    return this.listingImages.length > 1;
  }

  showPreviousListingImage(): void {
    this.selectListingImage(this.activeListingImageIndex - 1);
  }

  showNextListingImage(): void {
    this.selectListingImage(this.activeListingImageIndex + 1);
  }

  selectListingImage(index: number): void {
    if (this.listingImages.length === 0) return;

    this.activeListingImageIndex = (index + this.listingImages.length) % this.listingImages.length;
  }

  onListingImageLoad(image: ListingImageVm, event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (!target || target.naturalWidth <= 0 || target.naturalHeight <= 0) return;

    image.fit = target.naturalHeight > target.naturalWidth * 1.08 ? 'contain' : 'cover';
  }

  trackByListingImage(_: number, image: ListingImageVm): string {
    return image.key;
  }

  private formatNumber(value: number | string | null | undefined): string {
    const numericValue = typeof value === 'string' ? Number(value) : value;

    if (typeof numericValue !== 'number' || !Number.isFinite(numericValue)) {
      return '-';
    }

    const hasFraction = Math.abs(numericValue % 1) > Number.EPSILON;
    return new Intl.NumberFormat('de-AT', {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2
    }).format(numericValue);
  }

  private formatUnit(unit: string): string {
    switch (unit) {
      case MarketListingUnit.St:
        return 'Stueck';
      case 'Quadratmeter':
        return 'm2';
      case 'Kubikmeter':
        return 'm3';
      case 'Meter':
        return 'm';
      case 'Kilogramm':
        return 'kg';
      default:
        return unit;
    }
  }

  private resolveListingImages(): ListingImageVm[] {
    const images = this.listing?.images;
    if (!Array.isArray(images)) return [];

    return images
      .map((image, index) => {
        const url = image.image_url || (/^https?:\/\//i.test(image.image_path ?? '') ? image.image_path : null);
        if (!url) return null;

        return {
          key: image.id || `${url}:${index}`,
          url,
          label: image.image_original_name || `Inseratsbild ${index + 1}`,
          sortOrder: Number.isInteger(image.sort_order) ? image.sort_order : index
        };
      })
      .filter((image): image is ListingImageVm => image !== null)
      .sort((left, right) => left.sortOrder - right.sortOrder);
  }

}
