import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { DateAdapter, MAT_DATE_FORMATS, MatDateFormats } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { AddListingDialogComponent } from './add-listing-dialog.component';
import { BuildingComponentCategory } from '../../../enums/component-category';
import { MarketListingStatus } from '../../../enums/market-listing-status';
import { MarketPotential } from '../../../enums/market-potential.enum';
import { MarketListingUnit } from '../../../enums/market-listing-unit.enum';
import { ObjectType } from '../../../enums/object-type';
import { PartType } from '../../../enums/part-type.enum';
import { AuthenticationService } from '../../../services/authentication/authentication.service';

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

describe('AddListingDialogComponent', () => {
  let component: AddListingDialogComponent;
  let fixture: ComponentFixture<AddListingDialogComponent>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<AddListingDialogComponent>>;

  beforeEach(async () => {
    dialogRefSpy = jasmine.createSpyObj<MatDialogRef<AddListingDialogComponent>>('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, AddListingDialogComponent],
      providers: [
        provideHttpClient(),
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            component: {
              id: 'object-1',
              category: BuildingComponentCategory.Objekt,
              name: 'Fenster',
              description: 'Bestandsfenster',
              object_type: ObjectType.Fenster,
              count: 3,
              length: 140,
              width: 85,
              height: 120,
              location: 'EG'
            }
          }
        },
        { provide: MatDialogRef, useValue: dialogRefSpy },
        {
          provide: AuthenticationService,
          useValue: {
            getUser$: () => of({ email: 'user@example.com' })
          }
        }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddListingDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('prefills measurements from the source object', () => {
    expect(component.length).toBe(140);
    expect(component.width).toBe(85);
    expect(component.height).toBe(120);
  });

  it('shows a number error and invalidates the form for bad measurement input', () => {
    component.price = 100;
    component.status = MarketListingStatus.eingelagert;
    component.availableFrom = new Date('2099-04-22');
    component.potential = MarketPotential.reuse;
    component.quantity = 3;
    component.length = '123asd' as any;

    expect(component.getLengthError()).toBe('Länge muss eine Zahl sein');
    expect(component.isFormValid()).toBeFalse();
  });

  it('includes measurements in the dialog result', () => {
    component.price = 100;
    component.status = MarketListingStatus.eingelagert;
    component.availableFrom = new Date('2099-04-22');
    component.potential = MarketPotential.reuse;
    component.quantity = 3;

    component.confirmAddListing();

    expect(dialogRefSpy.close).toHaveBeenCalledWith(jasmine.objectContaining({
      name: 'Fenster',
      length: 140,
      width: 85,
      height: 120
    }));
  });

  it('keeps the selected image order in the dialog result', () => {
    const firstFile = new File(['first'], 'first.png', { type: 'image/png', lastModified: 1 });
    const secondFile = new File(['second'], 'second.png', { type: 'image/png', lastModified: 2 });

    component.selectedImages = [
      { file: firstFile, fileName: 'first.png', previewUrl: 'data:image/png;base64,first' },
      { file: secondFile, fileName: 'second.png', previewUrl: 'data:image/png;base64,second' }
    ];
    component.price = 100;
    component.status = MarketListingStatus.eingelagert;
    component.availableFrom = new Date('2099-04-22');
    component.potential = MarketPotential.reuse;
    component.quantity = 3;

    component.moveSelectedImage(1, -1);
    component.confirmAddListing();

    const result = dialogRefSpy.close.calls.mostRecent().args[0] as any;
    expect(result.images.map((image: any) => image.fileName)).toEqual(['second.png', 'first.png']);
  });

  it('prefills source object images as selected upload images', async () => {
    const fetchSpy = spyOn(window, 'fetch').and.callFake((input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('front') ? 'front' : 'back';
      return Promise.resolve(new Response(new Blob([body], { type: 'image/png' }), { status: 200 }));
    });

    await (component as any).prefillImagesFromObject({
      images: [
        {
          id: 'image-back',
          sort_order: 1,
          image_path: '/mhub/objects/object-1/back.png',
          image_mime_type: 'image/png',
          image_original_name: 'back.png'
        },
        {
          id: 'image-front',
          sort_order: 0,
          image_path: '/mhub/objects/object-1/front.png',
          image_mime_type: 'image/png',
          image_original_name: 'front.png'
        }
      ]
    });

    expect(fetchSpy.calls.allArgs().map((args) => args[0])).toEqual([
      '/files/mhub/objects/object-1/front.png',
      '/files/mhub/objects/object-1/back.png'
    ]);
    expect(component.selectedImages.map((image) => image.fileName)).toEqual(['front.png', 'back.png']);
    expect(component.selectedImages.every((image) => image.previewUrl.startsWith('data:image/png;base64,'))).toBeTrue();
  });

  it('commits the selected image order from the live drag placeholder position', () => {
    const firstFile = new File(['first'], 'first.png', { type: 'image/png', lastModified: 1 });
    const secondFile = new File(['second'], 'second.png', { type: 'image/png', lastModified: 2 });
    const thirdFile = new File(['third'], 'third.png', { type: 'image/png', lastModified: 3 });
    const firstImage = { file: firstFile, fileName: 'first.png', previewUrl: 'data:image/png;base64,first' };

    component.selectedImages = [
      firstImage,
      { file: secondFile, fileName: 'second.png', previewUrl: 'data:image/png;base64,second' },
      { file: thirdFile, fileName: 'third.png', previewUrl: 'data:image/png;base64,third' }
    ];

    const container = document.createElement('div');
    const placeholder = mockImageCard(container, mockRect(0, 0, 100, 80), true);
    mockImageCard(container, mockRect(120, 0, 100, 80));
    mockImageCard(container, mockRect(240, 0, 100, 80));

    component.startSelectedImageDrag({ source: { data: firstImage } } as any);
    component.sortSelectedImagePreview({
      source: {
        data: firstImage,
        dropContainer: { element: { nativeElement: container } },
        getPlaceholderElement: () => placeholder
      },
      pointerPosition: { x: 380, y: 40 }
    } as any);
    component.dropSelectedImage({ item: { data: firstImage } } as any);

    expect(container.lastElementChild).toBe(placeholder);
    expect(component.selectedImages.map((image) => image.fileName)).toEqual(['second.png', 'third.png', 'first.png']);
  });

  it('shows empty measurement fields for source parts and returns null values when unset', () => {
    const partDialogRefSpy = jasmine.createSpyObj<MatDialogRef<AddListingDialogComponent>>('MatDialogRef', ['close']);
    const partComponent = new AddListingDialogComponent(
      partDialogRefSpy,
      {
        component: {
          id: 'part-1',
          category: BuildingComponentCategory.Bauteil,
          name: 'Innenwand',
          description: 'Bestandswand',
          part_type: PartType.IW,
          part_structure: {
            type: 'wall',
            length: 12,
            layers: []
          },
          location: 'EG'
        } as any
      },
      { getUser$: () => of({ email: 'user@example.com' }) } as any
    );

    expect(partComponent.hasMeasurementFields).toBeTrue();
    expect(partComponent.length).toBeNull();
    expect(partComponent.width).toBeNull();
    expect(partComponent.height).toBeNull();

    partComponent.name = 'Innenwand';
    partComponent.price = 100;
    partComponent.status = MarketListingStatus.eingelagert;
    partComponent.availableFrom = new Date('2099-04-22');
    partComponent.potential = MarketPotential.reuse;
    partComponent.quantity = 12;
    partComponent.unit = MarketListingUnit.m;

    partComponent.confirmAddListing();

    expect(partDialogRefSpy.close).toHaveBeenCalledWith(jasmine.objectContaining({
      length: null,
      width: null,
      height: null
    }));
  });

  it('invalidates available-from dates in the past', () => {
    component.price = 100;
    component.status = MarketListingStatus.eingelagert;
    component.availableFrom = new Date(component.minAvailableFromDate);
    component.availableFrom.setDate(component.availableFrom.getDate() - 1);
    component.potential = MarketPotential.reuse;
    component.quantity = 3;

    expect(component.getAvailableFromError()).toBe('Datum liegt in der Vergangenheit');
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
