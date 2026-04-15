import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { AddListingDialogComponent } from './add-listing-dialog.component';

describe('AddListingDialogComponent', () => {
  let component: AddListingDialogComponent;
  let fixture: ComponentFixture<AddListingDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddListingDialogComponent],
      providers: [provideHttpClient()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddListingDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
