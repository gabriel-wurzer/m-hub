import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';

import { EChartsOption } from 'echarts';
import { NgxEchartsModule } from 'ngx-echarts';

import { Building } from '../../models/building';
import { Period, PeriodLabels } from '../../enums/period.enum';
import { Usage, UsageLabels } from '../../enums/usage.enum';
import { DocumentListComponent } from "../document-list/document-list.component";
import { MdabMaterialGroup } from '../../enums/mdab-material-group.enum';
import { isBuilding } from '../../utils/model-guard';
import { BuildingComponent } from '../../models/building-component';
import { BuildingComponentCategory } from '../../enums/component-category';
import { Layer, PartStructure } from '../../models/part-structure';
import { MaterialType } from '../../enums/material-type.enum';
import { PartType } from '../../enums/part-type.enum';
import { Floor } from '../../models/floor';
import { FloorType } from '../../enums/floor-type.enum';

type LocationSegment = {
  main: string;
  note?: string;
};

type ObjectImageVm = {
  key: string;
  url: string;
  label: string;
  sortOrder: number;
  fit?: 'cover' | 'contain';
};

@Component({
  selector: 'app-structure-details',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDividerModule, MatExpansionModule, MatProgressSpinnerModule, MatListModule, MatTooltipModule, DocumentListComponent, NgxEchartsModule],
  templateUrl: './structure-details.component.html',
  styleUrl: './structure-details.component.scss'
})
export class StructureDetailsComponent implements OnChanges {
  private readonly materialTypeValues = new Set<MaterialType>(Object.values(MaterialType));
  private readonly floorDescriptionByLocationLabel = new Map<string, string>();

  @Input() entity!: Building | BuildingComponent | null;
  @Input() structure: Floor[] | null = null;
  @Output() loadingChange = new EventEmitter<boolean>();

  errorMessage = '';

  isBuilding = false;
  building!: Building | null;
  buildingComponent!: BuildingComponent | null;

  periodOptions = Object.values(Period).filter(value => typeof value === 'number') as number[];
  periodLabels = PeriodLabels;

  usageOptions = Object.values(Usage).filter(value => typeof value === 'number') as number[];
  usageLabels = UsageLabels;

  usagePieChartOptions: EChartsOption = {};
  materialsPieChartOptions: EChartsOption = {};

