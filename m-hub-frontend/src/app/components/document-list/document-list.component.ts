import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Document, DocumentSummaryDto } from '../../models/document';
import { Building } from '../../models/building';
import { isBuilding } from '../../utils/model-guard';
import { BuildingComponent } from '../../models/building-component';
import { DocumentService } from '../../services/document/document.service';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { EntityInfoDialogComponent } from '../dialogs/entity-info-dialog/entity-info-dialog.component';
import { AuthenticationService } from '../../services/authentication/authentication.service';
import { Subscription } from 'rxjs';
import { FileType } from '../../enums/file-type.enum';

type DocumentListItem = DocumentSummaryDto & {
  canRead: boolean;
  fileType?: string;
};

@Component({
  selector: 'app-document-list',
  standalone: true,
  imports: [CommonModule, MatListModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule, MatDialogModule, MatSnackBarModule],
  templateUrl: './document-list.component.html',
  styleUrls: ['./document-list.component.scss']
})
export class DocumentListComponent implements OnInit, OnChanges, OnDestroy {
  @Input() entity!: Building | BuildingComponent | null;
  @Input() documentsArray!: Document[] | null;
  @Input() skipFetch = false;

  documents: DocumentListItem[] = [];
  isLoading = false;
  errorMessage = '';
  private readonly imageFileTypes = new Set<FileType>([
    FileType.JPG,
    FileType.PNG,
    FileType.GIF,
    FileType.BMP,
    FileType.TIFF,
    FileType.SVG,
    FileType.WEBP
  ]);

  private currentUserId: string | null = null;
  private authSubscription: Subscription | undefined;
  private authInitialized = false;
  private loadingDocumentIds = new Set<string>();

  constructor(
    private documentService: DocumentService,
    private dialog: MatDialog,
    private authService: AuthenticationService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.authSubscription = this.authService.getUser$().subscribe((user) => {
      const nextUserId = user?.id ?? null;
      const shouldReload =
        this.authInitialized &&
        this.currentUserId !== nextUserId &&
        !!this.entity &&
        !this.skipFetch;

      this.currentUserId = nextUserId;
      this.authInitialized = true;

      if (shouldReload && this.entity) {
        this.loadDocumentsForEntity(this.entity);
      }
    });

    if (this.documentsArray) {
      this.documents = this.documentsArray.map((doc) => this.normalizeDocument(doc));
    }

    if (!this.entity || this.skipFetch) return;
    this.loadDocumentsForEntity(this.entity);
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['documentsArray'] && this.documentsArray) {
      this.documents = this.documentsArray.map((doc) => this.normalizeDocument(doc));
    }

    if ((changes['entity'] || changes['skipFetch']) && this.entity && !this.skipFetch) {
      this.loadDocumentsForEntity(this.entity);
    }
  }

  private loadDocumentsForEntity(entity: Building | BuildingComponent): void {
    if (this.isLoading) return;
    this.isLoading = true;
    this.errorMessage = '';
    this.documents = [];

    const buildingId = isBuilding(entity) ? entity.bw_geb_id : entity.building_id;
    const componentId = isBuilding(entity) ? undefined : entity.id;

    this.documentService.getDocumentSummariesByBuilding(buildingId, componentId).subscribe({
      next: (docs: DocumentSummaryDto[]) => {
        this.documents = docs.map((doc) => this.normalizeDocument(doc));
        this.errorMessage = docs.length === 0
          ? isBuilding(entity)
            ? 'No documents found for this building.'
            : 'No documents found for this building component.'
          : '';
      },
      error: (error) => {
        console.error('Error loading documents:', error);
        this.errorMessage = 'An error occurred while loading documents. Please try again.';
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  onDocumentClick(document: DocumentListItem): void {
    if (!document.canRead) {
      this.snackBar.open('Zugriff nicht erlaubt: Dokument ist nicht öffentlich.', 'OK', {
        duration: 5000,
        verticalPosition: 'top',
        panelClass: 'snackbar-warn'
      });
      return;
    }

    if (!document.id || this.loadingDocumentIds.has(document.id)) {
      return;
    }

    this.loadingDocumentIds.add(document.id);

    this.documentService.getDocumentById(document.id).subscribe({
      next: (loadedDocument) => this.openEntityInfoDialog(loadedDocument),
      error: (error) => {
        console.error('Error loading document details:', error);
      },
      complete: () => {
        this.loadingDocumentIds.delete(document.id);
      }
    });
  }

  getDocumentIcon(document: DocumentListItem): string {
    const fileType = this.normalizeFileType(document.fileType ?? document.file_type);
    return this.getPreviewIcon(fileType);
  }

  private normalizeDocument(document: Document | DocumentSummaryDto): DocumentListItem {
    return {
      ...document,
      fileType: typeof document.file_type === 'string' ? document.file_type.toLowerCase() : undefined,
      canRead: this.resolveCanRead(document)
    };
  }

  private resolveCanRead(document: Document | DocumentSummaryDto): boolean {
    const documentSummary = document as Partial<DocumentSummaryDto>;
    const explicitAccess = documentSummary.can_read ?? documentSummary.canRead;
    if (typeof explicitAccess === 'boolean') return explicitAccess;

    // Fallback when full Document objects are passed via @Input documentsArray.
    if ('is_public' in document && document.is_public) return true;
    if ('owner_id' in document && this.currentUserId && document.owner_id === this.currentUserId) return true;

    return false;
  }

  private normalizeFileType(fileType: unknown): FileType | null {
    if (typeof fileType !== 'string') return null;
    const normalized = fileType.trim().toLowerCase();
    return (Object.values(FileType) as string[]).includes(normalized)
      ? (normalized as FileType)
      : null;
  }

  private getPreviewIcon(fileType: FileType | null): string {
    if (!fileType) return 'insert_drive_file';

    if (this.imageFileTypes.has(fileType)) return 'image';
    if (fileType === FileType.PDF) return 'picture_as_pdf';
    if ([FileType.CSV, FileType.XLSX, FileType.XLSM].includes(fileType)) return 'table_chart';
    if ([FileType.DOC, FileType.DOCX, FileType.TXT, FileType.RTF, FileType.ODT, FileType.MD].includes(fileType)) return 'description';
    if ([FileType.E57, FileType.OBJ, FileType.STL, FileType.PLY, FileType.GLB, FileType.GLTF, FileType.FBX, FileType.IFC, FileType.LAS, FileType.LAZ].includes(fileType)) return 'view_in_ar';

    return 'insert_drive_file';
  }

  private openEntityInfoDialog(entity: Document): void {
    this.dialog.open(EntityInfoDialogComponent, {
      width: '90%',
      maxWidth: '620px',
      maxHeight: '90vh',
      autoFocus: false,
      data: { entity }
    });
  }
}
