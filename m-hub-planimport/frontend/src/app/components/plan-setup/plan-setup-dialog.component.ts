// Post-upload setup dialog: user picks wall colors via pipette on the plan
// preview, selects a scale, then triggers wall detection. The dialog blocks
// navigation until the user either analyzes successfully or cancels.

import {
  ChangeDetectionStrategy, Component, Inject, signal, computed, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA, MatDialogModule, MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PlanViewerComponent } from '../plan-viewer/plan-viewer.component';
import { PlanService } from '../../services/plan.service';
import { DetectRegion, PlanDoc } from '../../models/plan.model';

export interface SetupDialogData {
  plan: PlanDoc;
}

function rgbCss(c: [number, number, number]): string {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

@Component({
  selector: 'app-plan-setup-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule,
    MatButtonModule, MatButtonToggleModule, MatIconModule, MatFormFieldModule,
    MatSelectModule, MatInputModule, MatProgressBarModule,
    MatTooltipModule, PlanViewerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="setup-dialog">
      <div class="header">
        <mat-icon>architecture</mat-icon>
        <h2>Plan konfigurieren</h2>
        <span class="filename">{{ data.plan.originalFilename }}</span>
      </div>

      <div class="body">
        <div class="viewer-area">
          <div class="mode-bar">
            <mat-button-toggle-group [value]="setupTool()" (change)="setupTool.set($event.value)">
              <mat-button-toggle value="pipette"><mat-icon>colorize</mat-icon>&nbsp;Wandfarbe</mat-button-toggle>
              <mat-button-toggle value="region"><mat-icon>crop_free</mat-icon>&nbsp;Bereich</mat-button-toggle>
            </mat-button-toggle-group>
          </div>
          <app-plan-viewer #viewer
            [plan]="viewerPlan()"
            [tool]="setupTool()"
            [selection]="[]"
            [thicknessFilterMm]="[0, 99999]"
            [fitMargin]="0"
            [regions]="regions()"
            (colorPicked)="onColorPicked($event)"
            (regionsChange)="regions.set($event)" />
          <div class="viewer-hint">
            @if (setupTool() === 'pipette') {
              <mat-icon>colorize</mat-icon>
              Klicke auf eine Wand um die Farbe aufzunehmen
            } @else {
              <mat-icon>crop_free</mat-icon>
              Rechteck ziehen = Erkennungsbereich. Leer = ganzer Plan.
            }
          </div>
        </div>

        <div class="panel">
          <div class="section">
            <h3>Maßstab</h3>
            <mat-form-field appearance="outline" class="full">
              <mat-label>Planmaßstab</mat-label>
              <mat-select [(value)]="scaleDenom">
                <mat-option [value]="20">1:20</mat-option>
                <mat-option [value]="25">1:25</mat-option>
                <mat-option [value]="50">1:50</mat-option>
                <mat-option [value]="100">1:100</mat-option>
                <mat-option [value]="200">1:200</mat-option>
                <mat-option [value]="500">1:500</mat-option>
                <mat-option [value]="-1">Benutzerdefiniert…</mat-option>
              </mat-select>
            </mat-form-field>
            @if (scaleDenom === -1) {
              <mat-form-field appearance="outline" class="full">
                <mat-label>Eigener Nenner</mat-label>
                <span matPrefix>1 :&nbsp;</span>
                <input matInput type="number" min="1" step="1" [(ngModel)]="customDenom" />
              </mat-form-field>
            }
          </div>

          <div class="section">
            <h3>Wandfarben</h3>
            <div class="palette">
              @for (c of wallColors(); track $index) {
                <div class="swatch-row">
                  <span class="swatch" [style.background]="rgbCss(c)"></span>
                  <span class="swatch-label">{{ c[0] }}, {{ c[1] }}, {{ c[2] }}</span>
                  <button mat-icon-button (click)="removeColor($index)"
                          matTooltip="Entfernen">
                    <mat-icon>close</mat-icon>
                  </button>
                </div>
              }
              @if (wallColors().length === 0) {
                <div class="empty-palette">
                  <mat-icon>colorize</mat-icon>
                  <span>Noch keine Farbe gewählt.<br>Klicke links auf eine Wand.</span>
                </div>
              }
            </div>
          </div>

          <div class="section">
            <h3>Erkennungsbereich <span class="opt">optional</span></h3>
            @if (regions().length === 0) {
              <div class="region-empty">
                Kein Bereich — der ganze Plan wird erkannt. Wechsle oben auf
                „Bereich" und ziehe Rechtecke, um Koten &amp; Ränder auszusparen.
              </div>
            } @else {
              <div class="region-list">
                @for (r of regions(); track $index) {
                  <div class="region-row">
                    <mat-icon>crop_free</mat-icon>
                    <span class="region-label">Bereich {{ $index + 1 }}</span>
                    <button mat-icon-button (click)="removeRegion($index)" matTooltip="Entfernen">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                }
              </div>
            }
          </div>

          @if (error()) {
            <div class="error">{{ error() }}</div>
          }

          <div class="actions">
            @if (analyzing()) {
              <mat-progress-bar mode="indeterminate" />
              <div class="progress-text">Wände werden erkannt…</div>
            } @else {
              <button mat-raised-button color="primary"
                      (click)="analyze()"
                      [disabled]="!canAnalyze()"
                      class="full-btn">
                <mat-icon>auto_fix_high</mat-icon>
                Analysieren
              </button>
              <button mat-button (click)="cancel()" class="full-btn">
                Abbrechen
              </button>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .setup-dialog { display: flex; flex-direction: column; height: 80vh; width: 85vw; max-width: 1400px; }
    .header {
      display: flex; align-items: center; gap: 12px;
      padding: 16px 20px; border-bottom: 1px solid #eceff1;
    }
    .header h2 { margin: 0; font-size: 18px; }
    .filename { color: #607d8b; font-size: 13px; margin-left: auto; }
    .body { display: flex; flex: 1; min-height: 0; }

    .viewer-area {
      flex: 1; min-width: 0; display: flex; flex-direction: column;
      background: #eceff1; position: relative;
    }
    .viewer-hint {
      position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.7); color: #fff; padding: 6px 16px;
      border-radius: 20px; font-size: 13px;
      display: flex; align-items: center; gap: 6px;
      pointer-events: none;
    }

    .panel {
      width: 300px; padding: 20px; border-left: 1px solid #eceff1;
      display: flex; flex-direction: column; gap: 20px;
      overflow-y: auto;
    }
    .section h3 { margin: 0 0 8px; font-size: 14px; font-weight: 500; color: #455a64; }
    .full { width: 100%; }
    .palette { display: flex; flex-direction: column; gap: 8px; }
    .swatch-row {
      display: flex; align-items: center; gap: 8px;
      padding: 4px 8px; background: #f4f8fb; border-radius: 6px;
    }
    .swatch {
      width: 28px; height: 28px; border-radius: 4px;
      border: 2px solid #fff; box-shadow: 0 0 0 1px #90a4ae;
      flex-shrink: 0;
    }
    .swatch-label { font-size: 12px; color: #607d8b; font-family: monospace; flex: 1; }
    .empty-palette {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 24px 8px; color: #90a4ae; text-align: center; font-size: 13px;
    }
    .empty-palette mat-icon { font-size: 32px; width: 32px; height: 32px; }
    .error { color: #c62828; font-size: 13px; padding: 8px; background: #fbe9e7; border-radius: 6px; }

    .actions { margin-top: auto; display: flex; flex-direction: column; gap: 8px; }
    .full-btn { width: 100%; }
    .progress-text { text-align: center; color: #607d8b; font-size: 13px; margin-top: 4px; }

    .mode-bar { position: absolute; top: 12px; left: 12px; z-index: 2;
      background: #fff; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
    .mode-bar .mat-button-toggle-checked { background: #107bbc; color: #fff; }
    .mode-bar .mat-button-toggle-checked .mat-icon { color: #fff; }
    .opt { font-size: 11px; color: #90a4ae; font-weight: 400; }
    .region-empty { font-size: 12px; color: #90a4ae; line-height: 1.4; }
    .region-list { display: flex; flex-direction: column; gap: 6px; }
    .region-row { display: flex; align-items: center; gap: 8px;
      padding: 2px 8px; background: #f4f8fb; border-radius: 6px; }
    .region-row .region-label { flex: 1; font-size: 13px; color: #455a64; }
    .region-row mat-icon { color: #107bbc; }
  `],
})
export class PlanSetupDialogComponent {
  @ViewChild('viewer') viewer!: PlanViewerComponent;

  wallColors = signal<Array<[number, number, number]>>([]);
  analyzing = signal(false);
  error = signal<string | null>(null);
  scaleDenom = 100;
  customDenom = 100;

  setupTool = signal<'pipette' | 'region'>('pipette');
  regions = signal<DetectRegion[]>([]);

  rgbCss = rgbCss;

  // Build a minimal PlanDoc for the viewer (just raster, no segments).
  viewerPlan = computed<PlanDoc>(() => ({
    ...this.data.plan,
    wallSegments: [],
    wallGroups: [],
    placemarks: [],
    polygons: [],
  }));

  canAnalyze = computed(() => this.wallColors().length > 0 && !this.analyzing());

  constructor(
    public ref: MatDialogRef<PlanSetupDialogComponent, PlanDoc | null>,
    @Inject(MAT_DIALOG_DATA) public data: SetupDialogData,
    private planSvc: PlanService,
  ) {}

  onColorPicked(color: [number, number, number]) {
    const exists = this.wallColors().some(
      (c) => Math.hypot(c[0] - color[0], c[1] - color[1], c[2] - color[2]) < 25,
    );
    if (exists) return;
    this.wallColors.update((prev) => [...prev, color]);
  }

  removeColor(index: number) {
    this.wallColors.update((prev) => prev.filter((_, i) => i !== index));
  }

  removeRegion(index: number) {
    this.regions.update((prev) => prev.filter((_, i) => i !== index));
  }

  analyze() {
    const plan = this.data.plan;
    const colors = this.wallColors();
    const denom = this.scaleDenom === -1 ? this.customDenom : this.scaleDenom;
    if (colors.length === 0 || denom <= 0) return;

    this.analyzing.set(true);
    this.error.set(null);

    this.planSvc.detectWalls(plan.id, colors, denom, undefined, this.regions()).subscribe({
      next: (updated) => {
        this.analyzing.set(false);
        this.ref.close(updated);
      },
      error: (err) => {
        this.analyzing.set(false);
        this.error.set(err?.error?.error ?? err?.message ?? 'Analyse fehlgeschlagen');
      },
    });
  }

  cancel() {
    this.ref.close(null);
  }
}
