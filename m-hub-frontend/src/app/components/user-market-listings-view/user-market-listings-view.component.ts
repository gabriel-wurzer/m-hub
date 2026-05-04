import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';

import { BuildingComponentCategory } from '../../enums/component-category';
import { MarketListing } from '../../models/market-listing';
import { AuthenticationService } from '../../services/authentication/authentication.service';
import { MarketListingService } from '../../services/market-listing/market-listing.service';

@Component({
  selector: 'app-user-market-listings-view',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatDividerModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
  templateUrl: './user-market-listings-view.component.html',
  styleUrl: './user-market-listings-view.component.scss'
})
export class UserMarketListingsViewComponent implements OnInit, OnDestroy {
  @Output() closeUserListingsView = new EventEmitter<void>();
  @Output() editListing = new EventEmitter<MarketListing>();
  @Output() deleteListing = new EventEmitter<MarketListing>();

  listings: MarketListing[] = [];
  loading = false;
  loadError: string | null = null;
  currentUserId: string | null | undefined = undefined;

  private authSubscription?: Subscription;
  private listingsSubscription?: Subscription;

  constructor(
    private authService: AuthenticationService,
    private marketListingService: MarketListingService
  ) { }

  ngOnInit(): void {
    this.authSubscription = this.authService.getUser$().subscribe(user => {
      const nextUserId = user?.id ?? null;

      if (this.currentUserId === nextUserId) {
        return;
      }

      this.currentUserId = nextUserId;
      this.loadUserListings();
    });
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.listingsSubscription?.unsubscribe();
  }

  close(): void {
    this.closeUserListingsView.emit();
  }

  reload(): void {
    this.loadUserListings();
  }

  trackByListingId(_: number, listing: MarketListing): string {
    return listing.id;
  }

  onEditListing(listing: MarketListing): void {
    this.editListing.emit(listing);
  }

  onDeleteListing(listing: MarketListing): void {
    this.deleteListing.emit(listing);
  }

  getListingImageSrc(listing: MarketListing): string {
    const images = [...(listing.images ?? [])].sort((left, right) => left.sort_order - right.sort_order);
    return images[0]?.image_url || this.placeholderImage;
  }

  getListingType(listing: MarketListing): string {
    if (listing.component_category === BuildingComponentCategory.Objekt) {
      return listing.object_type || '-';
    }

    return listing.material || '-';
  }

  getListingTypeLabel(listing: MarketListing): string {
    return listing.component_category === BuildingComponentCategory.Objekt ? 'Kategorie' : 'Material';
  }

  getQuantityLabel(listing: MarketListing): string {
    return listing.component_category === BuildingComponentCategory.Objekt ? 'Anzahl' : 'Menge';
  }

  getQuantityValue(listing: MarketListing): string {
    const quantity = this.formatNumber(listing.quantity);

    if (listing.component_category === BuildingComponentCategory.Objekt) {
      return `${quantity} St\u00fcck`;
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
    return `${this.formatNumber(price)} \u20ac`;
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
      case 'eingelagert':
        return 'Eingelagert';
      case 'verbaut':
        return 'Verbaut';
      case 'verkauft':
        return 'Verkauft';
      case 'verfuegbar':
      case 'verfÃ¼gbar':
      case 'verfÃƒÂ¼gbar':
        return 'Verf\u00fcgbar';
      default:
        return status || '-';
    }
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

  private loadUserListings(): void {
    this.listingsSubscription?.unsubscribe();
    this.listings = [];
    this.loadError = null;

    if (!this.currentUserId) {
      this.loading = false;
      this.loadError = 'Du musst angemeldet sein, um deine Marktinserate zu sehen.';
      return;
    }

    this.loading = true;

    this.listingsSubscription = this.marketListingService.getMarketListingsByOwnerId(this.currentUserId).subscribe({
      next: listings => {
        this.listings = listings;
        this.loading = false;
      },
      error: error => {
        console.error('Error loading user market listings:', error);
        this.listings = [];
        this.loadError = 'Deine Marktinserate konnten nicht geladen werden.';
        this.loading = false;
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
      case 'Stueck':
      case 'StÃ¼ck':
      case 'StÃƒÂ¼ck':
        return 'St\u00fcck';
      case 'Quadratmeter':
        return 'm\u00b2';
      case 'Kubikmeter':
        return 'm\u00b3';
      case 'Meter':
        return 'm';
      case 'Kilogramm':
        return 'kg';
      default:
        return unit;
    }
  }

  private readonly placeholderImage = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22640%22%20height%3D%22360%22%20viewBox%3D%220%200%20640%20360%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Crect%20width%3D%22640%22%20height%3D%22360%22%20rx%3D%2212%22%20fill%3D%22%23F6F8FA%22/%3E%3Crect%20x%3D%2228%22%20y%3D%2228%22%20width%3D%22584%22%20height%3D%22304%22%20rx%3D%2218%22%20fill%3D%22%23E2E8EF%22/%3E%3Cpath%20d%3D%22M176%20218L256%20138L330%20202L374%20164L466%20218%22%20stroke%3D%22%238493A3%22%20stroke-width%3D%2218%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3Ccircle%20cx%3D%22446%22%20cy%3D%22118%22%20r%3D%2224%22%20fill%3D%22%23A7B3C0%22/%3E%3C/svg%3E';
}
