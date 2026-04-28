import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { Observable, Subscription } from 'rxjs';

import { MATERIAL_GROUP_CATEGORIES, OBJECT_TYPE_CATEGORIES } from '../../utils/market-catalog';
import { MarketCategoryViewComponent } from '../market-category-view/market-category-view.component';
import { MarketCategory, MarketListing as MarketCategoryListing } from '../../models/market.models';
import { MarketListing as ApiMarketListing } from '../../models/market-listing';
import { MarketListingService } from '../../services/market-listing/market-listing.service';
import { MaterialGroup } from '../../enums/material-group';
import { ObjectType } from '../../enums/object-type';
import { BuildingComponentCategory } from '../../enums/component-category';

@Component({
  selector: 'app-market',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatDividerModule, MarketCategoryViewComponent],
  templateUrl: './market.component.html',
  styleUrl: './market.component.scss'
})
export class MarketComponent implements OnDestroy {
  readonly materialGroups = MATERIAL_GROUP_CATEGORIES;
  readonly objectTypes = OBJECT_TYPE_CATEGORIES;

  selectedCategory: MarketCategory | null = null;
  isCategoryLoading = false;
  categoryLoadError: string | null = null;

  private categoryLoadSubscription?: Subscription;

  constructor(private marketListingService: MarketListingService) {}

  openCategory(category: MarketCategory): void {
    this.categoryLoadSubscription?.unsubscribe();
    this.selectedCategory = { ...category, listings: [] };
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
        this.selectedCategory = {
          ...category,
          listings: listings.map(listing => this.mapApiListingToCategoryListing(listing, category))
        };
        this.isCategoryLoading = false;
      },
      error: () => {
        this.selectedCategory = { ...category, listings: [] };
        this.categoryLoadError = 'Marktangebote konnten nicht geladen werden.';
        this.isCategoryLoading = false;
      }
    });
  }

  closeCategory(): void {
    this.categoryLoadSubscription?.unsubscribe();
    this.selectedCategory = null;
    this.isCategoryLoading = false;
    this.categoryLoadError = null;
  }

  ngOnDestroy(): void {
    this.categoryLoadSubscription?.unsubscribe();
  }

  trackByCategoryId(_: number, item: MarketCategory): string {
    return item.id;
  }

  private getListingsForCategory(category: MarketCategory): Observable<ApiMarketListing[]> | null {
    if (category.kind === 'material') {
      const group = this.asMaterialGroup(category.title);
      return group ? this.marketListingService.getMarketListingsByMaterialGroup(group) : null;
    }

    const objectType = this.asObjectType(category.title);
    return objectType ? this.marketListingService.getMarketListingsByObjectType(objectType) : null;
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
      location: listing.location,
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
        return unit;
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
}
