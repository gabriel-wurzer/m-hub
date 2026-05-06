import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';

import { MarketComponent } from './market.component';
import { BuildingComponentCategory } from '../../enums/component-category';
import { MarketListingStatus } from '../../enums/market-listing-status';
import { MarketPotential } from '../../enums/market-potential.enum';
import { MarketListingUnit } from '../../enums/market-listing-unit.enum';
import { MaterialType } from '../../enums/material-type.enum';
import { MarketListingCategoryCount, MarketListingService } from '../../services/market-listing/market-listing.service';
import { MaterialGroup } from '../../enums/material-group';

describe('MarketComponent', () => {
  let component: MarketComponent;
  let fixture: ComponentFixture<MarketComponent>;
  let marketListingService: jasmine.SpyObj<MarketListingService>;

  beforeEach(async () => {
    marketListingService = jasmine.createSpyObj<MarketListingService>('MarketListingService', [
      'getMarketListingCategoryCounts',
      'getMarketListingsByMaterialGroup',
      'getMarketListingsByObjectType'
    ]);
    marketListingService.getMarketListingCategoryCounts.and.returnValue(of([]));
    marketListingService.getMarketListingsByMaterialGroup.and.returnValue(of([]));
    marketListingService.getMarketListingsByObjectType.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [MarketComponent],
      providers: [
        {
          provide: MarketListingService,
          useValue: marketListingService
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
