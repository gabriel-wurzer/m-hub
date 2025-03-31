import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StructureTreeComponent } from './structure-tree.component';

describe('StructureTreeComponent', () => {
  let component: StructureTreeComponent;
  let fixture: ComponentFixture<StructureTreeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StructureTreeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StructureTreeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
