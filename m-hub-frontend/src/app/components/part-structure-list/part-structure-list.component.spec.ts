import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PartStructureListComponent } from './part-structure-list.component';
import { PartType } from '../../enums/part-type.enum';
import { ConnectionType } from '../../enums/connection-type.enum';
import { MaterialType } from '../../enums/material-type.enum';
import { UNKNOWN_LAYER_MATERIAL } from '../../models/layer-material';

describe('PartStructureListComponent', () => {
  let component: PartStructureListComponent;
  let fixture: ComponentFixture<PartStructureListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, PartStructureListComponent]
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
    component.partType = PartType.IW;
    fixture.detectChanges();

    expect(component.structureType).toBe('wall');
    expect(component.layers.length).toBe(1);
  });

  it('should initialize a floor structure for floor part types', () => {
    component.partType = PartType.BA;
    fixture.detectChanges();

    expect(component.structureType).toBe('slab');
    expect(component.layers.length).toBe(1);
  });

  it('should expose all layer material options', () => {
    fixture.detectChanges();

    expect(component.layerMaterials).toContain(MaterialType.mat_3);
    expect(component.layerMaterials).toContain(UNKNOWN_LAYER_MATERIAL);
    expect(component.layerMaterials).toContain(ConnectionType.conn_1);
  });

  it('should report valid once required layer data is complete for wall', () => {
    let lastValidity: boolean | undefined;
    component.validityChange.subscribe((value) => {
      lastValidity = value;
    });

    component.partType = PartType.AW;
    fixture.detectChanges();

    component.layers[0].material = MaterialType.mat_3;
    component.layers[0].thickness = 240;
    component.structureMeasure = 12.5;
    component.emitChanges();

    expect(lastValidity).toBeTrue();
  });

  it('should report invalid when numeric values are smaller than 1', () => {
    let lastValidity: boolean | undefined;
    component.validityChange.subscribe((value) => {
      lastValidity = value;
    });

    component.partType = PartType.AW;
    fixture.detectChanges();

    component.layers[0].material = MaterialType.mat_3;
    component.layers[0].thickness = 0.5;
    component.structureMeasure = 12.5;
    component.emitChanges();

    expect(lastValidity).toBeFalse();
  });

  it('should force thickness to 0 for connection type materials and keep the structure invalid on its own', () => {
    let lastValidity: boolean | undefined;
    let emittedStructure: any;
    component.validityChange.subscribe((value) => {
      lastValidity = value;
    });
    component.structureChange.subscribe((value) => {
      emittedStructure = value;
    });

    component.partType = PartType.AW;
    fixture.detectChanges();

    component.layers[0].material = ConnectionType.conn_1;
    component.layers[0].thickness = 240;
    component.structureMeasure = 12.5;
    component.emitChanges();

    expect(component.layers[0].thickness).toBe(0);
    expect(emittedStructure?.layers?.[0]?.thickness).toBe(0);
    expect(lastValidity).toBeFalse();
  });

  it('should force thickness to 0 for unknown material and keep the structure invalid on its own', () => {
    let lastValidity: boolean | undefined;
    let emittedStructure: any;
    component.validityChange.subscribe((value) => {
      lastValidity = value;
    });
    component.structureChange.subscribe((value) => {
      emittedStructure = value;
    });

    component.partType = PartType.AW;
    fixture.detectChanges();

    component.layers[0].material = UNKNOWN_LAYER_MATERIAL;
    component.layers[0].thickness = 180;
    component.structureMeasure = 12.5;
    component.emitChanges();

    expect(component.layers[0].thickness).toBe(0);
    expect(emittedStructure?.layers?.[0]?.thickness).toBe(0);
    expect(lastValidity).toBeFalse();
  });

  it('should report valid when at least one layer has a thickness greater than 0', () => {
    let lastValidity: boolean | undefined;
    let emittedStructure: any;
    component.validityChange.subscribe((value) => {
      lastValidity = value;
    });
    component.structureChange.subscribe((value) => {
      emittedStructure = value;
    });

    component.partType = PartType.AW;
    fixture.detectChanges();
    component.addLayer();

    component.layers[0].material = ConnectionType.conn_1;
    component.layers[0].thickness = 180;
    component.layers[1].material = MaterialType.mat_3;
    component.layers[1].thickness = 240;
    component.structureMeasure = 12.5;
    component.emitChanges();

    expect(component.layers[0].thickness).toBe(0);
    expect(emittedStructure?.layers?.[0]?.thickness).toBe(0);
    expect(emittedStructure?.layers?.[1]?.thickness).toBe(240);
    expect(lastValidity).toBeTrue();
  });

  it('should emit measure on structure level instead of per layer', () => {
    let emittedStructure: any;
    component.structureChange.subscribe((value) => {
      emittedStructure = value;
    });

    component.partType = PartType.AW;
    fixture.detectChanges();

    component.layers[0].material = MaterialType.mat_3;
    component.layers[0].thickness = 240;
    component.structureMeasure = 12.5;
    component.emitChanges();

    expect(emittedStructure?.type).toBe('wall');
    expect(emittedStructure?.length).toBe(12.5);
    expect(emittedStructure?.layers?.[0]?.length).toBeUndefined();
  });
});
