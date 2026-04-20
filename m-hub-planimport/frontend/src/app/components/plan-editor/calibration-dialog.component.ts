// Calibration dialog with two modes:
//   - scale-ratio: user picks a paper scale (1:50, 1:100, ...) or enters a
//     custom denominator. mmPerUnit is derived directly — no clicking.
//   - two-point: fallback when the PDF has no reliable scale (scans,
//     non-uniform exports). Uses the two points the user clicked in the
//     viewer beforehand.

import { ChangeDetectionStrategy, Component, Inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA, MatDialogModule, MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSelectModule } from '@angular/material/select';
import { Calibration } from '../../models/plan.model';

interface CalibDialogData {
  /** If present, the two points the user clicked (two-point mode). */
  twoPoint?: { a: { x: number; y: number }; b: { x: number; y: number } };
}

@Component({
  selector: 'app-calibration-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatButtonToggleModule, MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Maßstab festlegen</h2>
    <mat-dialog-content>
      <mat-button-toggle-group [value]="mode()" (change)="mode.set($event.value)">
        <mat-button-toggle value="scale-ratio">Planmaßstab</mat-button-toggle>
        <mat-button-toggle value="two-point" [disabled]="!data.twoPoint">
          Zwei Punkte
        </mat-button-toggle>
      </mat-button-toggle-group>

      @if (mode() === 'scale-ratio') {
        <p class="hint">
          Den auf dem Plan angegebenen Maßstab wählen
          (z.B. <b>1:50</b> bedeutet: 1 mm auf Papier = 50 mm in der Realität).
        </p>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Maßstab</mat-label>
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
        <p class="calc">
          ≈ <b>{{ derivedMmPerUnit().toFixed(3) }}</b> mm pro PDF-Einheit
        </p>
      } @else {
        <p class="hint">
          Gib die reale Distanz zwischen den beiden angeklickten Punkten ein.
        </p>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Distanz</mat-label>
          <input matInput type="number" min="1" step="1" [(ngModel)]="valueMm" />
          <span matSuffix>mm</span>
        </mat-form-field>
        <p class="hint">Gemessen: {{ pixelDist.toFixed(2) }} PDF-Einheiten</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close()">Abbrechen</button>
      <button mat-raised-button color="primary" (click)="ok()"
              [disabled]="!canSubmit()">Übernehmen</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full { width: 100%; margin-top: 12px; }
    .hint { color: #607d8b; font-size: 13px; margin: 12px 0 4px; }
    .calc { color: #084b86; font-size: 13px; margin-top: 4px; }
    mat-button-toggle-group { width: 100%; }
    mat-button-toggle { flex: 1; }
  `],
})
export class CalibrationDialogComponent {
  mode = signal<'scale-ratio' | 'two-point'>('scale-ratio');
  scaleDenom = 50;
  customDenom = 50;
  valueMm = 1000;
  pixelDist = 0;

  constructor(
    public ref: MatDialogRef<CalibrationDialogComponent, Calibration>,
    @Inject(MAT_DIALOG_DATA) public data: CalibDialogData,
  ) {
    if (data.twoPoint) {
      this.pixelDist = Math.hypot(
        data.twoPoint.b.x - data.twoPoint.a.x,
        data.twoPoint.b.y - data.twoPoint.a.y,
      );
    }
    if (!data.twoPoint) this.mode.set('scale-ratio');
  }

  /**
   * Convert paper scale to mm-per-PDF-unit.
   *
   * PDF user-space default is 1/72 inch per unit. So one PDF unit represents
   * `25.4 / 72 ≈ 0.3528` mm *on paper*. Multiply by the scale denominator
   * (e.g. 50 for 1:50) to get real-world mm:
   *
   *     mmPerUnit = (25.4 / 72) * scaleDenominator
   */
  derivedMmPerUnit(): number {
    const denom = this.scaleDenom === -1 ? this.customDenom : this.scaleDenom;
    return (25.4 / 72) * (denom || 0);
  }

  canSubmit(): boolean {
    if (this.mode() === 'scale-ratio') {
      const denom = this.scaleDenom === -1 ? this.customDenom : this.scaleDenom;
      return denom > 0;
    }
    return !!this.data.twoPoint && this.valueMm > 0 && this.pixelDist > 0;
  }

  ok() {
    if (this.mode() === 'scale-ratio') {
      const denom = this.scaleDenom === -1 ? this.customDenom : this.scaleDenom;
      this.ref.close({
        mode: 'scale-ratio',
        scaleDenominator: denom,
        mmPerUnit: (25.4 / 72) * denom,
      });
    } else if (this.data.twoPoint) {
      const mmPerUnit = this.valueMm / this.pixelDist;
      this.ref.close({
        mode: 'two-point',
        a: this.data.twoPoint.a,
        b: this.data.twoPoint.b,
        realMm: this.valueMm,
        mmPerUnit,
      });
    }
  }
}
