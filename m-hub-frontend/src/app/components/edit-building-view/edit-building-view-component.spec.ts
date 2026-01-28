import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditBuildingViewComponent } from './edit-building-view.component';

describe('EditBuildingViewComponent', () => {
  let component: EditBuildingViewComponent;
  let fixture: ComponentFixture<EditBuildingViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditBuildingViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditBuildingViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
