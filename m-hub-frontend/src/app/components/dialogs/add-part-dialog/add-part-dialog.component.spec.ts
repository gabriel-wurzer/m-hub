import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { AddPartDialogComponent } from './add-part-dialog.component';
import { FloorType } from '../../../enums/floor-type.enum';
import { PartType } from '../../../enums/part-type.enum';
import { RoofType } from '../../../enums/roof-type.enum';
import { Floor } from '../../../models/floor';

describe('AddPartDialogComponent', () => {
  let component: AddPartDialogComponent;
  let fixture: ComponentFixture<AddPartDialogComponent>;

  const structure: Floor[] = [
    { type: FloorType.D, roofType: RoofType.F } as Floor,
    { type: FloorType.RG, count: 1, height: 300, area: 100 } as Floor,
    { type: FloorType.KG, count: 1, height: 260, area: 90 } as Floor
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddPartDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { structure } },
        { provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddPartDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should disable part type selection before location is selected', () => {
    expect(component.selectedLocations).toEqual([]);
    expect(component.availablePartTypes).toEqual([]);
    expect(component.isPartTypeSelectionDisabled()).toBeTrue();
  });

  it('should filter roof part types for Flachdach', () => {
    component.selectedLocations = [FloorType.D];
    component.onLocationsChange();

    expect(component.availablePartTypes).toEqual([PartType.Attika, PartType.Dachaufbau]);
  });

  it('should exclude Dachaufbau for Kellergeschoss', () => {
    component.selectedLocations = [`${FloorType.KG} 1`];
    component.onLocationsChange();

    expect(component.availablePartTypes).toContain(PartType.Boden);
    expect(component.availablePartTypes).not.toContain(PartType.Dachaufbau);
    expect(component.availablePartTypes).not.toContain(PartType.Kniestock);
    expect(component.availablePartTypes).not.toContain(PartType.Attika);
  });

  it('should reset selected part type when location change makes it invalid', () => {
    component.selectedLocations = [FloorType.D];
    component.onLocationsChange();
    component.partType = PartType.Attika;

    component.selectedLocations = [`${FloorType.KG} 1`];
    component.onLocationsChange();

    expect(component.partType).toBeNull();
  });
});
