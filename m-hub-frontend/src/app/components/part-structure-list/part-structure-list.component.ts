import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Material } from '../../enums/material.enum';
import { PartType } from '../../enums/part-type.enum';
import {
  PartLayer,
  PartStructure,
  PartStructureMeasureType,
  PartStructureOrientation,
  getPartStructureMeasureType,
  getPartStructureOrientation
} from '../../models/part-structure';

@Component({
  selector: 'app-part-structure-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTooltipModule
  ],
  templateUrl: './part-structure-list.component.html',
  styleUrl: './part-structure-list.component.scss',
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
        animate(
          '300ms ease-out',
          style({
            opacity: 1,
            height: '*',
            marginBottom: '*',
            paddingTop: '*',
            paddingBottom: '*',
            transform: 'scale(1)'
          })
        ),
        animate(
          '800ms 200ms ease-in-out',
          style({
            backgroundColor: 'transparent'
          })
        )
      ]),
      transition(':leave', [
        style({ overflow: 'hidden' }),
        animate(
          '250ms ease-in',
          style({
            backgroundColor: 'rgba(230, 108, 26, 0.2)',
            transform: 'scale(1.02)'
          })
        ),
        animate(
          '450ms ease-in',
          style({
            opacity: 0,
            transform: 'scale(0.9)',
            height: 0,
            margin: 0,
            padding: 0
          })
        )
      ])
    ])
  ]
})
export class PartStructureListComponent implements OnInit, OnChanges {
  @Input() partType: PartType | null = null;
  @Input() structure: PartStructure | null = null;
  @Output() structureChange = new EventEmitter<PartStructure | null>();
  @Output() validityChange = new EventEmitter<boolean>();

  readonly materials: Material[] = Object.values(Material);
  readonly minimumLayerValue = 1;

  orientation: PartStructureOrientation | null = null;
  measureType: PartStructureMeasureType | null = null;
  layers: PartLayer[] = [];
  animationsDisabled = true;
  private lastEmittedStructureJson: string | null = null;
  private lastEmittedValidity: boolean | null = null;

