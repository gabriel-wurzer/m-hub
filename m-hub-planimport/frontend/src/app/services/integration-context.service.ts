import { Injectable } from '@angular/core';

/**
 * Context passed by m-hub when it launches the tool ("Absprung"), read from the
 * URL query once at startup. Absent → stand-alone mode.
 *
 * Example launch:
 *   /plans?building_id=5312213&user_building_id=<uuid>&owner_id=<uuid>
 *          &token=<jwt>&submit_url=/api/import/plan&storeys=Regelgeschoss%201,Dach
 *          &document_id=<uuid>&pdf_url=/files/mhub/documents/.../plan.pdf
 */
export interface IntegrationContext {
  buildingId: string;
  userBuildingId: string;
  ownerId: string;
  token: string;
  submitUrl: string;
  storeys: string[];
  pdfUrl?: string;
  /** The m-hub document (PDF) this plan came from — extract-id key with the storey. */
  documentId?: string;
}

@Injectable({ providedIn: 'root' })
export class IntegrationContextService {
  readonly context: IntegrationContext | null = this.read();

  get integrated(): boolean { return this.context !== null; }

  private read(): IntegrationContext | null {
    try {
      const q = new URLSearchParams(window.location.search);
      const buildingId = q.get('building_id');
      const submitUrl = q.get('submit_url');
      const token = q.get('token');
      if (!buildingId || !submitUrl || !token) return null;
      return {
        buildingId,
        userBuildingId: q.get('user_building_id') ?? '',
        ownerId: q.get('owner_id') ?? '',
        token,
        submitUrl,
        storeys: (q.get('storeys') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
        pdfUrl: q.get('pdf_url') ?? undefined,
        documentId: q.get('document_id') ?? undefined,
      };
    } catch {
      return null;
    }
  }
}
