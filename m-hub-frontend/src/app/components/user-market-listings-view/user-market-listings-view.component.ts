import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, finalize, of, Subscription, switchMap } from 'rxjs';

import { BuildingComponentCategory } from '../../enums/component-category';
import { getMaterialGroupForType } from '../../enums/material-group';
import { MarketListingStatus } from '../../enums/market-listing-status';
import { MarketListing } from '../../models/market-listing';
import { AuthenticationService } from '../../services/authentication/authentication.service';
import { MarketListingService } from '../../services/market-listing/market-listing.service';
import { MATERIAL_GROUP_CATEGORIES, OBJECT_TYPE_CATEGORIES } from '../../utils/market-catalog';
import { ConfirmDialogComponent, ConfirmDialogData } from '../dialogs/confirm-dialog/confirm-dialog.component';
import { EditListingDialogComponent, EditListingDialogData, EditListingDialogResult } from '../dialogs/edit-listing-dialog/edit-listing-dialog.component';

@Component({
  selector: 'app-user-market-listings-view',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatDividerModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule
  ],
  templateUrl: './user-market-listings-view.component.html',
  styleUrl: './user-market-listings-view.component.scss'
})
export class UserMarketListingsViewComponent implements OnInit, OnDestroy {
  @Output() closeUserListingsView = new EventEmitter<void>();
  @Output() editListing = new EventEmitter<MarketListing>();
  @Output() deleteListing = new EventEmitter<MarketListing>();
  @Output() listingDeleted = new EventEmitter<MarketListing>();
  @Output() listingUpdated = new EventEmitter<MarketListing>();

  listings: MarketListing[] = [];
  loading = false;
  loadError: string | null = null;
  currentUserId: string | null | undefined = undefined;
  deletingListingIds = new Set<string>();
  updatingListingIds = new Set<string>();

  private authSubscription?: Subscription;
  private listingsSubscription?: Subscription;
  private readonly deleteSubscriptions = new Subscription();
  private readonly updateSubscriptions = new Subscription();

