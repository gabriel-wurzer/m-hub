import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { Bauteil, Objekt } from '../../../models/building-component';
import { Document } from '../../../models/document';
import { MaterialType } from '../../../enums/material-type.enum';
import { Floor } from '../../../models/floor';
import { FloorType } from '../../../enums/floor-type.enum';
import { PartType } from '../../../enums/part-type.enum';
import { Layer, PartStructure } from '../../../models/part-structure';

export type EntityInfoDialogData = {
  entity: Bauteil | Objekt | Document;
  structure?: Floor[];
};

type InfoRow = {
  label: string;
  value: string;
  mono?: boolean;
};

type RowDef<T> = {
  label: string;
  getValue: (entity: T) => unknown;
  mono?: boolean;
};

type LocationSegment = {
  main: string;
  note?: string;
};

@Component({
  selector: 'app-entity-info-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './entity-info-dialog.component.html',
  styleUrl: './entity-info-dialog.component.scss'
})
export class EntityInfoDialogComponent {
  private readonly documentImageTypes = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'svg', 'webp']);
  private readonly documentDownloadOnlyTypes = new Set(['csv', 'xlsx', 'xlsm', 'doc', 'docx', 'txt', 'html', 'rtf', 'odt', 'html', 'md']);
  private readonly documentIconByType: Record<string, string> = {
    pdf: 'picture_as_pdf',
    csv: 'table_chart',
    xlsx: 'table_chart',
    xlsm: 'table_chart',
    doc: 'description',
    docx: 'description',
    txt: 'description',
    rtf: 'description',
    odt: 'description',
    html: 'code',
    md: 'article',
    e57: 'view_in_ar',
    obj: 'view_in_ar',
    stl: 'view_in_ar',
    ply: 'view_in_ar',
    glb: 'view_in_ar',
    gltf: 'view_in_ar',
    fbx: 'view_in_ar',
    ifc: 'view_in_ar'
  };
  private readonly trustedDocumentUrlCache = new Map<string, SafeResourceUrl>();
  private readonly floorDescriptionByLocationLabel = new Map<string, string>();
  private readonly materialTypeValues = new Set<MaterialType>(Object.values(MaterialType));

  entity: Record<string, unknown>;
  readonly partStructure: PartStructure | null;
  objectImageLoaded = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: EntityInfoDialogData,
    private sanitizer: DomSanitizer
  ) {
    this.entity = data.entity as any as Record<string, unknown>;
    this.rebuildFloorDescriptionByLocationLabel(this.data.structure ?? []);
    this.partStructure = this.resolvePartStructure();
  }

  get title(): string {
    const typeLabel = this.resolveTypeLabel();
    const name = this.resolveEntityName();
    return `${typeLabel}: ${name}`;
  }

  getValue(keys: string[]): string {
    return this.formatValue(this.readField(this.entity, keys));
  }

  getVisibilityValue(keys: string[]): string {
    const value = this.readField(this.entity, keys);

    if (typeof value === 'boolean') return value ? 'öffentlich' : 'privat';
    if (typeof value === 'string') return value === 'true' ? 'öffentlich' : value === 'false' ? 'privat' : String(value);
    if (typeof value === 'number') return value === 1 ? 'öffentlich' : value === 0 ? 'privat' : String(value);

    return this.formatValue(value);
  }

  getHazardousValue(keys: string[]): string {
    const value = this.readField(this.entity, keys);

    if (typeof value === 'boolean') return value ? 'enthalten' : 'nicht enthalten';
    if (typeof value === 'string') return value === 'true' ? 'enthalten' : value === 'false' ? 'nicht enthalten' : String(value);
    if (typeof value === 'number') return value === 1 ? 'enthalten' : value === 0 ? 'nicht enthalten' : String(value);

    return this.formatValue(value);
  }

  getLocationSegments(keys: string[]): LocationSegment[] {
    const rawLocation = this.readField(this.entity, keys);
    if (typeof rawLocation !== 'string') return [];

    const normalized = rawLocation.trim();
    if (normalized.length === 0) return [];

    return normalized
      .split(',')
      .map((token) => token.trim())
      .filter((token) => token.length > 0)
      .map((token) => this.toLocationSegmentVm(token));
  }

  isDocument(): boolean {
    if (this.hasAnyField(this.entity, ['file_type', 'fileType', 'file_url', 'fileUrl', 'component_id', 'componentId'])) {
      return true;
    }

    const hasDocMarkers = this.hasAnyField(this.entity, ['building_id', 'buildingId', 'user_building_id', 'userBuildingId', 'owner_id', 'ownerId']);
    const hasComponentMarkers = this.hasAnyField(this.entity, ['category', 'part_type', 'partType', 'part_structure', 'partStructure', 'object_type', 'objectType', 'count']);

    return hasDocMarkers && !hasComponentMarkers;
  }

  isBauteil(): boolean {
    return this.hasAnyField(this.entity, ['part_type', 'partType', 'part_structure', 'partStructure']);
  }

  isObjekt(): boolean {
    return this.hasAnyField(this.entity, ['object_type', 'objectType', 'count']);
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

  getPartStructureDirectionStartLabel(structure: PartStructure): string {
    return this.isWallPartStructure(structure) ? 'Innen' : 'Oben';
  }

  getPartStructureDirectionEndLabel(structure: PartStructure): string {
    return this.isWallPartStructure(structure) ? 'Außen' : 'Unten';
  }

  getPartStructureOrientationHint(structure: PartStructure): string {
    return this.isWallPartStructure(structure)
      ? 'Schichten laufen von innen nach außen.'
      : 'Schichten laufen von oben nach unten.';
  }

  getPartStructureTypeLabel(structure: PartStructure): string {
    const partType = this.readField(this.entity, ['part_type', 'partType']);

    switch (partType) {
      case PartType.BA:
        return 'Bodenaufbau';
      case PartType.DA:
        return 'Dachaufbau';
      default:
        return 'Wandaufbau';
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

  getObjectImageUrl(): string | null {
    if (!this.isObjekt()) return null;

    const explicitUrl = this.readField(this.entity, ['image_url', 'imageUrl']);
    if (typeof explicitUrl === 'string' && explicitUrl.trim().length > 0) {
      return explicitUrl.trim();
    }

    const imagePath = this.readField(this.entity, ['image_path', 'imagePath']);
    if (typeof imagePath === 'string' && imagePath.trim().length > 0) {
      const normalizedPath = imagePath.trim();
      if (/^https?:\/\//i.test(normalizedPath)) {
        return normalizedPath;
      }
    }

    return null;
  }

  getMeasurementValue(keys: string[]): string {
    const rawValue = this.readField(this.entity, keys);
    const parsedValue = typeof rawValue === 'string' ? Number(rawValue) : rawValue;

    if (typeof parsedValue !== 'number' || !Number.isFinite(parsedValue) || parsedValue <= 0) {
      return '—';
    }

    return `${this.formatNumber(parsedValue)} cm`;
  }

  getDocumentUrl(): string | null {
    if (!this.isDocument()) return null;

    const fileUrl = this.readField(this.entity, ['file_url', 'fileUrl']);
    if (typeof fileUrl === 'string' && fileUrl.trim().length > 0) {
      const normalized = fileUrl.trim();
      if (['null', 'undefined', '—'].includes(normalized.toLowerCase())) {
        return null;
      }
      return normalized;
    }

    return null;
  }

  isDocumentImagePreviewable(documentUrl: string): boolean {
    const type = this.resolveDocumentType(documentUrl);
    return !!type && this.documentImageTypes.has(type);
  }

  isDocumentPdfPreviewable(documentUrl: string): boolean {
    return this.resolveDocumentType(documentUrl) === 'pdf';
  }

  getTrustedDocumentPreviewUrl(documentUrl: string): SafeResourceUrl {
    const cached = this.trustedDocumentUrlCache.get(documentUrl);
    if (cached) return cached;

    const trusted = this.sanitizer.bypassSecurityTrustResourceUrl(documentUrl);
    this.trustedDocumentUrlCache.set(documentUrl, trusted);
    return trusted;
  }

  getDocumentPreviewIcon(documentUrl: string): string {
    const type = this.resolveDocumentType(documentUrl);
    if (!type) return 'insert_drive_file';

    return this.documentIconByType[type] || 'insert_drive_file';
  }

  getDocumentPreviewLabel(documentUrl: string): string {
    const type = this.resolveDocumentType(documentUrl);
    return type ? type.toUpperCase() : 'DATEI';
  }

  isDocumentDownloadOnly(documentUrl: string): boolean {
    const type = this.resolveDocumentType(documentUrl);
    return !!type && this.documentDownloadOnlyTypes.has(type);
  }

  getDocumentActionHint(documentUrl: string): string {
    return this.isDocumentDownloadOnly(documentUrl) ? 'Herunterladen' : 'In neuem Tab öffnen';
  }

  private resolveDocumentType(documentUrl: string): string | null {
    const fileType = this.readField(this.entity, ['file_type', 'fileType']);
    if (typeof fileType === 'string' && fileType.trim().length > 0) {
      return fileType.trim().toLowerCase();
    }

    const extension = this.extractExtensionFromUrl(documentUrl);
    return extension ? extension.toLowerCase() : null;
  }

  private extractExtensionFromUrl(documentUrl: string): string | null {
    const fallbackFromString = (): string | null => {
      const noQuery = documentUrl.split('?')[0].split('#')[0];
      const parts = noQuery.split('.');
      if (parts.length < 2) return null;
      const extension = parts.pop();
      return extension && extension.length > 0 ? extension : null;
    };

    try {
      const parsedUrl = new URL(documentUrl);
      const pathname = parsedUrl.pathname || '';
      const parts = pathname.split('.');
      if (parts.length < 2) return fallbackFromString();
      const extension = parts.pop();
      return extension && extension.length > 0 ? extension : fallbackFromString();
    } catch {
      return fallbackFromString();
    }
  }

  private resolveTypeLabel(): string {
    if (this.isDocument()) return 'Dokument';
    if (this.isBauteil()) return 'Bauteil';
    if (this.isObjekt()) return 'Objekt';
    return 'Komponente';
  }

  private resolvePartStructure(): PartStructure | null {
    return this.coercePartStructure(this.readField(this.entity, ['part_structure', 'partStructure']));
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

  private toLocationSegmentVm(token: string): LocationSegment {
    const desc = this.floorDescriptionByLocationLabel.get(token);
    if (desc) {
      return { main: token, note: this.formatLocationNote(desc) };
    }

    const match = token.match(/^(.*?)(\s*\(.*\))$/);
    if (!match) {
      return { main: token };
    }

    const main = match[1].trimEnd();
    const note = match[2].trimStart();

    return { main, note };
  }

  private formatLocationNote(description: string): string | undefined {
    const trimmed = description.trim();
    if (trimmed.length === 0) return undefined;

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
      if (floor.type === FloorType.RG) {
        regularIndex += 1;
        const desc = typeof floor.description === 'string' ? floor.description.trim() : '';
        if (desc.length > 0) {
          this.floorDescriptionByLocationLabel.set(`${floor.type} ${regularIndex}`, desc);
        }
        continue;
      }

      if (floor.type === FloorType.KG) {
        basementIndex += 1;
        const desc = typeof floor.description === 'string' ? floor.description.trim() : '';
        if (desc.length > 0) {
          this.floorDescriptionByLocationLabel.set(`${floor.type} ${basementIndex}`, desc);
        }
        continue;
      }

      if (floor.type === FloorType.D) {
        const desc = typeof floor.description === 'string' ? floor.description.trim() : '';
        if (desc.length > 0) {
          this.floorDescriptionByLocationLabel.set(floor.type, desc);
        }
      }
    }
  }

  private resolveEntityName(): string {
    const name = this.readField(this.entity, ['name']);
    if (typeof name === 'string' && name.trim().length > 0) return name.trim();
    const id = this.readField(this.entity, ['id']);
    if (typeof id === 'string' && id.trim().length > 0) return id.trim();
    return '—';
  }

  private formatValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
    if (typeof value === 'number') return this.formatNumber(value);
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      if (!value.length) return '—';
      const normalized = value
        .map((item) => {
          if (typeof item === 'string' || typeof item === 'number') return String(item);
          if (item && typeof item === 'object') {
            const name = this.readField(item as Record<string, unknown>, ['name', 'id']);
            if (typeof name === 'string' && name.length > 0) return name;
          }
          return '';
        })
        .filter((item) => item.length > 0);
      return normalized.length ? normalized.join(', ') : '—';
    }
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

  private readField(entity: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
      if (key in entity) return entity[key];
    }
    return undefined;
  }

  private hasAnyField(entity: Record<string, unknown>, keys: string[]): boolean {
    return keys.some((key) => key in entity);
  }
}
