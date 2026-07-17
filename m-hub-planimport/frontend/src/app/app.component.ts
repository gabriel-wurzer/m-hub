import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { EditorStatsService } from './services/editor-stats.service';
import { MaterialPresetsDialogComponent } from './components/dialogs/material-presets-dialog/material-presets-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    MatToolbarModule, MatButtonModule, MatIconModule, MatTooltipModule, MatDialogModule,
  ],
  template: `
    <mat-toolbar color="primary" class="top-bar">
      <mat-icon>architecture</mat-icon>
      <span class="title">M-hub · Plan Import</span>
      <span class="spacer"></span>
      @if (stats.stats(); as s) {
        <span class="editor-stats">{{ s.segments }} Segmente · {{ s.walls }} Wände · {{ s.withBuildup }} mit Aufbau ({{ s.donePercent }}%)@if (s.objects > 0) {&nbsp;· {{ s.objects }} Objekte}@if (s.excluded > 0) {&nbsp;· {{ s.excluded }} ausgeschl.}</span>
      }
      <button mat-icon-button (click)="openPresets()" matTooltip="Material-Defaults">
        <mat-icon>tune</mat-icon>
      </button>
      <a mat-button routerLink="/plans" routerLinkActive="active">
        <mat-icon>folder_open</mat-icon> Pläne
      </a>
    </mat-toolbar>
    <main class="content"><router-outlet /></main>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; }
    .top-bar { position: sticky; top: 0; z-index: 10; }
    .title { margin-left: 12px; font-weight: 500; }
    .spacer { flex: 1; }
    .active { text-decoration: underline; }
    .editor-stats { font-size: 12px; opacity: 0.85; margin-right: 16px; white-space: nowrap; }
    .content { flex: 1; min-height: 0; display: flex; }
  `],
})
export class AppComponent {
  stats = inject(EditorStatsService);
  private dialog = inject(MatDialog);

  openPresets() {
    this.dialog.open(MaterialPresetsDialogComponent, {
      width: '600px', maxWidth: '95vw', maxHeight: '85vh',
    });
  }
}
