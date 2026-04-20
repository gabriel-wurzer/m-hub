import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    MatToolbarModule, MatButtonModule, MatIconModule,
  ],
  template: `
    <mat-toolbar color="primary" class="top-bar">
      <mat-icon>architecture</mat-icon>
      <span class="title">M-hub · Plan Import</span>
      <span class="spacer"></span>
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
    .content { flex: 1; min-height: 0; display: flex; }
  `],
})
export class AppComponent {}