  isLoading = false;
  objectImages: ObjectImageVm[] = [];
  activeObjectImageIndex = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['structure']) {
      this.rebuildFloorDescriptionByLocationLabel(this.structure ?? []);
    }

    if (changes['entity']) {
      this.setLoading(true)
      this.setupEntity();
    }
  }

  private setupEntity() {

    if (!this.entity) return;

    if(isBuilding(this.entity)) {
      this.isBuilding = true;
      this.building = this.entity;
      this.buildingComponent = null;
      this.objectImages = [];
      this.activeObjectImageIndex = 0;
      // console.log("Current building: ", this.building);

      this.#updateUsagePieChart();
      this.#updateMaterialsPieChart();


    } else {
      this.isBuilding = false;
      this.building = null;
      this.buildingComponent = this.entity;
      this.objectImages = this.resolveObjectImages();
      this.activeObjectImageIndex = 0;
      // console.log("Current building component: ", this.buildingComponent);

      // TODO: add Chart options call here
    }

    this.setLoading(false)
  }

  get periodLabel(): string {
    if (this.building && this.building.bp) {
      const bpValues = this.building.bp.split(',').map(val => val.trim());
      const labels = bpValues.map(bpStr => {
        const bpValue = Number(bpStr);
        return (!isNaN(bpValue) && this.periodLabels[bpValue]) ? this.periodLabels[bpValue] : 'Bauperiode unbekannt';
      });
      return labels.join(', ');
    }
    return 'Bauperiode unbekannt';
  }
  
  get usageLabel(): string {
    if (this.building && this.building.dom_nutzung != null) {
      return this.usageLabels[this.building.dom_nutzung] || 'Nutzung unbekannt';
    }
    return 'Nutzung unbekannt';
  }

  #updateUsagePieChart() {
    if (!this.building) return;

    const usageData = [
      { value: this.building.m2bgf_use1, name: UsageLabels[Usage.WOHNEN] },
      { value: this.building.m2bgf_use2, name: UsageLabels[Usage.GEMISCHT] },
      { value: this.building.m2bgf_use3, name: UsageLabels[Usage.INDUSTRIE] },
      { value: this.building.m2bgf_use4, name: UsageLabels[Usage.SONSTIGES] }
    ].filter(entry => entry.value > 0);

    this.usagePieChartOptions = {
      title: {
        left: 'center',
        text: 'Bruttogrundfläche',
        subtext: 'nach Nutzungen',
        subtextStyle: {
          fontSize: 14
        }
      },
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (params: any) => {
          return `${params.marker} ${params.name}: <b>${params.value} m&sup2;</b>`;
        },
        textStyle: {
          fontSize: 15
        },
      },
      legend: {
        orient: 'vertical',
        top: 'bottom',
        left: 'right',
        selectedMode: false
      },
      series: [
        {
          name: 'Nutzungen',
          type: 'pie',
          radius: '60%',
          center: ['50%', '45%'],
          data: usageData,
          label: {
            show: true,
            position: 'outside',
            alignTo: 'edge',
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    };
  }

  #updateMaterialsPieChart() {
    if (!this.building) return;

    const materialsData = [
      { value: this.building.bmg1, name: MdabMaterialGroup.mg_1 },
      { value: this.building.bmg2, name: MdabMaterialGroup.mg_2 },
      { value: this.building.bmg3, name: MdabMaterialGroup.mg_3 },
      { value: this.building.bmg4, name: MdabMaterialGroup.mg_4 },
      { value: this.building.bmg5, name: MdabMaterialGroup.mg_5 },
      { value: this.building.bmg6, name: MdabMaterialGroup.mg_6 },
      { value: this.building.bmg7, name: MdabMaterialGroup.mg_7 },
      { value: this.building.bmg8, name: MdabMaterialGroup.mg_8 },
      { value: this.building.bmg9, name: MdabMaterialGroup.mg_9 }
    ].filter(entry => entry.value > 0);
  
    this.materialsPieChartOptions = {
      title: {
        left: 'center',
        text: 'Baumaterialgruppen',
      },
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (params: any) => {
          const roundedValue = Number(params.value).toFixed(2);
          return `${params.marker} ${params.name}: <b>${roundedValue} t</b>`;
        },
        textStyle: {
          fontSize: 15
        },
      },
      legend: {
        orient: 'vertical',
        top: 'bottom',
        left: 'right',
        selectedMode: false,
        type: 'scroll',
        height: 110,
        pageButtonPosition: 'start',
        pageIconSize: 11,
      },
      series: [
        {
          name: 'Baumaterialgruppen',
          type: 'pie',
          radius: '60%',
          center: ['50%', '45%'],
          data: materialsData,
          label: {
            show: false
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    };
  }

  get isBauteil(): boolean {
    return this.buildingComponent?.category === BuildingComponentCategory.Bauteil;
  }

  get isObjekt(): boolean {
    return this.buildingComponent?.category === BuildingComponentCategory.Objekt;
  }

  get partStructure(): PartStructure | null {
    if (!this.isBauteil || !this.buildingComponent) {
      return null;
    }

    return this.coercePartStructure(this.rawPartStructure);
  }

  get rawPartStructure(): unknown {
    return (this.buildingComponent as Partial<BuildingComponent> & { part_structure?: unknown })?.part_structure;
  }

  get partStructureLayerCount(): string {
    return this.partStructure ? String(this.partStructure.layers.length) : '—';
  }

  get aggregatedThicknessLabel(): string {
    if (!this.partStructure) {
      return '—';
    }

    const aggregatedThickness = this.partStructure.layers.reduce(
      (sum, layer) => sum + this.getEffectiveLayerThickness(layer),
      0
    );

    return `${this.formatNumber(aggregatedThickness)} mm`;
  }

  getHazardousValue(value: unknown): string {
    if (typeof value === 'boolean') return value ? 'enthalten' : 'nicht enthalten';
    if (typeof value === 'string') return value === 'true' ? 'enthalten' : value === 'false' ? 'nicht enthalten' : value;
    if (typeof value === 'number') return value === 1 ? 'enthalten' : value === 0 ? 'nicht enthalten' : String(value);

    return this.formatValue(value);
  }

  getLocationSegments(location: string | null | undefined): LocationSegment[] {
    if (typeof location !== 'string') return [];

    const normalized = location.trim();
    if (normalized.length === 0) return [];

    return normalized
      .split(',')
      .map((token) => token.trim())
      .filter((token) => token.length > 0)
      .map((token) => this.toLocationSegmentVm(token));
  }

  getPartTypeValue(): string {
    const partType = (this.buildingComponent as Partial<BuildingComponent> & { part_type?: PartType })?.part_type;
    return this.formatValue(partType);
  }

  getBuildingComponentLocation(): string | null {
    const location = (this.buildingComponent as Partial<BuildingComponent> & { location?: string })?.location;
    return typeof location === 'string' ? location : null;
  }

  getBuildingComponentDescriptionValue(): string {
    const description = (this.buildingComponent as Partial<BuildingComponent> & { description?: unknown })?.description;
    if (typeof description === 'string' && description.trim().length === 0) {
      return '—';
    }

    return this.formatValue(description);
  }

  getObjectCountValue(): string {
    const count = (this.buildingComponent as Partial<BuildingComponent> & { count?: unknown })?.count;
    return this.formatValue(count);
  }

  getObjectTypeValue(): string {
    const objectType = (this.buildingComponent as Partial<BuildingComponent> & { object_type?: unknown })?.object_type;
    return this.formatValue(objectType);
  }

  getObjectMeasurementValue(fieldName: 'length' | 'width' | 'height'): string {
    const rawValue = (this.buildingComponent as Partial<BuildingComponent> & Record<string, unknown>)?.[fieldName];
    const parsedValue = typeof rawValue === 'string' ? Number(rawValue) : rawValue;

    if (typeof parsedValue !== 'number' || !Number.isFinite(parsedValue) || parsedValue <= 0) {
      return '—';
    }

    return `${this.formatNumber(parsedValue)} cm`;
  }

  getObjectImageUrl(): string | null {
    return this.currentObjectImage?.url ?? null;
  }

  get currentObjectImage(): ObjectImageVm | null {
    return this.objectImages[this.activeObjectImageIndex] ?? this.objectImages[0] ?? null;
  }

  hasMultipleObjectImages(): boolean {
    return this.objectImages.length > 1;
  }

  showPreviousObjectImage(): void {
    this.selectObjectImage(this.activeObjectImageIndex - 1);
  }

  showNextObjectImage(): void {
    this.selectObjectImage(this.activeObjectImageIndex + 1);
  }

  selectObjectImage(index: number): void {
    if (this.objectImages.length === 0) return;

    this.activeObjectImageIndex = (index + this.objectImages.length) % this.objectImages.length;
  }

  onObjectImageLoad(image: ObjectImageVm, event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (!target || target.naturalWidth <= 0 || target.naturalHeight <= 0) return;

    image.fit = target.naturalHeight > target.naturalWidth * 1.08 ? 'contain' : 'cover';
  }

  trackByObjectImage(_: number, image: ObjectImageVm): string {
    return image.key;
  }

  private resolveObjectImages(): ObjectImageVm[] {
    const images = (this.buildingComponent as Partial<BuildingComponent> & { images?: unknown })?.images;
    if (!Array.isArray(images)) return [];

    return images
      .map((image, index) => this.toObjectImageVm(image, index))
      .filter((image): image is ObjectImageVm => image !== null)
      .sort((left, right) => left.sortOrder - right.sortOrder);
  }

  private toObjectImageVm(image: unknown, index: number): ObjectImageVm | null {
    if (!image || typeof image !== 'object') return null;

    const imageRecord = image as {
      id?: unknown;
      image_url?: unknown;
      imageUrl?: unknown;
      image_path?: unknown;
      imagePath?: unknown;
      image_original_name?: unknown;
      imageOriginalName?: unknown;
      sort_order?: unknown;
      sortOrder?: unknown;
    };
    const url = this.resolveObjectImageUrl(imageRecord);
    if (!url) return null;

    const sortOrder = Number(imageRecord.sort_order ?? imageRecord.sortOrder);
    const label = imageRecord.image_original_name ?? imageRecord.imageOriginalName;

    return {
      key: typeof imageRecord.id === 'string' && imageRecord.id.trim().length > 0
        ? imageRecord.id.trim()
        : `${url}:${index}`,
      url,
      label: typeof label === 'string' && label.trim().length > 0 ? label.trim() : `Objektbild ${index + 1}`,
      sortOrder: Number.isInteger(sortOrder) ? sortOrder : index
    };
  }

  private resolveObjectImageUrl(imageRecord: { image_url?: unknown; imageUrl?: unknown; image_path?: unknown; imagePath?: unknown }): string | null {
    const explicitUrl = imageRecord.image_url ?? imageRecord.imageUrl;
    if (typeof explicitUrl === 'string' && explicitUrl.trim().length > 0) {
      return explicitUrl.trim();
    }

    const imagePath = imageRecord.image_path ?? imageRecord.imagePath;
    if (typeof imagePath === 'string' && /^https?:\/\//i.test(imagePath.trim())) {
      return imagePath.trim();
    }

    return null;
  }

  isWallPartStructure(structure: PartStructure): boolean {
    return structure.type === 'wall';
  }

  getPartStructureMeasureLabel(structure: PartStructure): string {
    return this.isWallPartStructure(structure) ? 'Laufmeter' : 'Fläche';
  }

  getPartStructureMeasureValue(structure: PartStructure): string {
    const value = structure.type === 'wall' ? structure.length : structure.area;
    if (value === null || value === undefined) {
      return '—';
    }

    return `${this.formatNumber(value)} ${structure.type === 'wall' ? 'm' : 'm²'}`;
  }

  getPartStructureOrientationHint(structure: PartStructure): string {
    return this.isWallPartStructure(structure)
      ? 'Schichten laufen von innen nach außen.'
      : 'Schichten laufen von oben nach unten.';
  }

  getPartStructureTypeLabel(structure: PartStructure): string {
    const partType = (this.buildingComponent as Partial<BuildingComponent> & { part_type?: PartType })?.part_type;

    switch (partType) {
      case PartType.BA:
        return 'Bodenaufbau';
      case PartType.DA:
        return 'Dachaufbau';
      default:
        return structure.type === 'slab' ? 'Deckenaufbau' : 'Wandaufbau';
    }
  }

  getLayerMaterialLabel(layer: Layer): string {
    if (typeof layer.material === 'string' && layer.material.trim().length > 0) {
      return layer.material.trim();
    }

    return 'Material offen';
  }

  getLayerThicknessLabel(layer: Layer): string {
    if (layer.thickness === null || layer.thickness === undefined) {
      return '—';
    }

    return `${this.formatNumber(layer.thickness)} mm`;
  }

  getRenderedLayerThicknessLabel(layer: Layer): string {
    if (this.requiresFixedZeroThickness(layer.material)) {
      return '0 mm';
    }

    return this.getLayerThicknessLabel(layer);
  }

  isLayerThicknessMuted(layer: Layer): boolean {
    return this.requiresFixedZeroThickness(layer.material);
  }

  trackByPartStructureLayer(_: number, layer: Layer): number {
    return layer.layer_index;
  }

  private setLoading(value: boolean) {
    this.isLoading = value;
    this.loadingChange.emit(value);
  }

  private coercePartStructure(rawValue: unknown): PartStructure | null {
    let normalizedValue = rawValue;

    if (typeof normalizedValue === 'string') {
      const trimmed = normalizedValue.trim();
      if (trimmed.length === 0) {
        return null;
      }

      try {
        normalizedValue = JSON.parse(trimmed);
      } catch {
        return null;
      }
    }

    if (!normalizedValue || typeof normalizedValue !== 'object') {
      return null;
    }

    const structure = normalizedValue as Partial<PartStructure> & Record<string, unknown>;
    if (structure.type !== 'wall' && structure.type !== 'slab') {
      return null;
    }

    const rawLayers = Array.isArray(structure.layers) ? structure.layers : [];
    const layers = rawLayers
      .map((layer, index) => this.coerceStructureLayer(layer, index))
      .filter((layer): layer is Layer => layer !== null);

    if (structure.type === 'wall') {
      return {
        type: 'wall',
        length: this.normalizeNumber(structure.length),
        layers
      };
    }

    return {
      type: 'slab',
      area: this.normalizeNumber(structure.area),
      layers
    };
  }

  private coerceStructureLayer(rawLayer: unknown, index: number): Layer | null {
    if (!rawLayer || typeof rawLayer !== 'object') {
      return null;
    }

    const layer = rawLayer as Partial<Layer> & Record<string, unknown>;
    const layerIndex = typeof layer.layer_index === 'number' && Number.isFinite(layer.layer_index)
      ? layer.layer_index
      : index + 1;

    return {
      layer_index: layerIndex,
      material: typeof layer.material === 'string' ? layer.material : null,
      thickness: this.normalizeNumber(layer.thickness)
    };
  }

  private requiresFixedZeroThickness(material: Layer['material']): boolean {
    return material !== null && material !== undefined && !this.materialTypeValues.has(material as MaterialType);
  }

  private getEffectiveLayerThickness(layer: Layer): number {
    if (this.requiresFixedZeroThickness(layer.material)) {
      return 0;
    }

    return layer.thickness ?? 0;
  }

  private toLocationSegmentVm(token: string): LocationSegment {
    const description = this.floorDescriptionByLocationLabel.get(token);
    if (description) {
      return { main: token, note: this.formatLocationNote(description) };
    }

    const match = token.match(/^(.*?)(\s*\(.*\))$/);
    if (!match) {
      return { main: token };
    }

    return {
      main: match[1].trimEnd(),
      note: match[2].trimStart()
    };
  }

  private formatLocationNote(description: string): string | undefined {
    const trimmed = description.trim();
    if (trimmed.length === 0) {
      return undefined;
    }

    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      return trimmed;
    }

    return `(${trimmed})`;
  }

  private rebuildFloorDescriptionByLocationLabel(structure: Floor[]): void {
    this.floorDescriptionByLocationLabel.clear();

    let regularIndex = 0;
    let basementIndex = 0;

    for (const floor of structure ?? []) {
      const description = typeof floor.description === 'string' ? floor.description.trim() : '';
      if (description.length === 0) {
        continue;
      }

      if (floor.type === FloorType.RG) {
        regularIndex += 1;
        this.floorDescriptionByLocationLabel.set(`${floor.type} ${regularIndex}`, description);
        this.floorDescriptionByLocationLabel.set(`RG ${regularIndex}`, description);
        continue;
      }

      if (floor.type === FloorType.KG) {
        basementIndex += 1;
        this.floorDescriptionByLocationLabel.set(`${floor.type} ${basementIndex}`, description);
        this.floorDescriptionByLocationLabel.set(`KG ${basementIndex}`, description);
        continue;
      }

      if (floor.type === FloorType.D) {
        this.floorDescriptionByLocationLabel.set(floor.type, description);
        this.floorDescriptionByLocationLabel.set('D', description);
      }
    }
  }

  private formatValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
    if (typeof value === 'number') return this.formatNumber(value);
    if (typeof value === 'string') return value;

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('de-AT', { maximumFractionDigits: 2 }).format(value);
  }

  private normalizeNumber(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }

    return value;
  }
}
