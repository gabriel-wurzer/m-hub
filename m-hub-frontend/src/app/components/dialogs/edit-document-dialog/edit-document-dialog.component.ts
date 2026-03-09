import { CommonModule } from '@angular/common';
import { Component, Inject, Optional } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';

import { FileType } from '../../../enums/file-type.enum';
import { Document } from '../../../models/document';

export type EditDocumentDialogData = {
  document?: Document;
};

export type EditDocumentDialogResult = {
  name: string;
  description: string | null;
  isPublic: boolean;
  file: File | null;
  fileName: string;
  fileType: FileType | null;
  fileMimeType: string | null;
  fileDataUrl: string | null;
  previewImageUrl: string | null;
  replaceExistingFile: boolean;
};

@Component({
  selector: 'app-edit-document-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTooltipModule,
    MatDividerModule
  ],
  templateUrl: './edit-document-dialog.component.html',
  styleUrl: './edit-document-dialog.component.scss'
})
export class EditDocumentDialogComponent {
  private readonly maxFileSizeInBytes = 1000 * 1024 * 1024; // 1 GB
  private readonly imageFileTypes = new Set<FileType>([
    FileType.JPG,
    FileType.PNG,
    FileType.GIF,
    FileType.BMP,
    FileType.TIFF,
    FileType.SVG,
    FileType.WEBP
  ]);
  private readonly allSupportedFileTypes = new Set<string>(Object.values(FileType));
  private readonly mimeToFileType: Record<string, FileType> = {
    'image/jpeg': FileType.JPG,
    'image/jpg': FileType.JPG,
    'image/png': FileType.PNG,
    'image/gif': FileType.GIF,
    'image/bmp': FileType.BMP,
    'image/tiff': FileType.TIFF,
    'image/svg+xml': FileType.SVG,
    'image/webp': FileType.WEBP,
    'application/pdf': FileType.PDF,
    'application/msword': FileType.DOC,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileType.DOCX,
    'text/plain': FileType.TXT,
    'application/rtf': FileType.RTF,
    'application/vnd.oasis.opendocument.text': FileType.ODT,
    'text/html': FileType.HTML,
    'text/markdown': FileType.MD,
    'text/csv': FileType.CSV,
    'application/csv': FileType.CSV,
    'application/vnd.ms-excel': FileType.XLSX,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FileType.XLSX,
    'application/vnd.ms-excel.sheet.macroenabled.12': FileType.XLSM,
    'application/octet-stream': FileType.E57,
    'application/vnd.las': FileType.LAS,
    'application/x-las': FileType.LAS,
    'application/x-laz': FileType.LAZ,
    'application/x-ply': FileType.PLY,
    'model/ply': FileType.PLY,
    'model/obj': FileType.OBJ,
    'model/stl': FileType.STL,
    'application/sla': FileType.STL,
    'application/vnd.ms-pki.stl': FileType.STL,
    'model/gltf-binary': FileType.GLB,
    'model/gltf+json': FileType.GLTF,
    'application/octet-stream+fbx': FileType.FBX,
    'application/x-step': FileType.IFC
  };

  name = '';
  description = '';
  isPublic = true;

  isDragActive = false;
  fileError = '';

  selectedFile: File | null = null;
  selectedFileName = '';
  selectedFileType: FileType | null = null;
  selectedFileMimeType: string | null = null;
  selectedFileDataUrl: string | null = null;
  selectedPreviewImageUrl: string | null = null;

  private existingFileName = '';
  private existingFileType: FileType | null = null;
  private existingFileUrl: string | null = null;
  private existingPreviewImageUrl: string | null = null;

  constructor(
    @Optional() public dialogRef: MatDialogRef<EditDocumentDialogComponent> | null,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: EditDocumentDialogData | null
  ) {
    this.prefillFromDocument(this.data?.document);
  }

