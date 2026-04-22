import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { EditObjectDialogComponent } from './edit-object-dialog.component';
import { BuildingComponentCategory } from '../../../enums/component-category';
import { ObjectType } from '../../../enums/object-type';

describe('EditObjectDialogComponent', () => {
  let component: EditObjectDialogComponent;
  let fixture: ComponentFixture<EditObjectDialogComponent>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<EditObjectDialogComponent>>;

  beforeEach(async () => {
    dialogRefSpy = jasmine.createSpyObj<MatDialogRef<EditObjectDialogComponent>>('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, EditObjectDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            object: {
              id: 'object-1',
              building_id: '5363852',
              user_building_id: 'user-building-1',
              owner_id: 'owner-1',
              category: BuildingComponentCategory.Objekt,
              name: 'Bestandsfenster',
              description: 'Objekt mit Abmessungen',
              object_type: ObjectType.Fenster,
              count: 3,
              length: 150,
              width: 95,
              height: 135,
              location: 'Regelgeschoss 1',
              is_public: true,
              is_hazardous: false
            }
          }
        },
        { provide: MatDialogRef, useValue: dialogRefSpy }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditObjectDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should prefill measurements from the object data', () => {
    expect(component.length).toBe(150);
    expect(component.width).toBe(95);
    expect(component.height).toBe(135);
  });

  it('should include measurements in the edit result', () => {
    component.confirmEditObject();

    expect(dialogRefSpy.close).toHaveBeenCalledWith(jasmine.objectContaining({
      name: 'Bestandsfenster',
      objectType: ObjectType.Fenster,
      number: 3,
      length: 150,
      width: 95,
      height: 135
    }));
  });
});
