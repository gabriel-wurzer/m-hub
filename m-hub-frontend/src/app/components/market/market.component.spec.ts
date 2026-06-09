import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, Subject } from 'rxjs';

import { MarketComponent } from './market.component';
import { MarketCategoryViewComponent } from '../market-category-view/market-category-view.component';
import { BuildingComponentCategory } from '../../enums/component-category';
import { MarketListingStatus } from '../../enums/market-listing-status';
import { MarketPotential } from '../../enums/market-potential.enum';
import { MarketListingUnit } from '../../enums/market-listing-unit.enum';
import { MaterialType } from '../../enums/material-type.enum';
import { MarketListingCategoryCount, MarketListingService } from '../../services/market-listing/market-listing.service';
import { MaterialGroup } from '../../enums/material-group';
import { AuthenticationService } from '../../services/authentication/authentication.service';
import {
  MARKET_LISTING_PRICE_OPTIONS,
  MARKET_LISTING_PRICE_UNBOUNDED_MAX,
  normalizeMarketListingPriceRange
} from '../../models/market.models';

describe('MarketComponent', () => {
  let component: MarketComponent;
  let fixture: ComponentFixture<MarketComponent>;
  let marketListingService: jasmine.SpyObj<MarketListingService>;
  let authService: jasmine.SpyObj<AuthenticationService>;

  beforeEach(async () => {
    marketListingService = jasmine.createSpyObj<MarketListingService>('MarketListingService', [
      'getMarketListingCategoryCounts',
      'getMarketListingsByMaterialGroup',
      'getMarketListingsByObjectType',
      'searchMarketListings',
      'getMarketListingById'
    ]);
    authService = jasmine.createSpyObj<AuthenticationService>('AuthenticationService', ['getUser$']);
    marketListingService.getMarketListingCategoryCounts.and.returnValue(of([]));
    marketListingService.getMarketListingsByMaterialGroup.and.returnValue(of([]));
    marketListingService.getMarketListingsByObjectType.and.returnValue(of([]));
    marketListingService.searchMarketListings.and.returnValue(of([]));
    marketListingService.getMarketListingById.and.returnValue(of({} as any));
    authService.getUser$.and.returnValue(of(null));

    await TestBed.configureTestingModule({
      imports: [MarketComponent, NoopAnimationsModule],
      providers: [
        {
          provide: MarketListingService,
          useValue: marketListingService
        },
        {
          provide: AuthenticationService,
          useValue: authService
        }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MarketComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('binds and clears the market listing search query', async () => {
    const searchInput = fixture.nativeElement.querySelector('input[name="marketSearch"]') as HTMLInputElement;

    expect(searchInput).not.toBeNull();
    expect(searchInput.placeholder).toBe('Inserate suchen..');
    expect(fixture.nativeElement.querySelector('.market-search-icon-button')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.market-search-submit-button')).toBeNull();

    searchInput.value = 'Beton';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.marketSearchQuery).toBe('Beton');

    const clearButton = fixture.nativeElement.querySelector('.market-search-clear-button') as HTMLButtonElement;
    expect(clearButton).not.toBeNull();

    clearButton.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.marketSearchQuery).toBe('');
    expect(searchInput.value).toBe('');
  });

  it('searches market listings and renders visible results', async () => {
    marketListingService.searchMarketListings.and.returnValue(of([
      {
        id: 'listing-search-1',
        component_id: 'part-1',
        owner_id: 'user-1',
        user_building_id: 'user-building-1',
        building_id: 'building-1',
        location: 'EG',
        component_category: BuildingComponentCategory.Bauteil,
        material: MaterialType.mat_3,
        length: null,
        width: null,
        height: null,
        name: 'Betonplatte',
        address: 'Test street 1',
        price: 100,
        status: MarketListingStatus.eingelagert,
        available_from: '2026-04-22',
        potential: MarketPotential.reuse,
        quantity: 12,
        unit: MarketListingUnit.m,
        contact: 'user@example.com',
        images: [],
        created_at: '2026-04-22T00:00:00Z',
        updated_at: '2026-04-22T00:00:00Z'
      },
      {
        id: 'listing-search-sold',
        component_id: 'part-2',
        owner_id: 'user-1',
        user_building_id: 'user-building-1',
        building_id: 'building-1',
        location: 'EG',
        component_category: BuildingComponentCategory.Bauteil,
        material: MaterialType.mat_3,
        length: null,
        width: null,
        height: null,
        name: 'Verkaufte Betonplatte',
        address: 'Test street 1',
        price: 100,
        status: MarketListingStatus.verkauft,
        available_from: '2026-04-22',
        potential: MarketPotential.reuse,
        quantity: 12,
        unit: MarketListingUnit.m,
        contact: 'user@example.com',
        images: [],
        created_at: '2026-04-22T00:00:00Z',
        updated_at: '2026-04-22T00:00:00Z'
      }
    ]));

    const searchInput = fixture.nativeElement.querySelector('input[name="marketSearch"]') as HTMLInputElement;
    searchInput.value = 'Beton';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    component.onMarketSearchSubmit();
    fixture.detectChanges();

    expect(marketListingService.searchMarketListings).toHaveBeenCalledOnceWith('Beton');
    expect(component.marketSearchResults.map(listing => listing.id)).toEqual(['listing-search-1']);
    expect(fixture.nativeElement.querySelector('.search-results-header')?.textContent).toContain('1 Inserat gefunden');
    expect(fixture.nativeElement.querySelectorAll('.listing-card').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.listing-card')?.textContent).toContain('Betonplatte');
    expect(fixture.nativeElement.querySelector('.market-section')).toBeNull();

    const clearResultsButton = fixture.nativeElement.querySelector('.clear-search-results-button') as HTMLButtonElement;
    expect(clearResultsButton).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.market-search-results')?.firstElementChild).toBe(clearResultsButton);

    clearResultsButton.click();
    fixture.detectChanges();

    expect(component.marketSearchQuery).toBe('Beton');
    expect(component.hasMarketSearchRun).toBeFalse();
    expect(component.marketSearchResults).toEqual([]);
    expect(fixture.nativeElement.querySelector('.market-search-results')).toBeNull();
    expect(fixture.nativeElement.querySelector('.market-section')).not.toBeNull();
    expect((fixture.nativeElement.querySelector('input[name="marketSearch"]') as HTMLInputElement).value).toBe('Beton');
  });

  it('loads real market listing counts for overview category cards', () => {
    marketListingService.getMarketListingCategoryCounts.and.returnValue(of([
      { kind: 'material', value: MaterialGroup.Mineralik, count: 4 }
    ]));

    component.ngOnInit();

    expect(component.formatCategoryListingCount(component.materialGroups[0])).toBe('4 Inserate');
  });

  it('shows category count tags only after counts are loaded', () => {
    const counts$ = new Subject<MarketListingCategoryCount[]>();
    const localFixture = TestBed.createComponent(MarketComponent);
    const localComponent = localFixture.componentInstance;

    marketListingService.getMarketListingCategoryCounts.and.returnValue(counts$);
    localFixture.detectChanges();

    expect(localComponent.categoryCountsLoaded).toBeFalse();
    expect(localFixture.nativeElement.querySelector('.card-tag')).toBeNull();

    counts$.next([{ kind: 'material', value: MaterialGroup.Mineralik, count: 4 }]);
    counts$.complete();
    localFixture.detectChanges();

    expect(localComponent.categoryCountsLoaded).toBeTrue();
    expect(localFixture.nativeElement.querySelector('.card-tag')?.textContent.trim()).toBe('4 Inserate');
  });

  it('shows the category filter button when the user is logged out', () => {
    component.openCategory(component.materialGroups[0]);
    fixture.detectChanges();

    const filterButton = fixture.nativeElement.querySelector('.filter-toggle-button');
    const myListingsButton = fixture.nativeElement.querySelector('.my-listings-button');

    expect(filterButton).not.toBeNull();
    expect(filterButton.textContent).toContain('Filter');
    expect(myListingsButton).toBeNull();
  });

  it('shows the material filter only for material group categories', () => {
    component.openCategory(component.materialGroups[0]);
    fixture.detectChanges();

    let categoryView = fixture.debugElement.query(By.directive(MarketCategoryViewComponent))
      .componentInstance as MarketCategoryViewComponent;
    categoryView.isFilterPanelVisible = true;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.filter-block--material')).not.toBeNull();

    component.openCategory(component.objectTypes[0]);
    fixture.detectChanges();

    categoryView = fixture.debugElement.query(By.directive(MarketCategoryViewComponent))
      .componentInstance as MarketCategoryViewComponent;
    categoryView.isFilterPanelVisible = true;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.filter-block--material')).toBeNull();
  });

  it('allows reset when ignored invalid filter text is still visible in inputs', () => {
    component.openCategory(component.materialGroups[0]);
    fixture.detectChanges();

    let categoryView = fixture.debugElement.query(By.directive(MarketCategoryViewComponent))
      .componentInstance as MarketCategoryViewComponent;

    categoryView.priceMinInput = 'abc';
    categoryView.priceMaxInput = 'def';
    categoryView.onPriceInputChange();
    fixture.detectChanges();

    categoryView = fixture.debugElement.query(By.directive(MarketCategoryViewComponent))
      .componentInstance as MarketCategoryViewComponent;
    categoryView.quantityInput = 'keine zahl';
    categoryView.onQuantityInputChange();
    fixture.detectChanges();

    categoryView = fixture.debugElement.query(By.directive(MarketCategoryViewComponent))
      .componentInstance as MarketCategoryViewComponent;

    expect(categoryView.priceMinInput).toBe('abc');
    expect(categoryView.priceMaxInput).toBe('def');
    expect(categoryView.quantityInput).toBe('keine zahl');
    expect(categoryView.isPriceMinInputInvalid()).toBeTrue();
    expect(categoryView.isPriceMaxInputInvalid()).toBeTrue();
    expect(categoryView.isQuantityInputInvalid()).toBeTrue();
    expect(categoryView.isResetDisabled()).toBeFalse();
    expect(component.activeCategoryFilterCount).toBe(0);

    categoryView.resetFilters();

    expect(categoryView.priceMinInput).toBe('0');
    expect(categoryView.priceMaxInput).toBe('beliebig');
    expect(categoryView.quantityInput).toBe('');
    expect(categoryView.isPriceMinInputInvalid()).toBeFalse();
    expect(categoryView.isPriceMaxInputInvalid()).toBeFalse();
    expect(categoryView.isQuantityInputInvalid()).toBeFalse();
  });

  it('uses configured price steps for the slider while keeping manual price input exact', () => {
    expect(MARKET_LISTING_PRICE_OPTIONS).toContain(0);
    expect(MARKET_LISTING_PRICE_OPTIONS).toContain(10);
    expect(MARKET_LISTING_PRICE_OPTIONS).toContain(250);
    expect(MARKET_LISTING_PRICE_OPTIONS).toContain(300);
    expect(MARKET_LISTING_PRICE_OPTIONS).toContain(1000);
    expect(MARKET_LISTING_PRICE_OPTIONS).toContain(1100);
    expect(MARKET_LISTING_PRICE_OPTIONS).toContain(1500);
    expect(MARKET_LISTING_PRICE_OPTIONS).toContain(2000);
    expect(MARKET_LISTING_PRICE_OPTIONS).toContain(3000);
    expect(MARKET_LISTING_PRICE_OPTIONS).toContain(4000);
    expect(MARKET_LISTING_PRICE_OPTIONS).toContain(10000);
    expect(MARKET_LISTING_PRICE_OPTIONS).toContain(20000);
    expect(MARKET_LISTING_PRICE_OPTIONS).toContain(100000);
    expect(MARKET_LISTING_PRICE_OPTIONS).toContain(MARKET_LISTING_PRICE_UNBOUNDED_MAX);
    expect(MARKET_LISTING_PRICE_OPTIONS).not.toContain(2760);

    expect(normalizeMarketListingPriceRange(2760, 150000)).toEqual({ min: 2760, max: 150000 });
    expect(normalizeMarketListingPriceRange('10,5', 'beliebig')).toEqual({
      min: 10.5,
      max: MARKET_LISTING_PRICE_UNBOUNDED_MAX
    });
    expect(normalizeMarketListingPriceRange('abc', 'def')).toEqual({
      min: 0,
      max: MARKET_LISTING_PRICE_UNBOUNDED_MAX
    });
    expect(normalizeMarketListingPriceRange('beliebig', '1000')).toEqual({
      min: 0,
      max: 1000
    });
  });

  it('hides sold listings in the selected market category view', () => {
    marketListingService.getMarketListingsByMaterialGroup.and.returnValue(of([
      {
        id: 'listing-1',
        component_id: 'part-1',
        owner_id: 'user-1',
        user_building_id: 'user-building-1',
        building_id: 'building-1',
        location: 'EG',
        component_category: BuildingComponentCategory.Bauteil,
        material: MaterialType.mat_3,
        length: null,
        width: null,
        height: null,
        name: 'Visible listing',
        address: 'Test street 1',
        price: 100,
        status: MarketListingStatus.eingelagert,
        available_from: '2026-04-22',
        potential: MarketPotential.reuse,
        quantity: 12,
        unit: MarketListingUnit.m,
        contact: 'user@example.com',
        images: [],
        created_at: '2026-04-22T00:00:00Z',
        updated_at: '2026-04-22T00:00:00Z'
      },
      {
        id: 'listing-2',
        component_id: 'part-2',
        owner_id: 'user-1',
        user_building_id: 'user-building-1',
        building_id: 'building-1',
        location: 'EG',
        component_category: BuildingComponentCategory.Bauteil,
        material: MaterialType.mat_3,
        length: null,
        width: null,
        height: null,
        name: 'Sold listing',
        address: 'Test street 1',
        price: 100,
        status: MarketListingStatus.verkauft,
        available_from: '2026-04-22',
        potential: MarketPotential.reuse,
        quantity: 12,
        unit: MarketListingUnit.m,
        contact: 'user@example.com',
        images: [],
        created_at: '2026-04-22T00:00:00Z',
        updated_at: '2026-04-22T00:00:00Z'
      }
    ]));

    component.openCategory(component.materialGroups[0]);

    expect(component.selectedCategory?.listings.map(listing => listing.id)).toEqual(['listing-1']);
    expect(component.formatCategoryListingCount(component.materialGroups[0])).toBe('1 Inserat');
  });

  it('filters selected category listings on the frontend', () => {
    marketListingService.getMarketListingsByMaterialGroup.and.returnValue(of([
      {
        id: 'listing-1',
        component_id: 'part-1',
        owner_id: 'user-1',
        user_building_id: 'user-building-1',
        building_id: 'building-1',
        location: 'EG',
        component_category: BuildingComponentCategory.Bauteil,
        material: MaterialType.mat_3,
        length: 80,
        width: 60,
        height: 20,
        name: 'Older cheap listing',
        address: 'Test street 1',
        price: 100,
        status: MarketListingStatus.eingelagert,
        available_from: '2026-04-22',
        potential: MarketPotential.reuse,
        quantity: 12,
        unit: MarketListingUnit.m,
        contact: 'user@example.com',
        images: [],
        created_at: '2026-04-22T00:00:00Z',
        updated_at: '2026-04-22T00:00:00Z'
      },
      {
        id: 'listing-2',
        component_id: 'part-2',
        owner_id: 'user-1',
        user_building_id: 'user-building-1',
        building_id: 'building-1',
        location: 'EG',
        component_category: BuildingComponentCategory.Bauteil,
        material: MaterialType.mat_3,
        length: 120,
        width: 70,
        height: 30,
        name: 'Matching listing',
        address: 'Test street 2',
        price: 250,
        status: MarketListingStatus.verbaut,
        available_from: '2026-06-01',
        potential: MarketPotential.recycle,
        quantity: 4,
        unit: MarketListingUnit.m,
        contact: 'user@example.com',
        images: [],
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-01T00:00:00Z'
      }
    ]));

    component.openCategory(component.materialGroups[0]);
    const requestCount = marketListingService.getMarketListingsByMaterialGroup.calls.count();

    component.onCategoryFilterChange({
      ...component.categoryFilter,
      priceMin: 150,
      availableFromMin: '2026-06-01',
      statuses: [MarketListingStatus.verbaut],
      quantityMin: 4
    });

    expect(component.selectedCategory?.listings.map(listing => listing.id)).toEqual(['listing-2']);
    expect(component.activeCategoryFilterCount).toBe(4);
    expect(marketListingService.getMarketListingsByMaterialGroup.calls.count()).toBe(requestCount);
  });

  it('keeps listings whose available-from date is equal to or before the selected filter date', () => {
    marketListingService.getMarketListingsByMaterialGroup.and.returnValue(of([
      {
        id: 'listing-available-before-date',
        component_id: 'part-0',
        owner_id: 'user-1',
        user_building_id: 'user-building-1',
        building_id: 'building-1',
        location: 'EG',
        component_category: BuildingComponentCategory.Bauteil,
        material: MaterialType.mat_3,
        length: null,
        width: null,
        height: null,
        name: 'Available before selected date',
        address: 'Test street 0',
        price: 100,
        status: MarketListingStatus.eingelagert,
        available_from: '2026-05-31',
        potential: MarketPotential.reuse,
        quantity: 12,
        unit: MarketListingUnit.m,
        contact: 'user@example.com',
        images: [],
        created_at: '2026-04-22T00:00:00Z',
        updated_at: '2026-04-22T00:00:00Z'
      },
      {
        id: 'listing-available-on-date',
        component_id: 'part-1',
        owner_id: 'user-1',
        user_building_id: 'user-building-1',
        building_id: 'building-1',
        location: 'EG',
        component_category: BuildingComponentCategory.Bauteil,
        material: MaterialType.mat_3,
        length: null,
        width: null,
        height: null,
        name: 'Available on selected date',
        address: 'Test street 1',
        price: 100,
        status: MarketListingStatus.eingelagert,
        available_from: '2026-06-01',
        potential: MarketPotential.reuse,
        quantity: 10,
        unit: MarketListingUnit.m,
        contact: 'user@example.com',
        images: [],
        created_at: '2026-04-22T00:00:00Z',
        updated_at: '2026-04-22T00:00:00Z'
      },
      {
        id: 'listing-available-later',
        component_id: 'part-2',
        owner_id: 'user-1',
        user_building_id: 'user-building-1',
        building_id: 'building-1',
        location: 'EG',
        component_category: BuildingComponentCategory.Bauteil,
        material: MaterialType.mat_3,
        length: null,
        width: null,
        height: null,
        name: 'Available after selected date',
        address: 'Test street 2',
        price: 100,
        status: MarketListingStatus.eingelagert,
        available_from: '2026-06-02',
        potential: MarketPotential.reuse,
        quantity: 5,
        unit: MarketListingUnit.m,
        contact: 'user@example.com',
        images: [],
        created_at: '2026-04-22T00:00:00Z',
        updated_at: '2026-04-22T00:00:00Z'
      }
    ]));

    component.openCategory(component.materialGroups[0]);
    component.onCategoryFilterChange({
      ...component.categoryFilter,
      availableFromMin: '2026-06-01'
    });

    expect(component.selectedCategory?.listings.map(listing => listing.id)).toEqual([
      'listing-available-before-date',
      'listing-available-on-date'
    ]);
    expect(component.activeCategoryFilterCount).toBe(1);
  });

  it('filters material category listings by selected materials', () => {
    marketListingService.getMarketListingsByMaterialGroup.and.returnValue(of([
      {
        id: 'listing-concrete',
        component_id: 'part-1',
        owner_id: 'user-1',
        user_building_id: 'user-building-1',
        building_id: 'building-1',
        location: 'EG',
        component_category: BuildingComponentCategory.Bauteil,
        material: MaterialType.mat_3,
        length: null,
        width: null,
        height: null,
        name: 'Concrete listing',
        address: 'Test street 1',
        price: 100,
        status: MarketListingStatus.eingelagert,
        available_from: '2026-04-22',
        potential: MarketPotential.reuse,
        quantity: 10,
        unit: MarketListingUnit.m,
        contact: 'user@example.com',
        images: [],
        created_at: '2026-04-22T00:00:00Z',
        updated_at: '2026-04-22T00:00:00Z'
      },
      {
        id: 'listing-brick',
        component_id: 'part-2',
        owner_id: 'user-1',
        user_building_id: 'user-building-1',
        building_id: 'building-1',
        location: 'EG',
        component_category: BuildingComponentCategory.Bauteil,
        material: MaterialType.mat_38,
        length: null,
        width: null,
        height: null,
        name: 'Brick listing',
        address: 'Test street 2',
        price: 100,
        status: MarketListingStatus.eingelagert,
        available_from: '2026-04-22',
        potential: MarketPotential.reuse,
        quantity: 5,
        unit: MarketListingUnit.m,
        contact: 'user@example.com',
        images: [],
        created_at: '2026-04-22T00:00:00Z',
        updated_at: '2026-04-22T00:00:00Z'
      }
    ]));

    component.openCategory(component.materialGroups[0]);
    component.onCategoryFilterChange({
      ...component.categoryFilter,
      materials: [MaterialType.mat_3]
    });

    expect(component.selectedCategory?.listings.map(listing => listing.id)).toEqual(['listing-concrete']);
    expect(component.activeCategoryFilterCount).toBe(1);
  });

  it('filters material category listings by quantity unit and minimum amount', () => {
    marketListingService.getMarketListingsByMaterialGroup.and.returnValue(of([
      {
        id: 'listing-meter',
        component_id: 'part-1',
        owner_id: 'user-1',
        user_building_id: 'user-building-1',
        building_id: 'building-1',
        location: 'EG',
        component_category: BuildingComponentCategory.Bauteil,
        material: MaterialType.mat_3,
        length: null,
        width: null,
        height: null,
        name: 'Meter listing',
        address: 'Test street 1',
        price: 100,
        status: MarketListingStatus.eingelagert,
        available_from: '2026-04-22',
        potential: MarketPotential.reuse,
        quantity: 10,
        unit: MarketListingUnit.m,
        contact: 'user@example.com',
        images: [],
        created_at: '2026-04-22T00:00:00Z',
        updated_at: '2026-04-22T00:00:00Z'
      },
      {
        id: 'listing-kg-too-small',
        component_id: 'part-3',
        owner_id: 'user-1',
        user_building_id: 'user-building-1',
        building_id: 'building-1',
        location: 'EG',
        component_category: BuildingComponentCategory.Bauteil,
        material: MaterialType.mat_3,
        length: null,
        width: null,
        height: null,
        name: 'Small kilogram listing',
        address: 'Test street 3',
        price: 100,
        status: MarketListingStatus.eingelagert,
        available_from: '2026-04-22',
        potential: MarketPotential.reuse,
        quantity: 3,
        unit: MarketListingUnit.kg,
        contact: 'user@example.com',
        images: [],
        created_at: '2026-04-22T00:00:00Z',
        updated_at: '2026-04-22T00:00:00Z'
      },
      {
        id: 'listing-kg',
        component_id: 'part-2',
        owner_id: 'user-1',
        user_building_id: 'user-building-1',
        building_id: 'building-1',
        location: 'EG',
        component_category: BuildingComponentCategory.Bauteil,
        material: MaterialType.mat_3,
        length: null,
        width: null,
        height: null,
        name: 'Kilogram listing',
        address: 'Test street 2',
        price: 100,
        status: MarketListingStatus.eingelagert,
        available_from: '2026-04-22',
        potential: MarketPotential.reuse,
        quantity: 5,
        unit: MarketListingUnit.kg,
        contact: 'user@example.com',
        images: [],
        created_at: '2026-04-22T00:00:00Z',
        updated_at: '2026-04-22T00:00:00Z'
      }
    ]));

    component.openCategory(component.materialGroups[0]);
    component.onCategoryFilterChange({
      ...component.categoryFilter,
      quantityMin: 4,
      quantityUnit: MarketListingUnit.kg
    });

    expect(component.selectedCategory?.listings.map(listing => listing.id)).toEqual(['listing-kg']);
    expect(component.activeCategoryFilterCount).toBe(1);
  });

  it('parses backend quantity strings as decimal values when filtering material listings', () => {
    marketListingService.getMarketListingsByMaterialGroup.and.returnValue(of([
      {
        id: 'listing-kg-too-small-string',
        component_id: 'part-1',
        owner_id: 'user-1',
        user_building_id: 'user-building-1',
        building_id: 'building-1',
        location: 'EG',
        component_category: BuildingComponentCategory.Bauteil,
        material: MaterialType.mat_3,
        length: null,
        width: null,
        height: null,
        name: 'Small kilogram listing',
        address: 'Test street 1',
        price: 100,
        status: MarketListingStatus.eingelagert,
        available_from: '2026-04-22',
        potential: MarketPotential.reuse,
        quantity: '3.000' as any,
        unit: MarketListingUnit.kg,
        contact: 'user@example.com',
        images: [],
        created_at: '2026-04-22T00:00:00Z',
        updated_at: '2026-04-22T00:00:00Z'
      },
      {
        id: 'listing-kg-string',
        component_id: 'part-2',
        owner_id: 'user-1',
        user_building_id: 'user-building-1',
        building_id: 'building-1',
        location: 'EG',
        component_category: BuildingComponentCategory.Bauteil,
        material: MaterialType.mat_3,
        length: null,
        width: null,
        height: null,
        name: 'Kilogram listing',
        address: 'Test street 2',
        price: 100,
        status: MarketListingStatus.eingelagert,
        available_from: '2026-04-22',
        potential: MarketPotential.reuse,
        quantity: '5.000' as any,
        unit: MarketListingUnit.kg,
        contact: 'user@example.com',
        images: [],
        created_at: '2026-04-22T00:00:00Z',
        updated_at: '2026-04-22T00:00:00Z'
      }
    ]));

    component.openCategory(component.materialGroups[0]);
    component.onCategoryFilterChange({
      ...component.categoryFilter,
      quantityMin: 4,
      quantityUnit: MarketListingUnit.kg
    });

    expect(component.selectedCategory?.listings.map(listing => listing.id)).toEqual(['listing-kg-string']);
    expect(component.activeCategoryFilterCount).toBe(1);
  });

  it('filters object category listings by implicit Stück unit and minimum quantity', () => {
    marketListingService.getMarketListingsByObjectType.and.returnValue(of([
      {
        id: 'object-too-small',
        component_id: 'object-1',
        owner_id: 'user-1',
        user_building_id: 'user-building-1',
        building_id: 'building-1',
        location: null,
        component_category: BuildingComponentCategory.Objekt,
        object_type: component.objectTypes[0].title as any,
        length: null,
        width: null,
        height: null,
        name: 'Small object listing',
        address: 'Test street 1',
        price: 100,
        status: MarketListingStatus.eingelagert,
        available_from: '2026-04-22',
        potential: MarketPotential.reuse,
        quantity: '3.000' as any,
        unit: MarketListingUnit.St,
        contact: 'user@example.com',
        images: [],
        created_at: '2026-04-22T00:00:00Z',
        updated_at: '2026-04-22T00:00:00Z'
      },
      {
        id: 'object-wrong-unit',
        component_id: 'object-2',
        owner_id: 'user-1',
        user_building_id: 'user-building-1',
        building_id: 'building-1',
        location: null,
        component_category: BuildingComponentCategory.Objekt,
        object_type: component.objectTypes[0].title as any,
        length: null,
        width: null,
        height: null,
        name: 'Wrong unit object listing',
        address: 'Test street 2',
        price: 100,
        status: MarketListingStatus.eingelagert,
        available_from: '2026-04-22',
        potential: MarketPotential.reuse,
        quantity: '8.000' as any,
        unit: MarketListingUnit.m,
        contact: 'user@example.com',
        images: [],
        created_at: '2026-04-22T00:00:00Z',
        updated_at: '2026-04-22T00:00:00Z'
      },
      {
        id: 'object-matching',
        component_id: 'object-3',
        owner_id: 'user-1',
        user_building_id: 'user-building-1',
        building_id: 'building-1',
        location: null,
        component_category: BuildingComponentCategory.Objekt,
        object_type: component.objectTypes[0].title as any,
        length: null,
        width: null,
        height: null,
        name: 'Matching object listing',
        address: 'Test street 3',
        price: 100,
        status: MarketListingStatus.eingelagert,
        available_from: '2026-04-22',
        potential: MarketPotential.reuse,
        quantity: '5.000' as any,
        unit: MarketListingUnit.St,
        contact: 'user@example.com',
        images: [],
        created_at: '2026-04-22T00:00:00Z',
        updated_at: '2026-04-22T00:00:00Z'
      }
    ]));

    component.openCategory(component.objectTypes[0]);
    component.onCategoryFilterChange({
      ...component.categoryFilter,
      quantityMin: 4,
      quantityUnit: null
    });

    expect(component.selectedCategory?.listings.map(listing => listing.id)).toEqual(['object-matching']);
    expect(component.activeCategoryFilterCount).toBe(1);
  });

  it('normalizes listing units before applying the quantity unit filter', () => {
    marketListingService.getMarketListingsByMaterialGroup.and.returnValue(of([
      {
        id: 'listing-encoded-pieces',
        component_id: 'part-1',
        owner_id: 'user-1',
        user_building_id: 'user-building-1',
        building_id: 'building-1',
        location: 'EG',
        component_category: BuildingComponentCategory.Bauteil,
        material: MaterialType.mat_3,
        length: null,
        width: null,
        height: null,
        name: 'Encoded pieces listing',
        address: 'Test street 1',
        price: 100,
        status: MarketListingStatus.eingelagert,
        available_from: '2026-04-22',
        potential: MarketPotential.reuse,
        quantity: '6' as any,
        unit: 'StÃ¼ck' as any,
        contact: 'user@example.com',
        images: [],
        created_at: '2026-04-22T00:00:00Z',
        updated_at: '2026-04-22T00:00:00Z'
      }
    ]));

    component.openCategory(component.materialGroups[0]);
    component.onCategoryFilterChange({
      ...component.categoryFilter,
      quantityMin: 5,
      quantityUnit: MarketListingUnit.St
    });

    expect(component.selectedCategory?.listings.map(listing => listing.id)).toEqual(['listing-encoded-pieces']);
    expect(component.activeCategoryFilterCount).toBe(1);
  });

  it('ignores non-numeric price and quantity filter values', () => {
    marketListingService.getMarketListingsByMaterialGroup.and.returnValue(of([
      {
        id: 'listing-1',
        component_id: 'part-1',
        owner_id: 'user-1',
        user_building_id: 'user-building-1',
        building_id: 'building-1',
        location: 'EG',
        component_category: BuildingComponentCategory.Bauteil,
        material: MaterialType.mat_3,
        length: null,
        width: null,
        height: null,
        name: 'Visible listing',
        address: 'Test street 1',
        price: 100,
        status: MarketListingStatus.eingelagert,
        available_from: '2026-04-22',
        potential: MarketPotential.reuse,
        quantity: 10,
        unit: MarketListingUnit.m,
        contact: 'user@example.com',
        images: [],
        created_at: '2026-04-22T00:00:00Z',
        updated_at: '2026-04-22T00:00:00Z'
      }
    ]));

    component.openCategory(component.materialGroups[0]);
    component.onCategoryFilterChange({
      ...component.categoryFilter,
      priceMin: 'abc',
      priceMax: 'def',
      quantityMin: 'keine zahl'
    } as any);

    expect(component.selectedCategory?.listings.map(listing => listing.id)).toEqual(['listing-1']);
    expect(component.activeCategoryFilterCount).toBe(0);
  });

  it('loads a clicked market listing by id and opens the detail view', () => {
    const listing = {
      id: 'listing-1',
      name: 'Selected listing'
    } as any;
    marketListingService.getMarketListingById.and.returnValue(of(listing));

    component.openMarketListing({ id: 'listing-1' });

    expect(marketListingService.getMarketListingById).toHaveBeenCalledOnceWith('listing-1');
    expect(component.activeMarketListing).toBe(listing);
    expect(component.isMarketListingViewVisible).toBeTrue();
    expect(component.isMarketListingLoading).toBeFalse();
  });

  it('formats material listing quantity units for cards', () => {
    const formatListingQuantity = (
      listing: Partial<{ component_category: BuildingComponentCategory; quantity: number; unit: MarketListingUnit }>
    ) =>
      (component as any).formatListingQuantity({
        component_category: BuildingComponentCategory.Bauteil,
        quantity: 3,
        ...listing
      });

    expect(formatListingQuantity({ unit: MarketListingUnit.St })).toBe('3 Stück');
    expect(formatListingQuantity({ unit: MarketListingUnit.m })).toBe('3 m');
    expect(formatListingQuantity({ unit: MarketListingUnit.m2 })).toBe('3 m²');
    expect(formatListingQuantity({ unit: MarketListingUnit.m3 })).toBe('3 m³');
    expect(formatListingQuantity({ unit: MarketListingUnit.kg })).toBe('3 kg');
  });

  it('appends Stück to object listing quantities for cards', () => {
    const quantity = (component as any).formatListingQuantity({
      component_category: BuildingComponentCategory.Objekt,
      quantity: 3,
      unit: MarketListingUnit.St
    });

    expect(quantity).toBe('3 Stück');
  });

  it('maps bauteil listing measurements to display dimensions', () => {
    const mappedListing = (component as any).mapApiListingToCategoryListing(
      {
        id: 'listing-1',
        component_id: 'part-1',
        owner_id: 'user-1',
        user_building_id: 'user-building-1',
        building_id: 'building-1',
        location: 'EG',
        component_category: BuildingComponentCategory.Bauteil,
        material: MaterialType.mat_3,
        length: 140,
        width: 85,
        height: 120,
        name: 'Innenwand',
        price: 100,
        status: MarketListingStatus.eingelagert,
        available_from: '2026-04-22',
        potential: MarketPotential.reuse,
        quantity: 12,
        unit: MarketListingUnit.m,
        contact: 'user@example.com',
        images: [],
        created_at: '2026-04-22T00:00:00Z',
        updated_at: '2026-04-22T00:00:00Z'
      },
      {
        id: 'category-1',
        title: 'Beton',
        kind: 'material',
        label: 'Beton',
        description: '',
        imageSrc: 'fallback.jpg',
        imageAlt: 'Fallback',
        listings: []
      }
    );

    expect(mappedListing.dimensions).toEqual([
      { label: 'Länge', value: '140 cm' },
      { label: 'Breite', value: '85 cm' },
      { label: 'Höhe', value: '120 cm' }
    ]);
  });

  it('keeps measurement rows visible when a listing has no saved measurements', () => {
    const mappedListing = (component as any).mapApiListingToCategoryListing(
      {
        id: 'listing-2',
        component_id: 'part-2',
        owner_id: 'user-1',
        user_building_id: 'user-building-1',
        building_id: 'building-1',
        location: 'EG',
        component_category: BuildingComponentCategory.Bauteil,
        material: MaterialType.mat_3,
        length: null,
        width: null,
        height: null,
        name: 'Bestandsmaterial',
        price: 100,
        status: MarketListingStatus.eingelagert,
        available_from: '2026-04-22',
        potential: MarketPotential.reuse,
        quantity: 12,
        unit: MarketListingUnit.m,
        contact: 'user@example.com',
        images: [],
        created_at: '2026-04-22T00:00:00Z',
        updated_at: '2026-04-22T00:00:00Z'
      },
      {
        id: 'category-1',
        title: 'Beton',
        kind: 'material',
        label: 'Beton',
        description: '',
        imageSrc: 'fallback.jpg',
        imageAlt: 'Fallback',
        listings: []
      }
    );

    expect(mappedListing.dimensions).toEqual([
      { label: 'Länge', value: '-' },
      { label: 'Breite', value: '-' },
      { label: 'Höhe', value: '-' }
    ]);
  });
});