  private prefillFromDocument(document: Document | undefined): void {
    if (!document) return;

    this.name = document.name ?? '';
    this.description = document.description ?? '';
    this.isPublic = this.coerceBoolean(document.is_public, true);

    this.existingFileType = this.resolveInitialFileType(document);
    this.existingFileUrl = this.normalizeOptionalInput(document.file_url ?? '');
    this.existingFileName = this.resolveInitialFileName(document, this.existingFileUrl, this.existingFileType);
    this.existingPreviewImageUrl =
      this.existingFileUrl && this.isImageType(this.existingFileType) ? this.existingFileUrl : null;
  }

  private resolveInitialFileType(document: Document): FileType | null {
    if (typeof document.file_type === 'string') {
      const normalizedFileType = document.file_type.trim().toLowerCase();
      if (this.allSupportedFileTypes.has(normalizedFileType)) {
        return normalizedFileType as FileType;
      }
    }

    if (typeof document.file_url === 'string' && document.file_url.trim().length > 0) {
      const extension = this.extractExtension(document.file_url);
      if (extension && this.allSupportedFileTypes.has(extension)) {
        return extension as FileType;
      }
    }

    return null;
  }

  private resolveInitialFileName(document: Document, fileUrl: string | null, fileType: FileType | null): string {
    if (fileUrl) {
      try {
        const parsed = new URL(fileUrl);
        const fileName = parsed.pathname.split('/').pop();
        if (fileName && fileName.length > 0) {
          return decodeURIComponent(fileName);
        }
      } catch {
        const fileName = fileUrl.split('?')[0].split('#')[0].split('/').pop();
        if (fileName && fileName.length > 0) {
          return decodeURIComponent(fileName);
        }
      }
    }

    const normalizedName = this.normalizeOptionalInput(document.name);
    if (!normalizedName) return '';

    if (!fileType) return normalizedName;
    const expectedSuffix = `.${fileType}`;
    if (normalizedName.toLowerCase().endsWith(expectedSuffix)) {
      return normalizedName;
    }
    return `${normalizedName}${expectedSuffix}`;
  }

  private coerceBoolean(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    if (typeof value === 'number') return value === 1;
    return fallback;
  }

  getNameError(): string | null {
    if (this.name.trim().length === 0) {
      return 'Dokumentname erforderlich';
    }
    return null;
  }

  getFileError(): string | null {
    if (this.fileError) return this.fileError;
    if (this.selectedFile && !this.selectedFileType) return 'Dateityp konnte nicht erkannt werden';
    if (this.selectedFile && !this.selectedFileDataUrl) return 'Datei wird noch verarbeitet';
    if (!this.selectedFile && !this.hasExistingFile()) return 'Datei erforderlich';
    return null;
  }

  isFormValid(): boolean {
    const hasName = this.name.trim().length > 0;
    const hasValidFile = this.selectedFile ? !!this.selectedFileType && !!this.selectedFileDataUrl : this.hasExistingFile();
    return hasName && hasValidFile;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.processFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragActive = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragActive = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragActive = false;
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    this.processFile(file);
  }

  removeSelectedFile(): void {
    this.fileError = '';
    this.selectedFile = null;
    this.selectedFileName = '';
    this.selectedFileType = null;
    this.selectedFileMimeType = null;
    this.selectedFileDataUrl = null;
    this.selectedPreviewImageUrl = null;
  }

  isImageType(fileType: FileType | null): boolean {
    if (!fileType) return false;
    return this.imageFileTypes.has(fileType);
  }

  getPreviewIcon(fileType: FileType | null): string {
    if (!fileType) return 'insert_drive_file';

    if (this.imageFileTypes.has(fileType)) return 'image';
    if (fileType === FileType.PDF) return 'picture_as_pdf';
    if ([FileType.CSV, FileType.XLSX, FileType.XLSM].includes(fileType)) return 'table_chart';
    if ([FileType.DOC, FileType.DOCX, FileType.TXT, FileType.RTF, FileType.ODT, FileType.MD].includes(fileType)) return 'description';
    if ([FileType.E57, FileType.OBJ, FileType.STL, FileType.PLY, FileType.GLB, FileType.GLTF, FileType.FBX, FileType.IFC, FileType.LAS, FileType.LAZ].includes(fileType)) return 'view_in_ar';
    return 'insert_drive_file';
  }

