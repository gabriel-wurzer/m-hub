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
import { PartType } from '../../enums/part-type.enum';
import { MaterialType } from '../../enums/material-type.enum';
import { PartStructure, Layer } from '../../models/part-structure';
import { LayerMaterial, LAYER_MATERIAL_OPTIONS } from '../../models/layer-material';

type EditablePartLayer = {
  layer_index: number;
  material: LayerMaterial | null;
  thickness: number | null;
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
    ]),
    trigger('measureModeBlend', [
      transition(':enter', [
        style({
          opacity: 0,
          transform: 'translateY(-6px)'
        }),
        animate(
          '260ms cubic-bezier(0.2, 0, 0, 1)',
          style({
            opacity: 1,
            transform: 'translateY(0)'
          })
        )
      ]),
      transition('wall <=> slab', [
        animate(
          '140ms cubic-bezier(0.4, 0, 1, 1)',
          style({
            opacity: 0.68,
            transform: 'translateY(4px)'
          })
        ),
        animate(
          '220ms cubic-bezier(0.2, 0, 0, 1)',
          style({
            opacity: 1,
            transform: 'translateY(0)'
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

  @ViewChild('directionStartLabelEl')
  set directionStartLabelRef(value: ElementRef<HTMLElement> | undefined) {
    this.directionStartLabelElement = value?.nativeElement ?? null;
    this.updateWallVisibleTileSlots();
  }

  @ViewChild('directionEndLabelEl')
  set directionEndLabelRef(value: ElementRef<HTMLElement> | undefined) {
    this.directionEndLabelElement = value?.nativeElement ?? null;
    this.updateWallVisibleTileSlots();
  }

  readonly layerMaterials: LayerMaterial[] = LAYER_MATERIAL_OPTIONS;
  readonly minimumLayerValue = 1;
  readonly mobileBreakpointPx = 860;
  readonly layerChipCompactBreakpointPx = 540;
  readonly slabMobileVisibleLayerLimit = 6;
  readonly slabMobileLeadingLayerCount = 5;
  readonly wallTileWidth = 50;
  readonly wallMinimumStackWidth = 100;
  readonly wallOverflowLabel = '..';
  private readonly materialTypeValues = new Set<MaterialType>(Object.values(MaterialType));

  structureType: StructureType | null = null;
  layers: EditablePartLayer[] = [];
  structureMeasure: number | null = null;
  animationsDisabled = true;
  isCompactViewport = false;
  isLayerChipCompact = false;
  wallVisibleTileSlots: number | null = null;
  private lastEmittedStructureJson: string | null = null;
  private lastEmittedValidity: boolean | null = null;
  private mobileViewportQuery: MediaQueryList | null = null;
  private layerChipCompactQuery: MediaQueryList | null = null;
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
    this.layerChipCompactQuery?.removeEventListener('change', this.handleLayerChipCompactQueryChange);
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

    this.enforceLayerThicknessRules();
    this.reindexLayers();
    const structure = this.buildStructure(this.layers, this.structureMeasure);
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

  isMaterialMissing(material: LayerMaterial | null): boolean {
    return !material;
  }

  isMeasureInvalid(): boolean {
    return this.isInvalidLayerNumber(this.structureMeasure);
  }

  onLayerMaterialChange(layer: EditablePartLayer): void {
    this.enforceLayerThicknessRule(layer);
    this.emitChanges();
  }

  isThicknessDisabled(layer: EditablePartLayer): boolean {
    return this.requiresFixedZeroThickness(layer.material);
  }

  isLayerThicknessInvalid(layer: { material: LayerMaterial | null; thickness: number | null }): boolean {
    if (this.requiresFixedZeroThickness(layer.material)) {
      return false;
    }

    return this.isInvalidLayerNumber(layer.thickness);
  }

  showPositiveThicknessRequirementError(): boolean {
    if (!this.structureType || this.layers.length === 0) {
      return false;
    }

    const hasIncompleteLayerData = this.layers.some((layer) => {
      const hasMaterial = !this.isMaterialMissing(layer.material);
      const hasValidThickness = !this.isLayerThicknessInvalid(layer);
      return !hasMaterial || !hasValidThickness;
    });

    return !hasIncompleteLayerData && !this.hasPositiveThicknessLayer(this.layers);
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
      this.structureMeasure = null;
      this.emitChangesDeferred();
      return;
    }

    if (this.structure && this.structure.type === nextStructureType && this.structure.layers.length > 0) {
      const normalizedLayers = this.structure.layers.map((layer, index) => this.normalizeIncomingLayer(layer, index + 1));
      normalizedLayers.forEach((layer) => this.enforceLayerThicknessRule(layer));
      const normalizedMeasure = this.normalizeIncomingStructureMeasure(this.structure);

      const incomingStructureJson = JSON.stringify(this.buildStructure(normalizedLayers, normalizedMeasure));
      const currentStructureJson = this.getCurrentStructureJson();
      const shouldApplyIncomingStructure =
        this.layers.length === 0 ||
        (incomingStructureJson !== currentStructureJson &&
          incomingStructureJson !== this.lastEmittedStructureJson);

      if (shouldApplyIncomingStructure) {
        this.layers = normalizedLayers;
        this.structureMeasure = normalizedMeasure;
      }

      this.emitChangesDeferred();
      return;
    }

    this.layers = [this.createEmptyLayer(1)];
    this.structureMeasure = null;
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

    this.layerChipCompactQuery = window.matchMedia(`(max-width: ${this.layerChipCompactBreakpointPx}px)`);
    this.isLayerChipCompact = this.layerChipCompactQuery.matches;
    this.layerChipCompactQuery.addEventListener('change', this.handleLayerChipCompactQueryChange);
  }

  private readonly handleViewportQueryChange = (event: MediaQueryListEvent): void => {
    this.isCompactViewport = event.matches;
  };

  private readonly handleLayerChipCompactQueryChange = (event: MediaQueryListEvent): void => {
    this.isLayerChipCompact = event.matches;
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
    const structure = this.buildStructure(this.layers, this.structureMeasure);
    return structure ? JSON.stringify(structure) : null;
  }

  private buildStructure(layers: EditablePartLayer[], measure: number | null): PartStructure | null {
    if (this.structureType === 'wall') {
      return {
        type: 'wall',
        length: this.normalizeNumber(measure),
        layers: layers.map((layer, index): Layer => ({
          layer_index: index + 1,
          material: layer.material ?? null,
          thickness: this.normalizeNumber(layer.thickness)
        }))
      };
    }

    if (this.structureType === 'slab') {
      return {
        type: 'slab',
        area: this.normalizeNumber(measure),
        layers: layers.map((layer, index): Layer => ({
          layer_index: index + 1,
          material: layer.material ?? null,
          thickness: this.normalizeNumber(layer.thickness)
        }))
      };
    }

    return null;
  }

  private normalizeIncomingLayer(layer: Layer, index: number): EditablePartLayer {
    return {
      layer_index: index,
      material: layer.material ?? null,
      thickness: this.normalizeNumber(layer.thickness)
    };
  }

  private normalizeIncomingStructureMeasure(structure: PartStructure): number | null {
    if (structure.type === 'wall') {
      const structureLength = this.normalizeNumber((structure as { length?: number | null }).length);
      if (structureLength !== null) {
        return structureLength;
      }

      const firstLayer = structure.layers[0] as ({ length?: number | null } | undefined);
      return this.normalizeNumber(firstLayer?.length);
    }

    const structureArea = this.normalizeNumber((structure as { area?: number | null }).area);
    if (structureArea !== null) {
      return structureArea;
    }

    const firstLayer = structure.layers[0] as ({ area?: number | null } | undefined);
    return this.normalizeNumber(firstLayer?.area);
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
      thickness: null
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

    const structureMeasure = structure.type === 'wall' ? structure.length : structure.area;
    if (this.isInvalidLayerNumber(structureMeasure)) {
      return false;
    }

    return structure.layers.every((layer) => {
      const hasMaterial = !this.isMaterialMissing(layer.material);
      const hasThickness = !this.isLayerThicknessInvalid(layer);
      return hasMaterial && hasThickness;
    }) && this.hasPositiveThicknessLayer(structure.layers);
  }

  private hasPositiveThicknessLayer(
    layers: Array<{ material: Layer['material']; thickness: number | null }>
  ): boolean {
    return layers.some((layer) => !this.requiresFixedZeroThickness(layer.material) && !this.isInvalidLayerNumber(layer.thickness));
  }

  private enforceLayerThicknessRules(): void {
    this.layers.forEach((layer) => this.enforceLayerThicknessRule(layer));
  }

  private enforceLayerThicknessRule(layer: EditablePartLayer): void {
    if (this.requiresFixedZeroThickness(layer.material)) {
      layer.thickness = 0;
    }
  }

  private requiresFixedZeroThickness(material: LayerMaterial | null): boolean {
    return material !== null && !this.materialTypeValues.has(material as MaterialType);
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
