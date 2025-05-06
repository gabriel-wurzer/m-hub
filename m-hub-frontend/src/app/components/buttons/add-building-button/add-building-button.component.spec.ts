import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddBuildingButtonComponent } from './add-building-button.component';

describe('AddBuildingButtonComponent', () => {
  let component: AddBuildingButtonComponent;
  let fixture: ComponentFixture<AddBuildingButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddBuildingButtonComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddBuildingButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
