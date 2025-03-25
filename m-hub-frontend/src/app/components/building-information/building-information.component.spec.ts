import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BuildingInformationComponent } from './building-information.component';

describe('BuildingInformationComponent', () => {
  let component: BuildingInformationComponent;
  let fixture: ComponentFixture<BuildingInformationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BuildingInformationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BuildingInformationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