  getPreviewTypeLabel(fileType: FileType | null): string {
    return (fileType || 'unbekannt').toUpperCase();
  }

  getActiveFileName(): string {
    return this.selectedFileName || this.existingFileName;
  }

  getActiveFileType(): FileType | null {
    return this.selectedFileType ?? this.existingFileType;
  }

  getActivePreviewImageUrl(): string | null {
    return this.selectedPreviewImageUrl ?? this.existingPreviewImageUrl;
  }

  hasAnyFileToDisplay(): boolean {
    return !!this.getActiveFileName() || !!this.getActiveFileType() || !!this.getActivePreviewImageUrl();
  }

  confirmEditDocument(): void {
    if (!this.isFormValid()) return;

    const hasReplacementFile = !!this.selectedFile && !!this.selectedFileType && !!this.selectedFileDataUrl;
    const result: EditDocumentDialogResult = {
      name: this.name.trim(),
      description: this.normalizeOptionalInput(this.description),
      isPublic: this.isPublic,
      file: hasReplacementFile ? this.selectedFile : null,
      fileName: hasReplacementFile ? this.selectedFileName : this.existingFileName,
      fileType: hasReplacementFile ? this.selectedFileType : this.existingFileType,
      fileMimeType: hasReplacementFile ? this.selectedFileMimeType : null,
      fileDataUrl: hasReplacementFile ? this.selectedFileDataUrl : null,
      previewImageUrl: hasReplacementFile ? this.selectedPreviewImageUrl : this.existingPreviewImageUrl,
      replaceExistingFile: hasReplacementFile
    };

    this.dialogRef?.close(result);
  }

  close(): void {
    this.dialogRef?.close();
  }

  private processFile(file: File): void {
    this.fileError = '';
    this.selectedFile = null;
    this.selectedFileName = '';
    this.selectedFileType = null;
    this.selectedFileMimeType = null;
    this.selectedFileDataUrl = null;
    this.selectedPreviewImageUrl = null;

    if (file.size > this.maxFileSizeInBytes) {
      this.fileError = 'Datei ist zu gross. Maximal 1GB erlaubt.';
      return;
    }

    const resolvedType = this.resolveFileType(file);
    if (!resolvedType) {
      this.fileError = 'Dateityp wird nicht unterstuetzt.';
      return;
    }

    this.selectedFile = file;
    this.selectedFileName = file.name;
    this.selectedFileType = resolvedType;
    this.selectedFileMimeType = file.type || null;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : null;
      this.selectedFileDataUrl = dataUrl;
      this.selectedPreviewImageUrl = this.isImageType(resolvedType) ? dataUrl : null;
    };
    reader.onerror = () => {
      this.fileError = 'Datei konnte nicht gelesen werden.';
      this.selectedFile = null;
      this.selectedFileName = '';
      this.selectedFileType = null;
      this.selectedFileMimeType = null;
      this.selectedFileDataUrl = null;
      this.selectedPreviewImageUrl = null;
    };
    reader.readAsDataURL(file);
  }

  private resolveFileType(file: File): FileType | null {
    const extension = this.extractExtension(file.name);
    if (extension && this.allSupportedFileTypes.has(extension)) {
      return extension as FileType;
    }

    if (file.type) {
      const normalizedMime = file.type.trim().toLowerCase();
      const byMime = this.mimeToFileType[normalizedMime];
      if (byMime) return byMime;
    }

    return null;
  }

  private extractExtension(fileName: string): string | null {
    const normalized = fileName.trim();
    if (!normalized.length) return null;

    const withoutQuery = normalized.split('?')[0].split('#')[0];
    if (!withoutQuery.includes('.')) return null;

    const extension = withoutQuery.split('.').pop()?.toLowerCase() || '';
    return extension.length > 0 ? extension : null;
  }

  private hasExistingFile(): boolean {
    return !!this.existingFileUrl || this.existingFileName.trim().length > 0 || !!this.existingFileType;
  }

  private normalizeOptionalInput(input: string | null | undefined): string | null {
    if (typeof input !== 'string') return null;
    const trimmed = input.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

}
