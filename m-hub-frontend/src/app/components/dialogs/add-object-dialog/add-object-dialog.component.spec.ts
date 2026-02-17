import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddObjectDialogComponent } from './add-object-dialog.component';

describe('AddObjectDialogComponent', () => {
  let component: AddObjectDialogComponent;
  let fixture: ComponentFixture<AddObjectDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddObjectDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddObjectDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
