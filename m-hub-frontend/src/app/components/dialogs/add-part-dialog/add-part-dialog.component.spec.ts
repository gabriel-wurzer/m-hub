import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddPartDialogComponent } from './add-part-dialog.component';

describe('AddPartDialogComponent', () => {
  let component: AddPartDialogComponent;
  let fixture: ComponentFixture<AddPartDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddPartDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddPartDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
