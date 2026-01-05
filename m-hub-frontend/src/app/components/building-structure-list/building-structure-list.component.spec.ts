import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BuildingStructureListComponent } from './building-structure-list.component';

describe('BuildingStructureListComponent', () => {
  let component: BuildingStructureListComponent;
  let fixture: ComponentFixture<BuildingStructureListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BuildingStructureListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BuildingStructureListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
