import { Injectable, signal } from '@angular/core';

/** Stats the editor publishes for display in the app top bar. */
export interface EditorStats {
  segments: number;
  walls: number;
  withBuildup: number;
  donePercent: number;
  excluded: number;
  objects: number;
}

@Injectable({ providedIn: 'root' })
export class EditorStatsService {
  /** Null when no plan is open (e.g. on the plan list). */
  readonly stats = signal<EditorStats | null>(null);
}
