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
import { PartStructure, SlabLayer, WallLayer } from '../../models/part-structure';

type EditablePartLayer = {
  layer_index: number;
  material: Material | null;
  thickness: number | null;
  length: number | null;
  area: number | null;
};

type StructureType = PartStructure['type'];

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

  structureType: StructureType | null = null;
  layers: EditablePartLayer[] = [];
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
    return this.structureType === 'wall';
  }

  get directionStartLabel(): string {
    return this.isWallStructure ? 'Innen' : 'Oben';
  }

  get directionEndLabel(): string {
    return this.isWallStructure ? 'Aussen' : 'Unten';
  }

  get orientationHint(): string {
    return this.isWallStructure
      ? 'Schichten laufen von links (innen) nach rechts (außen).'
      : 'Schichten laufen von oben (höchste Lage) nach unten.';
  }

  addLayer(): void {
    if (!this.structureType) {
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

    if (this.layers.length === 0 && this.structureType) {
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
    if (!this.structureType) {
      this.emitIfChanged(null, false);
      return;
    }

    this.reindexLayers();
    const structure = this.buildStructure(this.layers);
    if (!structure) {
      this.emitIfChanged(null, false);
      return;
    }

    this.emitIfChanged(structure, this.isStructureValid(structure));
  }

  trackByLayer(_: number, layer: EditablePartLayer): EditablePartLayer {
    return layer;
  }

  isMaterialMissing(material: Material | null): boolean {
    return !material;
  }

  isMeasureInvalid(layer: EditablePartLayer): boolean {
    return this.isInvalidLayerNumber(this.isWallStructure ? layer.length : layer.area);
  }

  private syncFromInputs(): void {
    const nextStructureType = this.getStructureType(this.partType);
    this.structureType = nextStructureType;

    if (!nextStructureType) {
      this.layers = [];
      this.emitChangesDeferred();
      return;
    }

    if (this.structure && this.structure.type === nextStructureType && this.structure.layers.length > 0) {
      const normalizedLayers = this.structure.layers.map((layer, index) => this.normalizeIncomingLayer(layer, index + 1));

      const incomingStructureJson = JSON.stringify(this.buildStructure(normalizedLayers));
      const currentStructureJson = this.getCurrentStructureJson();
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

  private getCurrentStructureJson(): string | null {
    const structure = this.buildStructure(this.layers);
    return structure ? JSON.stringify(structure) : null;
  }

  private buildStructure(layers: EditablePartLayer[]): PartStructure | null {
    if (this.structureType === 'wall') {
      return {
        type: 'wall',
        layers: layers.map((layer, index): WallLayer => ({
          layer_index: index + 1,
          material: layer.material ?? null,
          thickness: this.normalizeNumber(layer.thickness),
          length: this.normalizeNumber(layer.length)
        }))
      };
    }

    if (this.structureType === 'slab') {
      return {
        type: 'slab',
        layers: layers.map((layer, index): SlabLayer => ({
          layer_index: index + 1,
          material: layer.material ?? null,
          thickness: this.normalizeNumber(layer.thickness),
          area: this.normalizeNumber(layer.area)
        }))
      };
    }

    return null;
  }

  private normalizeIncomingLayer(layer: WallLayer | SlabLayer, index: number): EditablePartLayer {
    if ('length' in layer) {
      return {
        layer_index: index,
        material: layer.material ?? null,
        thickness: this.normalizeNumber(layer.thickness),
        length: this.normalizeNumber(layer.length),
        area: null
      };
    }

    return {
      layer_index: index,
      material: layer.material ?? null,
      thickness: this.normalizeNumber(layer.thickness),
      length: null,
      area: this.normalizeNumber(layer.area)
    };
  }

  private getStructureType(partType: PartType | null | undefined): StructureType | null {
    switch (partType) {
      case PartType.Innenwand:
      case PartType.Aussenwand:
      case PartType.Brandwand:
      case PartType.Kniestock:
      case PartType.Attika:
        return 'wall';
      case PartType.Boden:
      case PartType.Dachaufbau:
        return 'slab';
      default:
        return null;
    }
  }

  private createEmptyLayer(layerIndex: number): EditablePartLayer {
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

    if (structure.type === 'wall') {
      return structure.layers.every((layer) => {
        const hasMaterial = !this.isMaterialMissing(layer.material);
        const hasThickness = !this.isInvalidLayerNumber(layer.thickness);
        const hasLength = !this.isInvalidLayerNumber(layer.length);
        return hasMaterial && hasThickness && hasLength;
      });
    }

    return structure.layers.every((layer) => {
      const hasMaterial = !this.isMaterialMissing(layer.material);
      const hasThickness = !this.isInvalidLayerNumber(layer.thickness);
      const hasArea = !this.isInvalidLayerNumber(layer.area);
      return hasMaterial && hasThickness && hasArea;
    });
  }

  isInvalidLayerNumber(value: number | null | undefined): boolean {
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
