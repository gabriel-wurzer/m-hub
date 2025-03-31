import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StructureDetailsComponent } from './structure-details.component';

describe('StructureDetailsComponent', () => {
  let component: StructureDetailsComponent;
  let fixture: ComponentFixture<StructureDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StructureDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StructureDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
