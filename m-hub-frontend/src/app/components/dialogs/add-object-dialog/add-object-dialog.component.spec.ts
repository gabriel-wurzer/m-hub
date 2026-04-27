import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { AddObjectDialogComponent } from './add-object-dialog.component';
import { ObjectType } from '../../../enums/object-type';

describe('AddObjectDialogComponent', () => {
  let component: AddObjectDialogComponent;
  let fixture: ComponentFixture<AddObjectDialogComponent>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<AddObjectDialogComponent>>;

  beforeEach(async () => {
    dialogRefSpy = jasmine.createSpyObj<MatDialogRef<AddObjectDialogComponent>>('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, AddObjectDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: null },
        { provide: MatDialogRef, useValue: dialogRefSpy }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddObjectDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should consider optional measurements in form validity', () => {
    component.name = 'Türblatt';
    component.objectType = ObjectType.Fenster;
    component.number = 1;
    component.length = 120;
    component.width = 0;
    component.height = 210;

    expect(component.isFormValid()).toBeFalse();

    component.width = 80;

    expect(component.isFormValid()).toBeTrue();
  });

  it('should show a number error and invalidate the form for bad measurement input', () => {
    component.name = 'Fenster';
    component.objectType = ObjectType.Fenster;
    component.number = 1;
    component.length = '123asd' as any;

    expect(component.getLengthError()).toBe('Länge muss eine Zahl sein');
    expect(component.isFormValid()).toBeFalse();
  });

  it('should include measurements in the dialog result', () => {
    component.name = 'Fenster';
    component.objectType = ObjectType.Fenster;
    component.number = 2;
    component.length = 140;
    component.width = 90;
    component.height = 130;

    component.confirmAddObject();

    expect(dialogRefSpy.close).toHaveBeenCalledWith(jasmine.objectContaining({
      name: 'Fenster',
      objectType: ObjectType.Fenster,
      number: 2,
      length: 140,
      width: 90,
      height: 130
    }));
  });
});
