import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PartStructureListComponent } from './part-structure-list.component';
import { PartType } from '../../enums/part-type.enum';
import { Material } from '../../enums/material.enum';

describe('PartStructureListComponent', () => {
  let component: PartStructureListComponent;
  let fixture: ComponentFixture<PartStructureListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartStructureListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PartStructureListComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should initialize a wall structure for wall part types', () => {
    component.partType = PartType.Innenwand;
    fixture.detectChanges();

    expect(component.structureType).toBe('wall');
    expect(component.layers.length).toBe(1);
  });

  it('should initialize a floor structure for floor part types', () => {
    component.partType = PartType.Boden;
    fixture.detectChanges();

    expect(component.structureType).toBe('slab');
    expect(component.layers.length).toBe(1);
  });

  it('should report valid once required layer data is complete for wall', () => {
    let lastValidity: boolean | undefined;
    component.validityChange.subscribe((value) => {
      lastValidity = value;
    });

    component.partType = PartType.Aussenwand;
    fixture.detectChanges();

    component.layers[0].material = Material.mat_3;
    component.layers[0].thickness = 240;
    component.layers[0].length = 12.5;
    component.emitChanges();

    expect(lastValidity).toBeTrue();
  });

  it('should report invalid when numeric values are smaller than 1', () => {
    let lastValidity: boolean | undefined;
    component.validityChange.subscribe((value) => {
      lastValidity = value;
    });

    component.partType = PartType.Aussenwand;
    fixture.detectChanges();

    component.layers[0].material = Material.mat_3;
    component.layers[0].thickness = 0.5;
    component.layers[0].length = 12.5;
    component.emitChanges();

    expect(lastValidity).toBeFalse();
  });
});
