import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { Bauteil, Objekt } from '../../../models/building-component';
import { Document } from '../../../models/document';

export type EntityInfoDialogData = {
  entity: Bauteil | Objekt | Document;
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

@Component({
  selector: 'app-entity-info-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './entity-info-dialog.component.html',
  styleUrl: './entity-info-dialog.component.scss'
})
export class EntityInfoDialogComponent {
  private readonly documentImageTypes = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'svg', 'webp']);
  private readonly documentDownloadOnlyTypes = new Set(['csv', 'xlsx', 'xlsm']);
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

  entity: Record<string, unknown>;
  objectImageLoaded = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: EntityInfoDialogData,
    private sanitizer: DomSanitizer
  ) {
    this.entity = data.entity as any as Record<string, unknown>;
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

    if (value === true) return 'öffentlich';
    if (value === false) return 'private';

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'ja'].includes(normalized)) return 'öffentlich';
      if (['false', '0', 'no', 'nein'].includes(normalized)) return 'privat';
    }

    return this.formatValue(value);
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
    if (typeof value === 'number') return String(value);
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
