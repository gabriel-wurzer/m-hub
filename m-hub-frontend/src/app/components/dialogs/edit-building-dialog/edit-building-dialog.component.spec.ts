import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditBuildingDialogComponent } from './edit-building-dialog.component';

describe('EditBuildingDialogComponent', () => {
  let component: EditBuildingDialogComponent;
  let fixture: ComponentFixture<EditBuildingDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditBuildingDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditBuildingDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
