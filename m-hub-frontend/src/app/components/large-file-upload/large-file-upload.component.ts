import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnDestroy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Subscription, finalize, timer } from 'rxjs';

import {
  CreateSftpUploadSessionRequest,
  SftpUploadContext,
  SftpUploadService,
  SftpUploadSession
} from '../../services/sftp-upload/sftp-upload.service';

type RequestState = 'idle' | 'requesting' | 'unavailable' | 'ready' | 'error';

@Component({
  selector: 'app-large-file-upload',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './large-file-upload.component.html',
  styleUrl: './large-file-upload.component.scss'
})
export class LargeFileUploadComponent implements OnDestroy {
  @Input({ required: true }) context!: SftpUploadContext;
  @Input() documentId: string | null = null;
  @Input() buildingId: string | null = null;
  @Input() userBuildingId: string | null = null;
  @Input() documentName: string | null = null;

  // Switch to true once POST /api/sftp-upload-sessions is available.
  @Input() backendEnabled = false;

  state: RequestState = 'idle';
  session: SftpUploadSession | null = null;
  message = '';

  private activeRequest: Subscription | null = null;

  constructor(private sftpUploadService: SftpUploadService) {}

  ngOnDestroy(): void {
    this.activeRequest?.unsubscribe();
  }

  requestAccess(): void {
    if (this.state === 'requesting') return;

    this.state = 'requesting';
    this.session = null;
    this.message = '';

    if (!this.backendEnabled) {
      this.activeRequest = timer(700).subscribe(() => {
        this.activeRequest = null;
        this.state = 'unavailable';
        this.message = 'Die Bereitstellung des temporären SFTP-Zugangs muss noch im Backend implementiert werden.';
      });
      return;
    }

    this.activeRequest = this.sftpUploadService.createSession(this.buildRequest()).pipe(
      finalize(() => {
        this.activeRequest = null;
      })
    ).subscribe({
      next: session => {
        this.session = session;
        this.state = 'ready';
        this.message = 'Die Zugangsdaten wurden empfangen. Die Übergabe an einen SFTP-Client wird separat implementiert.';
      },
      error: error => {
        this.state = 'error';
        this.message = this.resolveError(error);
      }
    });
  }

  private buildRequest(): CreateSftpUploadSessionRequest {
    return {
      context: this.context,
      documentId: this.documentId,
      buildingId: this.buildingId,
      userBuildingId: this.userBuildingId,
      documentName: this.normalizeOptionalText(this.documentName)
    };
  }

  private resolveError(error: unknown): string {
    if (error instanceof HttpErrorResponse && (error.status === 0 || error.status === 404 || error.status === 501)) {
      return 'Der Dienst für temporäre SFTP-Zugänge ist noch nicht verfügbar.';
    }
    return 'Der temporäre SFTP-Zugang konnte nicht angefordert werden.';
  }

  private normalizeOptionalText(value: string | null): string | null {
    const trimmed = value?.trim() ?? '';
    return trimmed.length > 0 ? trimmed : null;
  }
}
