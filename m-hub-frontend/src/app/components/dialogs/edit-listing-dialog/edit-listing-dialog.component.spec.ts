import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DateAdapter, MAT_DATE_FORMATS, MatDateFormats } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { BuildingComponentCategory } from '../../../enums/component-category';
import { MarketListingStatus } from '../../../enums/market-listing-status';
import { MarketListingUnit } from '../../../enums/market-listing-unit.enum';
import { MarketPotential } from '../../../enums/market-potential.enum';
import { ObjectType } from '../../../enums/object-type';
import { MarketListing } from '../../../models/market-listing';
import { EditListingDialogComponent } from './edit-listing-dialog.component';

function mockImageCard(container: HTMLElement, rect: DOMRect, isPlaceholder = false): HTMLElement {
  const card = document.createElement('div');
  card.classList.add('sortable-image-card');
  if (isPlaceholder) {
    card.classList.add('cdk-drag-placeholder');
  }
  spyOn(card, 'getBoundingClientRect').and.returnValue(rect);
  container.appendChild(card);
  return card;
}

function mockRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({})
  } as DOMRect;
}

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
      available_from: '2099-05-05',
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

  it('commits the image order from the live drag placeholder position', () => {
    const draggedImage = component.imageItems[0];
    const container = document.createElement('div');
    const placeholder = mockImageCard(container, mockRect(0, 0, 100, 80), true);
    mockImageCard(container, mockRect(120, 0, 100, 80));

    component.startImageItemDrag({ source: { data: draggedImage } } as any);
    component.sortImageItemPreview({
      source: {
        data: draggedImage,
        dropContainer: { element: { nativeElement: container } },
        getPlaceholderElement: () => placeholder
      },
      pointerPosition: { x: 260, y: 40 }
    } as any);
    component.dropImageItem({ item: { data: draggedImage } } as any);
    component.confirmEditListing();

    expect(container.lastElementChild).toBe(placeholder);
    expect(component.imageItems.map((image) => image.fileName)).toEqual(['zweit.jpg', 'erst.jpg']);
    expect(dialogRefSpy.close).toHaveBeenCalledWith(jasmine.objectContaining({
      existing_image_ids: ['image-2', 'image-1']
    }));
  });

  it('invalidates available-from dates in the past', () => {
    component.availableFrom = new Date(component.minAvailableFromDate);
    component.availableFrom.setDate(component.availableFrom.getDate() - 1);

    expect(component.getAvailableFromError()).toBe('Datum darf nicht in der Vergangenheit liegen');
    expect(component.isFormValid()).toBeFalse();
  });

  it('uses dd.mm.yyyy as the Material datepicker input format', () => {
    const adapter = fixture.debugElement.injector.get(DateAdapter);
    const formats = fixture.debugElement.injector.get<MatDateFormats>(MAT_DATE_FORMATS);

    expect(adapter.format(new Date(2099, 3, 22), formats.display.dateInput)).toBe('22.04.2099');
    expect(adapter.parse('22.04.2099', formats.parse.dateInput)).toEqual(new Date(2099, 3, 22));
  });

  it('formats years below 1000 with four digits for the API payload', () => {
    const formatDateForPayload = (component as any).formatDateForPayload.bind(component);

    expect(formatDateForPayload(new Date(999, 0, 2))).toBe('0999-01-02');
  });
});
