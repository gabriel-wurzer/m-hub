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
    component.onLocationsChange([FloorType.D]);

    expect(component.availablePartTypes).toEqual([PartType.A, PartType.DA]);
  });

  it('should exclude Dachaufbau for Kellergeschoss', () => {
    component.onLocationsChange([`${FloorType.KG} 1`]);

    expect(component.availablePartTypes).toContain(PartType.BA);
    expect(component.availablePartTypes).not.toContain(PartType.DA);
    expect(component.availablePartTypes).not.toContain(PartType.KS);
    expect(component.availablePartTypes).not.toContain(PartType.A);
  });

  it('should reset selected part type when location change makes it invalid', () => {
    component.onLocationsChange([FloorType.D]);
    component.partType = PartType.A;

    component.onLocationsChange([`${FloorType.KG} 1`]);

    expect(component.partType).toBeNull();
  });
});
