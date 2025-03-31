import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BuildingSidepanelComponent } from './building-sidepanel.component';

describe('BuildingInformationComponent', () => {
  let component: BuildingSidepanelComponent;
  let fixture: ComponentFixture<BuildingSidepanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BuildingSidepanelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BuildingSidepanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