  constructor(
    private authService: AuthenticationService,
    private marketListingService: MarketListingService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
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
    this.deleteSubscriptions.unsubscribe();
    this.updateSubscriptions.unsubscribe();
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
    if (this.updatingListingIds.has(listing.id) || this.deletingListingIds.has(listing.id)) {
      return;
    }

    const dialogRef = this.dialog.open<EditListingDialogComponent, EditListingDialogData, EditListingDialogResult>(
      EditListingDialogComponent,
      {
        panelClass: 'custom-dialog',
        disableClose: true,
        autoFocus: false,
        data: {
          listing
        }
      }
    );

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.executeUpdateListing(listing, result);
      }
    });
  }

  onDeleteListing(listing: MarketListing): void {
    if (this.deletingListingIds.has(listing.id)) {
      return;
    }

    const safeListingName = this.escapeHtml(listing.name);
    const dialogRef = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      {
        width: '450px',
        data: {
          title: 'Marktinserat l\u00f6schen',
          message: `M\u00f6chtest du das Marktinserat <strong>${safeListingName}</strong> wirklich unwiderruflich l\u00f6schen?`,
          confirmText: 'L\u00f6schen',
          cancelText: 'Behalten',
          requireSlider: true,
          sliderText: 'L\u00f6schen best\u00e4tigen'
        }
      }
    );

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        this.executeDeleteListing(listing);
      }
    });
  }

  isDeletingListing(listing: MarketListing): boolean {
    return this.deletingListingIds.has(listing.id);
  }

  isUpdatingListing(listing: MarketListing): boolean {
    return this.updatingListingIds.has(listing.id);
  }

  getListingImageSrc(listing: MarketListing): string {
    const images = [...(listing.images ?? [])].sort((left, right) => left.sort_order - right.sort_order);
    return images[0]?.image_url || this.getListingPlaceholderImage(listing);
  }

  isPlaceholderImage(imageSrc: string | null | undefined): boolean {
    return imageSrc?.trim().toLowerCase().startsWith('data:image/svg+xml') ?? false;
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
      case MarketListingStatus.eingelagert:
        return 'Eingelagert';
      case MarketListingStatus.verbaut:
        return 'Verbaut';
      default:
        return '-';
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

  private executeDeleteListing(listing: MarketListing): void {
    this.deletingListingIds.add(listing.id);

    const subscription = this.marketListingService.deleteMarketListing(listing.id)
      .pipe(finalize(() => this.deletingListingIds.delete(listing.id)))
      .subscribe({
        next: deletedListing => {
          this.listings = this.listings.filter(current => current.id !== listing.id);
          this.deleteListing.emit(deletedListing);
          this.listingDeleted.emit(deletedListing);
        },
        complete: () => {
          this.snackBar.open('Marktinserat wurde gel\u00f6scht.', 'OK', {
            duration: 3000,
            verticalPosition: 'top'
          });
        },
        error: error => {
          console.error('Failed to delete market listing:', error);
          this.snackBar.open('Marktinserat konnte nicht gel\u00f6scht werden.', 'OK', {
            duration: 10000,
            verticalPosition: 'top',
            panelClass: 'snackbar-warn'
          });
        }
      });

    this.deleteSubscriptions.add(subscription);
  }

  private executeUpdateListing(listing: MarketListing, payload: EditListingDialogResult): void {
    this.updatingListingIds.add(listing.id);

    const subscription = this.marketListingService.updateMarketListing(listing.id, payload)
      .pipe(
        switchMap(updatedListing =>
          this.marketListingService.getMarketListingById(updatedListing.id).pipe(
            catchError(error => {
              console.error('Failed to reload updated market listing:', error);
              return of(updatedListing);
            })
          )
        ),
        finalize(() => this.updatingListingIds.delete(listing.id))
      )
      .subscribe({
        next: updatedListing => {
          this.listings = this.listings.map(current =>
            current.id === updatedListing.id ? updatedListing : current
          );
          this.editListing.emit(updatedListing);
          this.listingUpdated.emit(updatedListing);
        },
        complete: () => {
          this.snackBar.open('Marktinserat wurde aktualisiert.', 'OK', {
            duration: 3000,
            verticalPosition: 'top'
          });
        },
        error: error => {
          console.error('Failed to update market listing:', error);
          this.snackBar.open('Marktinserat konnte nicht aktualisiert werden.', 'OK', {
            duration: 10000,
            verticalPosition: 'top',
            panelClass: 'snackbar-warn'
          });
        }
      });

    this.updateSubscriptions.add(subscription);
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, character => {
      switch (character) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        default:
          return character;
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

  private getListingPlaceholderImage(listing: MarketListing): string {
    if (listing.component_category === BuildingComponentCategory.Objekt) {
      return this.objectPlaceholderByType.get(listing.object_type ?? '') ?? this.placeholderImage;
    }

    const materialGroup = getMaterialGroupForType(listing.material);
    return materialGroup
      ? this.materialPlaceholderByGroup.get(materialGroup) ?? this.placeholderImage
      : this.placeholderImage;
  }

  private readonly materialPlaceholderByGroup = new Map(
    MATERIAL_GROUP_CATEGORIES.map(category => [category.title, category.imageSrc] as const)
  );

  private readonly objectPlaceholderByType = new Map(
    OBJECT_TYPE_CATEGORIES.map(category => [category.title, category.imageSrc] as const)
  );

  private readonly placeholderImage = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22640%22%20height%3D%22360%22%20viewBox%3D%220%200%20640%20360%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Crect%20width%3D%22640%22%20height%3D%22360%22%20rx%3D%2212%22%20fill%3D%22%23F6F8FA%22/%3E%3Crect%20x%3D%2228%22%20y%3D%2228%22%20width%3D%22584%22%20height%3D%22304%22%20rx%3D%2218%22%20fill%3D%22%23E2E8EF%22/%3E%3Cpath%20d%3D%22M176%20218L256%20138L330%20202L374%20164L466%20218%22%20stroke%3D%22%238493A3%22%20stroke-width%3D%2218%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3Ccircle%20cx%3D%22446%22%20cy%3D%22118%22%20r%3D%2224%22%20fill%3D%22%23A7B3C0%22/%3E%3C/svg%3E';
}
