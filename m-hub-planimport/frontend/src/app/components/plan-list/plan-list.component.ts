import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PlanService } from '../../services/plan.service';
import { PlanDoc } from '../../models/plan.model';
import { PlanSetupDialogComponent, SetupDialogData } from '../plan-setup/plan-setup-dialog.component';

@Component({
  selector: 'app-plan-list',
  standalone: true,
  imports: [
    CommonModule, MatCardModule, MatButtonModule, MatIconModule,
    MatListModule, MatProgressBarModule, MatDialogModule, MatTooltipModule,
  ],
  template: `
    <div class="page">
      <mat-card class="upload-card">
        <mat-card-header>
          <mat-card-title>Neuen Plan importieren</mat-card-title>
          <mat-card-subtitle>PDF (Vektor oder gescannt) hochladen</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <input #fileInput type="file" accept="application/pdf" hidden
                 (change)="onFile($event)" />
          <button mat-raised-button color="primary" (click)="fileInput.click()"
                  [disabled]="uploading()">
            <mat-icon>upload_file</mat-icon> PDF wählen
          </button>
          @if (uploading()) {
            <mat-progress-bar mode="indeterminate" />
            <div class="hint">PDF wird verarbeitet…</div>
          }
          @if (error()) {
            <div class="error">{{ error() }}</div>
          }
        </mat-card-content>
      </mat-card>

      <mat-card class="list-card">
        <mat-card-header>
          <mat-card-title>Vorhandene Pläne</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (plans().length === 0) {
            <p class="empty">Noch keine Pläne importiert.</p>
          } @else {
            <mat-list>
              @for (p of plans(); track p.id) {
                <mat-list-item class="plan-row">
                  <mat-icon matListItemIcon>description</mat-icon>
                  <div matListItemTitle (click)="open(p.id)" class="clickable">{{ p.originalFilename }}</div>
                  <div matListItemLine (click)="open(p.id)" class="clickable">
                    Aktualisiert {{ p.updatedAt | date:'short' }}
                  </div>
                  <button mat-icon-button matListItemMeta
                          (click)="deletePlan(p.id, $event)"
                          matTooltip="Plan löschen">
                    <mat-icon>delete</mat-icon>
                  </button>
                </mat-list-item>
              }
            </mat-list>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .page {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 24px;
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
      width: 100%;
    }
    .upload-card mat-card-content { display: flex; flex-direction: column; gap: 12px; padding-top: 12px; }
    .hint { color: #607d8b; font-size: 13px; }
    .error { color: #c62828; font-size: 13px; }
    .empty { color: #607d8b; padding: 12px 0; }
    .plan-row { cursor: pointer; }
    .plan-row:hover { background: #f4f8fb; }
    .clickable { cursor: pointer; }
    @media (max-width: 900px) { .page { grid-template-columns: 1fr; } }
  `],
})
export class PlanListComponent {
  private planSvc = inject(PlanService);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  plans = signal<Array<Pick<PlanDoc, 'id' | 'originalFilename' | 'createdAt' | 'updatedAt'>>>([]);
  uploading = signal(false);
  error = signal<string | null>(null);

  constructor() {
    this.refresh();
  }

  refresh() {
    this.planSvc.list().subscribe({
      next: (p) => this.plans.set(p),
      error: (e) => this.error.set(e?.message ?? 'Laden fehlgeschlagen'),
    });
  }

  onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.error.set(null);
    this.planSvc.upload(file).subscribe({
      next: (plan) => {
        this.uploading.set(false);
        this.openSetupDialog(plan);
      },
      error: (e) => {
        this.uploading.set(false);
        this.error.set(e?.error?.error ?? e?.message ?? 'Upload fehlgeschlagen');
      },
    });
  }

  private openSetupDialog(plan: PlanDoc) {
    const ref = this.dialog.open(PlanSetupDialogComponent, {
      data: { plan } as SetupDialogData,
      disableClose: true,
      maxWidth: '95vw',
      maxHeight: '95vh',
      panelClass: 'setup-dialog-panel',
    });
    ref.afterClosed().subscribe((result: PlanDoc | null) => {
      if (result) {
        this.router.navigate(['/plan', result.id]);
        this.refresh();
      } else {
        // Cancelled — delete the uploaded plan.
        this.planSvc.delete(plan.id).subscribe({ next: () => this.refresh() });
      }
    });
  }

  open(id: string) {
    this.router.navigate(['/plan', id]);
  }

  deletePlan(id: string, ev: Event) {
    ev.stopPropagation();
    if (!confirm('Plan wirklich löschen?')) return;
    this.planSvc.delete(id).subscribe({
      next: () => this.refresh(),
      error: () => this.error.set('Löschen fehlgeschlagen'),
    });
  }
}
