import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';

import { MarketCategory, MarketListing } from '../../models/market.models';

@Component({
  selector: 'app-market-category-view',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatDividerModule, MatIconModule],
  templateUrl: './market-category-view.component.html',
  styleUrl: './market-category-view.component.scss'
})
export class MarketCategoryViewComponent {
  @Input() category: MarketCategory | null = null;
  @Input() materialCategories: MarketCategory[] = [];
  @Input() objectCategories: MarketCategory[] = [];
  @Input() loading = false;
  @Input() loadError: string | null = null;
  @Output() back = new EventEmitter<void>();
  @Output() categorySelect = new EventEmitter<MarketCategory>();

  selectCategory(category: MarketCategory): void {
    this.categorySelect.emit(category);
  }

  trackByCategoryId(_: number, item: MarketCategory): string {
    return item.id;
  }

  trackByListingId(_: number, item: MarketListing): string {
    return item.id;
  }
}
