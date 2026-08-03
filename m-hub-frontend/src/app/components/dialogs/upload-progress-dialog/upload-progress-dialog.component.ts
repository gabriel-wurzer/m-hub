import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { Document, ReserveDocumentPayload } from '../../../models/document';
import { DocumentService } from '../../../services/document/document.service';

export type UploadProgressDialogData = { file: File; meta: ReserveDocumentPayload };
export type UploadProgressDialogResult =
  | { status: 'done'; document: Document }
  | { status: 'cancelled' }
  | { status: 'error' };

/**
 * Blockierender Upload-Dialog: besitzt den Lebenszyklus des Uploads. Die tus-Subscription
 * lebt genau so lange wie der Dialog offen ist und wird beim Schließen/Abbrechen sauber
 * abgebrochen (kein blindes Wegnavigieren, kein inkonsistenter Abschluss, kein Leak).
 * Der Aufrufer öffnet mit disableClose:true.
 */
@Component({
  selector: 'app-upload-progress-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatProgressBarModule, MatButtonModule, MatIconModule],
  templateUrl: './upload-progress-dialog.component.html',
  styleUrl: './upload-progress-dialog.component.scss'
})
export class UploadProgressDialogComponent implements OnInit, OnDestroy {
  percent = 0;
  mb: string | null = null;
  errored = false;
  private sub?: Subscription;

  constructor(
    public dialogRef: MatDialogRef<UploadProgressDialogComponent, UploadProgressDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: UploadProgressDialogData,
    private documentService: DocumentService
  ) {}

  ngOnInit(): void {
    this.sub = this.documentService
      .uploadResumable(this.data.file, this.data.meta, (pct, sent, total) => {
        this.percent = pct;
        this.mb = total > 0 ? `${(sent / 1048576).toFixed(1)} / ${(total / 1048576).toFixed(1)} MB` : null;
      })
      .subscribe({
        next: doc => this.dialogRef.close({ status: 'done', document: doc }),
        error: () => { this.errored = true; }
      });
  }

  ngOnDestroy(): void {
    // Dialog weg -> Upload abbrechen (Teardown ruft upload.abort()).
    this.sub?.unsubscribe();
  }

  cancel(): void {
    this.sub?.unsubscribe();
    this.dialogRef.close({ status: 'cancelled' });
  }

  closeError(): void {
    this.dialogRef.close({ status: 'error' });
  }
}
