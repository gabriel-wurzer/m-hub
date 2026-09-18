import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { BuildingComponentCategory } from '../../enums/component-category';
import { MarketListingStatus } from '../../enums/market-listing-status';
import { MarketListingUnit } from '../../enums/market-listing-unit.enum';
import { MarketListing, SimilarMarketListing } from '../../models/market-listing';
import { MarketListingMedia, MarketListingService, SimilarMarketListingRadius } from '../../services/market-listing/market-listing.service';
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
    MatButtonToggleModule,
    MatDividerModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MarketListingMapPreviewComponent
  ],
  templateUrl: './market-listing.component.html',
  styleUrl: './market-listing.component.scss'
})
export class MarketListingComponent implements OnChanges, OnDestroy {
  @Input() listing: MarketListing | null = null;

  /** Medien am Inserat: Splats, Punktwolken, IFC, PDFs. Bilder laufen weiter ueber listing.images. */
  media: MarketListingMedia[] = [];
  private mediaSubscription?: Subscription;

  private readonly splatTypes = new Set(['ply', 'spz', 'splat', 'ksplat', 'sog']);
  private readonly ifcTypes = new Set(['ifc']);
  private readonly pointCloudTypes = new Set(['xyz', 'pts']);
  @Input() loading = false;
  @Input() loadError: string | null = null;
  @Output() closeMarketListing = new EventEmitter<void>();
  @Output() similarListingSelect = new EventEmitter<Pick<MarketListing, 'id'>>();

  listingImages: ListingImageVm[] = [];
  activeListingImageIndex = 0;
  similarListings: SimilarMarketListing[] = [];
  selectedSimilarListingDistance: SimilarMarketListingRadius = 500;
  readonly similarListingDistances: SimilarMarketListingRadius[] = [500, 1000, 2000];
  similarListingsLoading = false;
  similarListingsError: string | null = null;

  private similarListingsSubscription?: Subscription;

  constructor(
    private router: Router,
    private marketListingService: MarketListingService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['listing']) {
      this.listingImages = this.resolveListingImages();
      this.activeListingImageIndex = 0;
      this.loadSimilarListings();
      this.loadMedia();
    }
  }

  ngOnDestroy(): void {
    this.similarListingsSubscription?.unsubscribe();
    this.mediaSubscription?.unsubscribe();
  }

  private loadMedia(): void {
    this.mediaSubscription?.unsubscribe();
    this.media = [];
    const id = this.listing?.id;
    if (!id) return;
    this.mediaSubscription = this.marketListingService.getMedia(id).subscribe({
      next: media => {
        this.media = media ?? [];
        this.listingImages = this.resolveListingImages();
      },
      error: () => {
        this.media = [];
        this.listingImages = this.resolveListingImages();
      }
    });
  }

  /** Ausliefernder Pfad im Filer, gleiche Regel wie in der Gebaeudeansicht. */
  mediaUrl(medium: MarketListingMedia): string {
    return `/files${medium.file_path}`;
  }

  is3dViewable(medium: MarketListingMedia): boolean {
    const t = (medium.file_type ?? '').toLowerCase();
    return this.splatTypes.has(t) || this.ifcTypes.has(t) || this.pointCloudTypes.has(t);
  }

  viewerUrl(medium: MarketListingMedia): string {
    const t = (medium.file_type ?? '').toLowerCase();
    let viewer = 'splat-viewer';
    if (this.ifcTypes.has(t)) viewer = 'ifc-viewer';
    else if (this.pointCloudTypes.has(t)) viewer = 'pointcloud-viewer';
    return `assets/${viewer}/index.html?src=${encodeURIComponent(this.mediaUrl(medium))}`;
  }

  /** PDFs und Bilder zeigt der Browser selbst, dafuer braucht es keinen Download. */
  isInlineViewable(medium: MarketListingMedia): boolean {
    const t = (medium.file_type ?? '').toLowerCase();
    return t === 'pdf' || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'svg', 'webp'].includes(t);
  }

  mediaIcon(medium: MarketListingMedia): string {
    const t = (medium.file_type ?? '').toLowerCase();
    if (this.is3dViewable(medium)) return 'view_in_ar';
    if (t === 'pdf') return 'picture_as_pdf';
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'svg', 'webp'].includes(t)) return 'image';
    return 'insert_drive_file';
  }

  mediaSize(medium: MarketListingMedia): string {
    const b = Number(medium.file_size_bytes ?? 0);
    if (!b) return '';
    return b >= 1048576
      ? `${(b / 1048576).toLocaleString('de-AT', { maximumFractionDigits: 1 })} MB`
      : `${Math.round(b / 1024)} KB`;
  }

  trackByMediaId(_: number, medium: MarketListingMedia): string {
    return medium.id;
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
    return `${this.formatNumber(price)} €`;
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

    this.router.navigate(['/karte'], {
      queryParams: {
        buildingId: this.listing.building_id
      }
    });
  }

  selectSimilarListingDistance(distance: SimilarMarketListingRadius): void {
    if (!this.similarListingDistances.includes(distance)) {
      return;
    }

    if (this.selectedSimilarListingDistance === distance) {
      return;
    }

    this.selectedSimilarListingDistance = distance;
    this.loadSimilarListings();
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

  trackBySimilarListingId(_: number, listing: SimilarMarketListing): string {
    return listing.id;
  }

  getSimilarListingDistanceLabel(distance: SimilarMarketListingRadius): string {
    return distance >= 1000 ? `${distance / 1000}km` : `${distance}m`;
  }

  getSimilarListingSubtitle(listing: SimilarMarketListing): string {
    return listing.address || listing.location || '-';
  }

  openSimilarListing(listing: Pick<MarketListing, 'id'>): void {
    if (!listing?.id || listing.id === this.listing?.id) {
      return;
    }

    this.similarListingSelect.emit({ id: listing.id });
  }

  private loadSimilarListings(): void {
    this.similarListingsSubscription?.unsubscribe();
    this.similarListings = [];
    this.similarListingsError = null;

    if (!this.listing) {
      this.similarListingsLoading = false;
      return;
    }

    const sourceListing = this.listing;
    this.similarListingsLoading = true;

    this.similarListingsSubscription = this.marketListingService
      .getSimilarMarketListingsInRadius(sourceListing.id, this.selectedSimilarListingDistance)
      .subscribe({
        next: listings => {
          this.similarListings = listings.filter(similarListing => similarListing.id !== sourceListing.id);
          this.similarListingsLoading = false;
        },
        error: error => {
          console.error('Failed to load similar market listings:', error);
          this.similarListings = [];
          this.similarListingsLoading = false;
          this.similarListingsError = 'Inserate konnten nicht geladen werden.';
        }
      });
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
