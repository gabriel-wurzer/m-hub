import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { BuildingComponentCategory } from '../../enums/component-category';
import { MarketListingStatus } from '../../enums/market-listing-status';
import { MarketListingUnit } from '../../enums/market-listing-unit.enum';
import { MarketPotential } from '../../enums/market-potential.enum';
import { MarketListing } from '../../models/market-listing';
import { MarketListingService } from '../../services/market-listing/market-listing.service';
import { MarketListingComponent } from './market-listing.component';

describe('MarketListingComponent', () => {
  let component: MarketListingComponent;
  let fixture: ComponentFixture<MarketListingComponent>;
  let marketListingService: jasmine.SpyObj<MarketListingService>;

  beforeEach(async () => {
    marketListingService = jasmine.createSpyObj<MarketListingService>('MarketListingService', [
      'getMarketListingsByMaterialGroup',
      'getMarketListingsByObjectType'
    ]);

    await TestBed.configureTestingModule({
      imports: [MarketListingComponent],
      providers: [
        {
          provide: MarketListingService,
          useValue: marketListingService
        },
        {
          provide: Router,
          useValue: { navigate: jasmine.createSpy('navigate') }
        }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MarketListingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('emits selected similar listing ids', () => {
    const selectedListings: Pick<MarketListing, 'id'>[] = [];
    component.listing = createListing('listing-1');
    component.similarListingSelect.subscribe(listing => selectedListings.push(listing));

    component.openSimilarListing(createListing('listing-2'));

    expect(selectedListings).toEqual([{ id: 'listing-2' }]);
  });

  it('does not emit the current listing as a similar listing selection', () => {
    const emitSpy = spyOn(component.similarListingSelect, 'emit');
    component.listing = createListing('listing-1');

    component.openSimilarListing(createListing('listing-1'));

    expect(emitSpy).not.toHaveBeenCalled();
  });
});

function createListing(id: string): MarketListing {
  return {
    id,
    component_id: 'component-1',
    owner_id: 'user-1',
    user_building_id: 'user-building-1',
    building_id: 'building-1',
    location: 'EG',
    component_category: BuildingComponentCategory.Bauteil,
    name: 'Test listing',
    address: 'Test street 1',
    price: 100,
    status: MarketListingStatus.eingelagert,
    potential: MarketPotential.reuse,
    quantity: 1,
    unit: MarketListingUnit.St,
    contact: 'user@example.com',
    images: [],
    created_at: '2026-05-19T00:00:00Z',
    updated_at: '2026-05-19T00:00:00Z'
  };
}
