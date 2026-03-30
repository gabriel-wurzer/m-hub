import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditPartDialogComponent } from './edit-part-dialog.component';

describe('EditPartDialogComponent', () => {
  let component: EditPartDialogComponent;
  let fixture: ComponentFixture<EditPartDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditPartDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditPartDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
