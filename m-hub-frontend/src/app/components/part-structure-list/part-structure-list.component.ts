import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
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

type StructureVisualTile = {
  id: string;
  label: string;
  isOverflow: boolean;
  hiddenCount: number | null;
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
export class PartStructureListComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() partType: PartType | null = null;
  @Input() structure: PartStructure | null = null;
  @Output() structureChange = new EventEmitter<PartStructure | null>();
  @Output() validityChange = new EventEmitter<boolean>();

  @ViewChild('structureVisual')
  set structureVisualRef(value: ElementRef<HTMLElement> | undefined) {
    this.structureVisualElement = value?.nativeElement ?? null;
    this.refreshWallWidthObserver();
  }

  @ViewChild('directionStartLabel')
  set directionStartLabelRef(value: ElementRef<HTMLElement> | undefined) {
    this.directionStartLabelElement = value?.nativeElement ?? null;
    this.updateWallVisibleTileSlots();
  }

  @ViewChild('directionEndLabel')
  set directionEndLabelRef(value: ElementRef<HTMLElement> | undefined) {
    this.directionEndLabelElement = value?.nativeElement ?? null;
    this.updateWallVisibleTileSlots();
  }

  readonly materials: Material[] = Object.values(Material);
  readonly minimumLayerValue = 1;
  readonly mobileBreakpointPx = 860;
  readonly slabMobileVisibleLayerLimit = 6;
  readonly slabMobileLeadingLayerCount = 5;
  readonly wallTileWidth = 50;
  readonly wallMinimumStackWidth = 100;
  readonly wallOverflowLabel = '..';

  structureType: StructureType | null = null;
  layers: EditablePartLayer[] = [];
  animationsDisabled = true;
  isCompactViewport = false;
  wallVisibleTileSlots: number | null = null;
  private lastEmittedStructureJson: string | null = null;
  private lastEmittedValidity: boolean | null = null;
  private mobileViewportQuery: MediaQueryList | null = null;
  private wallWidthObserver: ResizeObserver | null = null;
  private structureVisualElement: HTMLElement | null = null;
  private directionStartLabelElement: HTMLElement | null = null;
  private directionEndLabelElement: HTMLElement | null = null;

  constructor(private readonly ngZone: NgZone) {}

  ngOnInit(): void {
    this.setupViewportQuery();
    this.syncFromInputs();
    setTimeout(() => (this.animationsDisabled = false));
  }

  ngAfterViewInit(): void {
    this.updateWallVisibleTileSlots();
  }

  ngOnDestroy(): void {
    this.mobileViewportQuery?.removeEventListener('change', this.handleViewportQueryChange);
    this.wallWidthObserver?.disconnect();
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
    return this.isWallStructure ? 'Außen' : 'Unten';
  }

  get orientationHint(): string {
    return this.isWallStructure
      ? 'Schichten laufen von links (innen) nach rechts (außen).'
      : 'Schichten laufen von oben (höchste Lage) nach unten.';
  }

  get structureVisualTiles(): StructureVisualTile[] {
    if (!this.isWallStructure) {
      return this.getSlabStructureVisualTiles();
    }

    if (!this.wallVisibleTileSlots || this.layers.length <= this.wallVisibleTileSlots) {
      return this.layers.map((layer) => this.createLayerVisualTile(layer));
    }

    if (this.wallVisibleTileSlots === 1) {
      return [this.createOverflowVisualTile(this.layers.length)];
    }

    if (this.wallVisibleTileSlots === 2) {
      return [
        this.createLayerVisualTile(this.layers[0]),
        this.createOverflowVisualTile(this.layers.length - 1)
      ];
    }

    const visibleLayerSlots = this.wallVisibleTileSlots - 1;
    const leadingLayerCount = Math.ceil(visibleLayerSlots / 2);
    const trailingLayerCount = Math.floor(visibleLayerSlots / 2);
    const hiddenLayerCount = this.layers.length - leadingLayerCount - trailingLayerCount;

    if (hiddenLayerCount <= 0) {
      return this.layers.map((layer) => this.createLayerVisualTile(layer));
    }

    return [
      ...this.layers.slice(0, leadingLayerCount).map((layer) => this.createLayerVisualTile(layer)),
      this.createOverflowVisualTile(hiddenLayerCount),
      ...this.layers.slice(this.layers.length - trailingLayerCount).map((layer) => this.createLayerVisualTile(layer))
    ];
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

  trackByStructureVisualTile(_: number, tile: StructureVisualTile): string {
    return tile.id;
  }

  isMaterialMissing(material: Material | null): boolean {
    return !material;
  }

  isMeasureInvalid(layer: EditablePartLayer): boolean {
    return this.isInvalidLayerNumber(this.isWallStructure ? layer.length : layer.area);
  }

  getStructureVisualTileTooltip(tile: StructureVisualTile): string {
    return tile.isOverflow && tile.hiddenCount
      ? `${tile.hiddenCount} weitere Schichten ausgeblendet`
      : '';
  }

  private syncFromInputs(): void {
    const nextStructureType = this.getStructureType(this.partType);
    this.structureType = nextStructureType;
    this.refreshWallWidthObserver();

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

  private setupViewportQuery(): void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    this.mobileViewportQuery = window.matchMedia(`(max-width: ${this.mobileBreakpointPx}px)`);
    this.isCompactViewport = this.mobileViewportQuery.matches;
    this.mobileViewportQuery.addEventListener('change', this.handleViewportQueryChange);
  }

  private readonly handleViewportQueryChange = (event: MediaQueryListEvent): void => {
    this.isCompactViewport = event.matches;
  };

  private createLayerVisualTile(layer: EditablePartLayer): StructureVisualTile {
    return {
      id: `layer-${layer.layer_index}`,
      label: String(layer.layer_index),
      isOverflow: false,
      hiddenCount: null
    };
  }

  private createOverflowVisualTile(hiddenCount: number): StructureVisualTile {
    return {
      id: `overflow-${hiddenCount}`,
      label: this.wallOverflowLabel,
      isOverflow: true,
      hiddenCount
    };
  }

  private getSlabStructureVisualTiles(): StructureVisualTile[] {
    if (!this.isCompactViewport || this.layers.length <= this.slabMobileVisibleLayerLimit) {
      return this.layers.map((layer) => this.createLayerVisualTile(layer));
    }

    const hiddenLayerCount = this.layers.length - this.slabMobileLeadingLayerCount - 1;

    return [
      ...this.layers.slice(0, this.slabMobileLeadingLayerCount).map((layer) => this.createLayerVisualTile(layer)),
      this.createOverflowVisualTile(hiddenLayerCount),
      this.createLayerVisualTile(this.layers[this.layers.length - 1])
    ];
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
      case PartType.IW:
      case PartType.AW:
      case PartType.BW:
      case PartType.KS:
      case PartType.A:
        return 'wall';
      case PartType.BA:
      case PartType.DA:
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

  private refreshWallWidthObserver(): void {
    this.wallWidthObserver?.disconnect();
    this.wallWidthObserver = null;

    if (!this.isWallStructure || !this.structureVisualElement || typeof ResizeObserver === 'undefined') {
      this.updateWallVisibleTileSlots();
      return;
    }

    const observedElement = this.structureVisualElement;

    this.ngZone.runOutsideAngular(() => {
      this.wallWidthObserver = new ResizeObserver(() => {
        const nextVisibleTileSlots = this.calculateWallVisibleTileSlots();

        if (nextVisibleTileSlots !== this.wallVisibleTileSlots) {
          this.ngZone.run(() => {
            this.wallVisibleTileSlots = nextVisibleTileSlots;
          });
        }
      });

      this.wallWidthObserver.observe(observedElement);
    });

    this.updateWallVisibleTileSlots();
  }

  private updateWallVisibleTileSlots(): void {
    const nextVisibleTileSlots = this.calculateWallVisibleTileSlots();

    if (nextVisibleTileSlots !== this.wallVisibleTileSlots) {
      this.wallVisibleTileSlots = nextVisibleTileSlots;
    }
  }

  private calculateWallVisibleTileSlots(): number | null {
    if (!this.isWallStructure || !this.structureVisualElement) {
      return null;
    }

    const containerWidth = this.structureVisualElement.clientWidth;

    if (containerWidth <= 0) {
      return null;
    }

    const startLabelWidth = this.directionStartLabelElement?.offsetWidth ?? 0;
    const endLabelWidth = this.directionEndLabelElement?.offsetWidth ?? 0;
    const visualStyles = window.getComputedStyle(this.structureVisualElement);
    const gapValue = visualStyles.columnGap || visualStyles.gap || '0px';
    const visualGap = this.parsePixelValue(gapValue);
    const reservedWidth = startLabelWidth + endLabelWidth + visualGap * 2;
    const availableStackWidth = Math.max(this.wallMinimumStackWidth, containerWidth - reservedWidth);

    return Math.max(1, Math.floor(availableStackWidth / this.wallTileWidth));
  }

  private parsePixelValue(value: string): number {
    const parsedValue = Number.parseFloat(value);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
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
