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

/** sessionStorage-Schluessel. Pro Tab, stirbt mit dem Tab — genau die Lebensdauer
 *  eines Absprungs. Das Token steht ohnehin schon in der Adresszeile. */
const STORAGE_KEY = 'mhub.integrationContext';

@Injectable({ providedIn: 'root' })
export class IntegrationContextService {
  readonly context: IntegrationContext | null = this.read() ?? this.restore();

  get integrated(): boolean { return this.context !== null; }

  private read(): IntegrationContext | null {
    try {
      const q = new URLSearchParams(window.location.search);
      const buildingId = q.get('building_id');
      const submitUrl = q.get('submit_url');
      const token = q.get('token');
      if (!buildingId || !submitUrl || !token) return null;
      return this.remember({
        buildingId,
        userBuildingId: q.get('user_building_id') ?? '',
        ownerId: q.get('owner_id') ?? '',
        token,
        submitUrl,
        storeys: (q.get('storeys') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
        pdfUrl: q.get('pdf_url') ?? undefined,
        documentId: q.get('document_id') ?? undefined,
      });
    } catch {
      return null;
    }
  }

  /** Kontext merken, damit er einen Reload ueberlebt. Ohne das faellt das Tool
   *  nach jedem F5 in den Stand-alone-Modus und "Uebergeben" wird zu
   *  "Packet herunterladen" — die Absprung-Parameter stehen nur beim ersten
   *  Aufruf in der Adresszeile, danach ist die Route /plan/<id>. */
  private remember(ctx: IntegrationContext): IntegrationContext {
    try {
      // pdfUrl NICHT mitspeichern: sonst legt die Planliste bei jedem Reload
      // erneut einen Plan aus demselben PDF an.
      const { pdfUrl: _drop, ...rest } = ctx;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
    } catch {
      /* privater Modus o.ae. — dann eben nur fuer diesen Seitenaufbau */
    }
    return ctx;
  }

  private restore(): IntegrationContext | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const ctx = JSON.parse(raw) as IntegrationContext;
      return ctx.buildingId && ctx.submitUrl && ctx.token ? ctx : null;
    } catch {
      return null;
    }
  }
}
