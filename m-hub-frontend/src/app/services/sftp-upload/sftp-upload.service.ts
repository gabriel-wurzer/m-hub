import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export type SftpUploadContext = 'document-add';
export type SftpUploadStatus = 'ready' | 'waiting' | 'uploaded' | 'verified' | 'expired' | 'failed';

export type CreateSftpUploadSessionRequest = {
  context: SftpUploadContext;
  documentId?: string | null;
  buildingId?: string | null;
  userBuildingId?: string | null;
  documentName?: string | null;
  expectedFileName?: string | null;
};

export type SftpUploadSession = {
  sessionId: string;
  status: SftpUploadStatus;
  host: string;
  port: number;
  username: string;
  password: string;
  targetPath: string;
  expiresAt: string;
  receivedFileName?: string | null;
  receivedFileSizeBytes?: number | null;
};

@Injectable({
  providedIn: 'root'
})
export class SftpUploadService {
  private readonly apiUrl = '/api/sftp-upload-sessions';

  constructor(private http: HttpClient) {}

  createSession(request: CreateSftpUploadSessionRequest): Observable<SftpUploadSession> {
    return this.http.post<SftpUploadSession>(this.apiUrl, request);
  }

  getSession(sessionId: string): Observable<SftpUploadSession> {
    return this.http.get<SftpUploadSession>(`${this.apiUrl}/${encodeURIComponent(sessionId)}`);
  }

  abortSession(sessionId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${encodeURIComponent(sessionId)}`);
  }
}
