import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { AddListingDialogComponent } from './add-listing-dialog.component';
import { BuildingComponentCategory } from '../../../enums/component-category';
import { MarketListingStatus } from '../../../enums/market-listing-status';
import { MarketPotential } from '../../../enums/market-potential.enum';
import { ObjectType } from '../../../enums/object-type';
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
});
