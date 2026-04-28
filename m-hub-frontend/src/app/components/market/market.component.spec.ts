import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarketComponent } from './market.component';
import { BuildingComponentCategory } from '../../enums/component-category';
import { MarketListingStatus } from '../../enums/market-listing-status';
import { MarketPotential } from '../../enums/market-potential.enum';
import { MarketListingUnit } from '../../enums/market-listing-unit.enum';
import { MaterialType } from '../../enums/material-type.enum';
import { MarketListingService } from '../../services/market-listing/market-listing.service';

describe('MarketComponent', () => {
  let component: MarketComponent;
  let fixture: ComponentFixture<MarketComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketComponent],
      providers: [
        {
          provide: MarketListingService,
          useValue: {}
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
