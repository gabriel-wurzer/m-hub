import { CommonModule } from '@angular/common';
import { Component, Optional } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FileType } from '../../../enums/file-type.enum';

export type AddDocumentDialogResult = {
  name: string;
  description: string | null;
  isPublic: boolean;
  file: File;
  fileName: string;
  fileType: FileType;
  fileMimeType: string | null;
  fileDataUrl: string;
  previewImageUrl: string | null;
};

@Component({
  selector: 'app-add-document-dialog',
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
  templateUrl: './add-document-dialog.component.html',
  styleUrl: './add-document-dialog.component.scss'
})
export class AddDocumentDialogComponent {
  private readonly maxFileSizeInBytes = 25 * 1024 * 1024; // 25 MB
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
    'model/obj': FileType.OBJ,
    'model/stl': FileType.STL,
    'application/sla': FileType.STL,
    'application/vnd.ms-pki.stl': FileType.STL,
    'model/ply': FileType.PLY,
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

  constructor(@Optional() public dialogRef: MatDialogRef<AddDocumentDialogComponent> | null) {}

  getNameError(): string | null {
    if (this.name.trim().length === 0) {
      return 'Dokumentname erforderlich';
    }
    return null;
  }

  getFileError(): string | null {
    if (this.fileError) return this.fileError;
    if (!this.selectedFile) return 'Datei erforderlich';
    if (!this.selectedFileType) return 'Dateityp konnte nicht erkannt werden';
    if (!this.selectedFileDataUrl) return 'Datei wird noch verarbeitet';
    return null;
  }

  isFormValid(): boolean {
    const hasName = this.name.trim().length > 0;
    const hasValidFile = !!this.selectedFile && !!this.selectedFileType && !!this.selectedFileDataUrl;
    return hasName && hasValidFile && !this.fileError;
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
    if ([FileType.E57, FileType.OBJ, FileType.STL, FileType.PLY, FileType.GLB, FileType.GLTF, FileType.FBX, FileType.IFC].includes(fileType)) return 'view_in_ar';
    return 'insert_drive_file';
  }

  getPreviewTypeLabel(fileType: FileType | null): string {
    return (fileType || 'unbekannt').toUpperCase();
  }

  confirmAddDocument(): void {
    if (!this.isFormValid()) return;
    if (!this.selectedFile || !this.selectedFileType || !this.selectedFileDataUrl) return;

    const result: AddDocumentDialogResult = {
      name: this.name.trim(),
      description: this.normalizeOptionalInput(this.description),
      isPublic: this.isPublic,
      file: this.selectedFile,
      fileName: this.selectedFileName,
      fileType: this.selectedFileType,
      fileMimeType: this.selectedFileMimeType,
      fileDataUrl: this.selectedFileDataUrl,
      previewImageUrl: this.selectedPreviewImageUrl
    };

    this.dialogRef?.close(result);
  }

  close(): void {
    this.dialogRef?.close();
  }

  private processFile(file: File): void {
    this.removeSelectedFile();
    this.fileError = '';

    if (file.size > this.maxFileSizeInBytes) {
      this.fileError = 'Datei ist zu groß. Maximal 25MB erlaubt.';
      return;
    }

    const resolvedType = this.resolveFileType(file);
    if (!resolvedType) {
      this.fileError = 'Dateityp wird nicht unterstützt.';
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
    if (!normalized.includes('.')) return null;

    const extension = normalized.split('.').pop()?.toLowerCase() || '';
    return extension.length > 0 ? extension : null;
  }

  private normalizeOptionalInput(input: string): string | null {
    const trimmed = input.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
}
