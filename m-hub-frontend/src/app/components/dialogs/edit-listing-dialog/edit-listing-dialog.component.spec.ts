import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { BuildingComponentCategory } from '../../../enums/component-category';
import { MarketListingStatus } from '../../../enums/market-listing-status';
import { MarketListingUnit } from '../../../enums/market-listing-unit.enum';
import { MarketPotential } from '../../../enums/market-potential.enum';
import { ObjectType } from '../../../enums/object-type';
import { MarketListing } from '../../../models/market-listing';
import { EditListingDialogComponent } from './edit-listing-dialog.component';

describe('EditListingDialogComponent', () => {
  let component: EditListingDialogComponent;
  let fixture: ComponentFixture<EditListingDialogComponent>;
  let listing: MarketListing;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<EditListingDialogComponent>>;

  beforeEach(async () => {
    dialogRefSpy = jasmine.createSpyObj<MatDialogRef<EditListingDialogComponent>>('MatDialogRef', ['close']);
    listing = {
      id: 'listing-1',
      component_id: 'object-1',
      owner_id: 'owner-1',
      user_building_id: 'building-user-1',
      building_id: 'building-1',
      location: 'EG',
      component_category: BuildingComponentCategory.Objekt,
      object_type: ObjectType.Fenster,
      length: 100,
      width: 80,
      height: 10,
      name: 'Fenster Inserat',
      address: 'Testgasse 1',
      description: 'Beschreibung',
      price: 120,
      status: MarketListingStatus.eingelagert,
      available_from: '2026-05-05',
      potential: MarketPotential.reuse,
      quantity: 2,
      unit: MarketListingUnit.St,
      contact: 'alice@example.com',
      images: [
        {
          id: 'image-2',
          market_listing_id: 'listing-1',
          sort_order: 2,
          image_path: '/mhub/market-listings/listing-1/image-2.jpg',
          image_original_name: 'zweit.jpg',
          image_url: 'http://localhost:8888/mhub/market-listings/listing-1/image-2.jpg',
          created_at: '2026-05-05T00:00:00Z',
          updated_at: '2026-05-05T00:00:00Z'
        },
        {
          id: 'image-1',
          market_listing_id: 'listing-1',
          sort_order: 1,
          image_path: '/mhub/market-listings/listing-1/image-1.jpg',
          image_original_name: 'erst.jpg',
          image_url: 'http://localhost:8888/mhub/market-listings/listing-1/image-1.jpg',
          created_at: '2026-05-05T00:00:00Z',
          updated_at: '2026-05-05T00:00:00Z'
        }
      ],
      created_at: '2026-05-05T00:00:00Z',
      updated_at: '2026-05-05T00:00:00Z'
    } as MarketListing;

    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, EditListingDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { listing } },
        { provide: MatDialogRef, useValue: dialogRefSpy }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditListingDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders existing images without throwing from trackBy', () => {
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(component.trackByExistingImage(0, component.existingImages[0])).toBe('existing:image-1');

    const images = fixture.nativeElement.querySelectorAll('.image-preview-card');
    expect(images.length).toBe(2);
  });

  it('returns remaining existing image ids after an existing image is removed', () => {
    component.removeExistingImageAt(0);
    component.confirmEditListing();

    expect(dialogRefSpy.close).toHaveBeenCalledWith(jasmine.objectContaining({
      existing_image_ids: ['image-2']
    }));
  });

  it('returns explicit existing image order after reordering', () => {
    component.moveImageItem(0, 1);
    component.confirmEditListing();

    expect(dialogRefSpy.close).toHaveBeenCalledWith(jasmine.objectContaining({
      existing_image_ids: ['image-2', 'image-1'],
      existing_image_orders: [
        { id: 'image-2', sort_order: 0 },
        { id: 'image-1', sort_order: 1 }
      ]
    }));
  });
});
