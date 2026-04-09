import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';

import { MATERIAL_GROUP_CATEGORIES, OBJECT_TYPE_CATEGORIES } from '../../utils/market-catalog.data';
import { MarketCategoryViewComponent } from '../market-category-view/market-category-view.component';
import { MarketCategory } from '../../models/market.models';

@Component({
  selector: 'app-market',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatDividerModule, MarketCategoryViewComponent],
  templateUrl: './market.component.html',
  styleUrl: './market.component.scss'
})
export class MarketComponent {
  readonly materialGroups = MATERIAL_GROUP_CATEGORIES;
  readonly objectTypes = OBJECT_TYPE_CATEGORIES;

  selectedCategory: MarketCategory | null = null;

  openCategory(category: MarketCategory): void {
    this.selectedCategory = category;
  }

  closeCategory(): void {
    this.selectedCategory = null;
  }

  trackByCategoryId(_: number, item: MarketCategory): string {
    return item.id;
  }
}
