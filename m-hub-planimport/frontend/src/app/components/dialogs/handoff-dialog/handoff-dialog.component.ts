import { ChangeDetectionStrategy, Component, Inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface HandoffDialogData {
  storeys: string[];       // from m-hub context (may be empty)
  integrated: boolean;
  bauteilCount: number;
  objektCount: number;
}

@Component({
  selector: 'app-handoff-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatCheckboxModule, MatFormFieldModule, MatInputModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>An m-hub übergeben</h2>
    <mat-dialog-content>
      <p class="sum">{{ data.bauteilCount }} Bauteil(e), {{ data.objektCount }} Objekt(e)
        werden für die gewählten Geschosse angelegt (ersetzt vorherige aus diesem Extrakt).</p>

      <h4>Geschoss(e)</h4>
      @if (data.storeys.length > 0) {
        <div class="list">
          @for (s of data.storeys; track s) {
            <mat-checkbox [checked]="picked().includes(s)" (change)="toggle(s, $event.checked)">{{ s }}</mat-checkbox>
          }
        </div>
      } @else {
        <p class="hint">Kein m-hub-Kontext — Geschoss frei eingeben.</p>
      }

      <div class="add">
        <mat-form-field appearance="outline" class="full">
          <mat-label>Geschoss hinzufügen</mat-label>
          <input matInput [(ngModel)]="freeText" (keydown.enter)="addFree()" placeholder="z.B. Regelgeschoss 1" />
        </mat-form-field>
        <button mat-icon-button (click)="addFree()" [disabled]="!freeText.trim()"><mat-icon>add</mat-icon></button>
      </div>

      @if (extra().length > 0) {
        <div class="chips">
          @for (s of extra(); track s) {
            <span class="chip">{{ s }} <button (click)="removeExtra(s)">✕</button></span>
          }
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close()">Abbrechen</button>
      <button mat-flat-button color="primary" [disabled]="all().length === 0" (click)="confirm()">
        {{ data.integrated ? 'Übergeben' : 'Packet herunterladen' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .sum { color: #455a64; font-size: 13px; margin: 0 0 16px; line-height: 1.5; }
    h4 { margin: 8px 0; color: #455a64; font-weight: 500; }
    .list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
    .hint { color: #90a4ae; font-size: 13px; }
    .add { display: flex; align-items: center; gap: 6px; }
    .full { flex: 1; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
    .chip { background: #e0f3fb; color: #084b86; border-radius: 12px; padding: 3px 10px; font-size: 13px; }
    .chip button { border: none; background: none; cursor: pointer; color: #084b86; margin-left: 2px; }
  `],
})
export class HandoffDialogComponent {
  picked = signal<string[]>([]);
  extra = signal<string[]>([]);
  freeText = '';

  constructor(
    public ref: MatDialogRef<HandoffDialogComponent, string[]>,
    @Inject(MAT_DIALOG_DATA) public data: HandoffDialogData,
  ) {}

  toggle(s: string, on: boolean) {
    this.picked.update((p) => (on ? [...new Set([...p, s])] : p.filter((x) => x !== s)));
  }
  addFree() {
    const s = this.freeText.trim();
    if (!s) return;
    this.extra.update((e) => [...new Set([...e, s])]);
    this.freeText = '';
  }
  removeExtra(s: string) { this.extra.update((e) => e.filter((x) => x !== s)); }
  all(): string[] { return [...new Set([...this.picked(), ...this.extra()])]; }
  confirm() { this.ref.close(this.all()); }
}
