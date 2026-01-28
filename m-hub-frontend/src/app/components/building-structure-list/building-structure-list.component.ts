import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { trigger, transition, style, animate } from '@angular/animations';

import { Floor, RoofFloor, StandardFloor } from '../../models/floor';
import { FloorType } from '../../enums/floor-type.enum'; 
import { RoofType } from '../../enums/roof-type.enum'; 
import { ErrorStateMatcher } from '@angular/material/core';

class FloorSelectMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null): boolean {
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}

@Component({
selector: 'app-building-structure-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatInputModule, MatButtonModule, 
    MatSelectModule, MatIconModule, MatTooltipModule
  ],
  templateUrl: './building-structure-list.component.html',
  styleUrl: './building-structure-list.component.scss',
  animations: [
    trigger('rowAnimation', [
      transition(':enter', [
        style({ 
          opacity: 0, 
          height: '0px', 
          overflow: 'hidden',
          marginBottom: '0px',
          paddingTop: '0px',
          paddingBottom: '0px',
          transform: 'scale(0.95)',
          backgroundColor: 'rgba(23, 155, 222, 0.15)' 
        }),
        animate('300ms ease-out', style({ 
          opacity: 1, 
          height: '*', 
          marginBottom: '*', 
          paddingTop: '*', 
          paddingBottom: '*',
          transform: 'scale(1)'
        })),
        animate('800ms 200ms ease-in-out', style({ 
          backgroundColor: 'transparent' 
        }))
      ]),
      transition(':leave', [
        style({ overflow: 'hidden' }),
        animate('250ms ease-in', style({ 
          backgroundColor: 'rgba(230, 108, 26, 0.2)',
          transform: 'scale(1.02)' 
        })),
        animate('450ms ease-in', style({ 
          opacity: 0, 
          transform: 'scale(0.9)', 
          height: 0, 
          margin: 0,
          padding: 0 
        }))
      ])
    ])
  ]
})
export class BuildingStructureListComponent implements OnInit {

  @Input() structure: Floor[] = [];
  @Input() disableAnimations = false;
  
  @Output() structureChange = new EventEmitter<Floor[]>();
  @Output() validityChange = new EventEmitter<boolean>();

  matcher = new FloorSelectMatcher();

  FloorType = FloorType;
  RoofType = RoofType;
  roofTypes = Object.values(RoofType);
  
  floorSvgUrl = 'assets/images/geschoss.svg';
  roofSvgUrl = 'assets/images/dach.svg';
  animationsDisabled = true;

  ngOnInit(): void {
    // If empty (Add Mode), initialize default
    if (!this.structure || this.structure.length === 0) {
      this.structure = [
        { type: FloorType.D } as RoofFloor, 
        this.createRegularFloor()
      ];
    }
    // Prevent animation on load
    setTimeout(() => this.animationsDisabled = false);

    // Initial validity check
    this.emitChanges();
  }

  // --- Getters ---
  get roofFloor(): RoofFloor {
    return this.structure.find(f => f.type === FloorType.D) as RoofFloor;
  }
  get regularFloors(): StandardFloor[] {
    return this.structure.filter(f => f.type === FloorType.RG) as StandardFloor[];
  }
  get basementFloors(): StandardFloor[] {
    return this.structure.filter(f => f.type === FloorType.KG) as StandardFloor[];
  }

  private createRegularFloor(): StandardFloor {
    return {
      type: FloorType.RG,
      count: null,
      height: null,
      area: null,
      name: '',
    } as unknown as StandardFloor; // Cast to satisfy strict typing if model requires number
  }

  addRegularFloor(): void {
    const index = 1 + this.regularFloors.length;
    this.structure.splice(index, 0, this.createRegularFloor());
    this.emitChanges();
  }

  removeRegularFloor(i: number): void {
    if (this.regularFloors.length <= 1) {
      return;
    }

    const floor = this.regularFloors[i];
    const idx = this.structure.indexOf(floor);
    if (idx > -1) this.structure.splice(idx, 1);
    this.emitChanges();
  }

  addBasementFloor(): void {
    this.structure.push({
      type: FloorType.KG,
      count: null,
      height: null,
      area: null,
      name: '',
    } as any);
    this.emitChanges();
  }

  removeBasementFloor(i: number): void {
    const floor = this.basementFloors[i];
    const idx = this.structure.indexOf(floor);
    if (idx > -1) this.structure.splice(idx, 1);
    this.emitChanges();
  }

  emitChanges(): void {
    const isValid = this.checkValidity();

    this.structureChange.emit(this.structure);
    this.validityChange.emit(isValid);
  }

  checkValidity(): boolean {
    const roof = this.roofFloor;
    const isRoofValid = !!roof && !!(roof as any).roofType;

    // Check Regular Floors
    const hasRegularFloors = this.regularFloors.length > 0;
    const areRegularFloorsValid = this.regularFloors.every(f => 
      f.count !== null && f.count > 0 && Number.isInteger(f.count) &&
      f.height !== null && f.height > 0 &&
      f.area !== null && f.area > 0
    );

    // Check Basement Floors
    const areBasementFloorsValid = this.basementFloors.every(f => 
      f.count !== null && f.count > 0 && Number.isInteger(f.count) &&
      f.height !== null && f.height > 0 &&
      f.area !== null && f.area > 0
    );

    return isRoofValid && hasRegularFloors && areRegularFloorsValid && areBasementFloorsValid;
  }
}
