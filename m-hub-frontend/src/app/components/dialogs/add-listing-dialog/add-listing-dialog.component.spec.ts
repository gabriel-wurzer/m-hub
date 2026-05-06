import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
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
    component.availableFrom = new Date('2026-04-22');
    component.potential = MarketPotential.reuse;
    component.quantity = 3;
    component.length = '123asd' as any;

    expect(component.getLengthError()).toBe('Länge muss eine Zahl sein');
    expect(component.isFormValid()).toBeFalse();
  });

  it('includes measurements in the dialog result', () => {
    component.price = 100;
    component.status = MarketListingStatus.eingelagert;
    component.availableFrom = new Date('2026-04-22');
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
    component.availableFrom = new Date('2026-04-22');
    component.potential = MarketPotential.reuse;
    component.quantity = 3;

    component.moveSelectedImage(1, -1);
    component.confirmAddListing();

    const result = dialogRefSpy.close.calls.mostRecent().args[0] as any;
    expect(result.images.map((image: any) => image.fileName)).toEqual(['second.png', 'first.png']);
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
    partComponent.availableFrom = new Date('2026-04-22');
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
});