  ngOnInit(): void {
    this.syncFromInputs();
    setTimeout(() => (this.animationsDisabled = false));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['partType'] || changes['structure']) {
      this.syncFromInputs();
    }
  }

  get isWallStructure(): boolean {
    return this.orientation === PartStructureOrientation.Vertical;
  }

  get isFloorStructure(): boolean {
    return this.orientation === PartStructureOrientation.Horizontal;
  }

  get directionStartLabel(): string {
    return this.isWallStructure ? 'Innen' : 'Oben';
  }

  get directionEndLabel(): string {
    return this.isWallStructure ? 'Außen' : 'Unten';
  }

  get orientationHint(): string {
    if (this.isWallStructure) {
      return 'Schichten laufen von links (innen) nach rechts (außen).';
    }

    if (this.isFloorStructure) {
      return 'Schichten laufen von oben (höchste Lage) nach unten.';
    }

    return '';
  }

  addLayer(): void {
    if (!this.orientation || !this.measureType) {
      return;
    }

    this.layers.push(this.createEmptyLayer(this.layers.length + 1));
    this.emitChanges();
  }

  removeLayer(index: number): void {
    if (index < 0 || index >= this.layers.length) {
      return;
    }

    this.layers.splice(index, 1);

    if (this.layers.length === 0) {
      this.layers.push(this.createEmptyLayer(1));
    }

    this.reindexLayers();
    this.emitChanges();
  }

  moveLayerUp(index: number): void {
    if (index <= 0 || index >= this.layers.length) {
      return;
    }

    [this.layers[index - 1], this.layers[index]] = [this.layers[index], this.layers[index - 1]];
    this.reindexLayers();
    this.emitChanges();
  }

  moveLayerDown(index: number): void {
    if (index < 0 || index >= this.layers.length - 1) {
      return;
    }

    [this.layers[index], this.layers[index + 1]] = [this.layers[index + 1], this.layers[index]];
    this.reindexLayers();
    this.emitChanges();
  }

  emitChanges(): void {
    if (!this.orientation || !this.measureType) {
      this.emitIfChanged(null, false);
      return;
    }

    this.reindexLayers();

    const structure: PartStructure = {
      orientation: this.orientation,
      measureType: this.measureType,
      layers: this.layers.map((layer) => ({
        layer_index: layer.layer_index,
        material: layer.material ?? null,
        thickness: this.normalizeNumber(layer.thickness),
        length:
          this.measureType === PartStructureMeasureType.Length ? this.normalizeNumber(layer.length) : null,
        area: this.measureType === PartStructureMeasureType.Area ? this.normalizeNumber(layer.area) : null
      }))
    };

    this.emitIfChanged(structure, this.isStructureValid(structure));
  }

  trackByLayer(_: number, layer: PartLayer): PartLayer {
    return layer;
  }

  isMaterialMissing(layer: PartLayer): boolean {
    return !layer.material;
  }

  isThicknessInvalid(layer: PartLayer): boolean {
    return this.isInvalidLayerNumber(layer.thickness);
  }

  isMeasureInvalid(layer: PartLayer): boolean {
    if (this.measureType === PartStructureMeasureType.Length) {
      return this.isInvalidLayerNumber(layer.length);
    }

    if (this.measureType === PartStructureMeasureType.Area) {
      return this.isInvalidLayerNumber(layer.area);
    }

    return true;
  }

  private syncFromInputs(): void {
    const nextOrientation = getPartStructureOrientation(this.partType);
    const nextMeasureType = getPartStructureMeasureType(this.partType);

    if (!nextOrientation || !nextMeasureType) {
      this.orientation = null;
      this.measureType = null;
      this.layers = [];
      this.emitChangesDeferred();
      return;
    }

    this.orientation = nextOrientation;
    this.measureType = nextMeasureType;

    if (
      this.structure &&
      this.structure.orientation === nextOrientation &&
      this.structure.measureType === nextMeasureType &&
      this.structure.layers.length > 0
    ) {
      const normalizedLayers = this.structure.layers.map((layer, index) =>
        this.normalizeLayer(layer, index + 1, nextMeasureType)
      );
      const normalizedStructure: PartStructure = {
        orientation: nextOrientation,
        measureType: nextMeasureType,
        layers: normalizedLayers
      };
      const incomingStructureJson = JSON.stringify(normalizedStructure);
      const currentStructureJson = this.getCurrentStructureJson(nextOrientation, nextMeasureType);
      const shouldApplyIncomingStructure =
        this.layers.length === 0 ||
        (incomingStructureJson !== currentStructureJson &&
          incomingStructureJson !== this.lastEmittedStructureJson);

      if (shouldApplyIncomingStructure) {
        this.layers = normalizedLayers;
      }

      this.emitChangesDeferred();
      return;
    }

    this.layers = [this.createEmptyLayer(1)];
    this.emitChangesDeferred();
  }

  private emitChangesDeferred(): void {
    queueMicrotask(() => this.emitChanges());
  }

  private getCurrentStructureJson(
    orientation: PartStructureOrientation,
    measureType: PartStructureMeasureType
  ): string {
    const structure: PartStructure = {
      orientation,
      measureType,
      layers: this.layers.map((layer, index) => ({
        layer_index: index + 1,
        material: layer.material ?? null,
        thickness: this.normalizeNumber(layer.thickness),
        length: measureType === PartStructureMeasureType.Length ? this.normalizeNumber(layer.length) : null,
        area: measureType === PartStructureMeasureType.Area ? this.normalizeNumber(layer.area) : null
      }))
    };

    return JSON.stringify(structure);
  }

  private normalizeLayer(layer: PartLayer, index: number, measureType: PartStructureMeasureType): PartLayer {
    return {
      layer_index: index,
      material: layer.material ?? null,
      thickness: this.normalizeNumber(layer.thickness),
      length: measureType === PartStructureMeasureType.Length ? this.normalizeNumber(layer.length) : null,
      area: measureType === PartStructureMeasureType.Area ? this.normalizeNumber(layer.area) : null
    };
  }

  private createEmptyLayer(layerIndex: number): PartLayer {
    return {
      layer_index: layerIndex,
      material: null,
      thickness: null,
      length: null,
      area: null
    };
  }

  private reindexLayers(): void {
    this.layers.forEach((layer, index) => {
      layer.layer_index = index + 1;
    });
  }

  private isStructureValid(structure: PartStructure): boolean {
    if (structure.layers.length === 0) {
      return false;
    }

    return structure.layers.every((layer) => {
      const hasMaterial = !this.isMaterialMissing(layer);
      const hasThickness = !this.isInvalidLayerNumber(layer.thickness);

      if (structure.measureType === PartStructureMeasureType.Length) {
        return hasMaterial && hasThickness && !this.isInvalidLayerNumber(layer.length);
      }

      return hasMaterial && hasThickness && !this.isInvalidLayerNumber(layer.area);
    });
  }

  private isInvalidLayerNumber(value: number | null | undefined): boolean {
    if (value === null || value === undefined) {
      return true;
    }

    return !Number.isFinite(value) || value < this.minimumLayerValue;
  }

  private normalizeNumber(value: number | null | undefined): number | null {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return null;
    }

    return value;
  }

  private emitIfChanged(structure: PartStructure | null, isValid: boolean): void {
    const nextStructureJson = structure ? JSON.stringify(structure) : null;

    if (nextStructureJson !== this.lastEmittedStructureJson) {
      this.lastEmittedStructureJson = nextStructureJson;
      this.structureChange.emit(structure);
    }

    if (isValid !== this.lastEmittedValidity) {
      this.lastEmittedValidity = isValid;
      this.validityChange.emit(isValid);
    }
  }

}
