import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  AufbautenKatalogService,
  CatalogCell,
  CatalogResponse
} from '../../services/aufbauten-katalog/aufbauten-katalog.service';

interface Chapter {
  period: string;
  cells: CatalogCell[];
}

/**
 * Aufbauten-Katalog — das "errechnete Buch": pro Bauperiode (Kapitel) × Lage × Bauteil
 * die typischen Schichtfolgen mit Anteil. Ebene ganz Wien (ohne periodsFilter) oder
 * gefiltert auf einzelne Perioden (Gebäude / eigener Bestand).
 */
@Component({
  selector: 'app-aufbauten-katalog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  templateUrl: './aufbauten-katalog.component.html',
  styleUrl: './aufbauten-katalog.component.scss'
})
export class AufbautenKatalogComponent implements OnInit {
  /** Auf diese Bauperioden beschränken (für Gebäude/Bestand); leer = ganz Wien. */
  @Input() periodsFilter: string[] | null = null;
  /** Überschrift überschreibbar (z.B. "… – dieses Gebäude"). */
  @Input() heading = 'Aufbauten-Katalog';
  @Input() subheading =
    'Typische Schichtfolgen je Bauperiode, Lage und Bauteil — aus den Materialdaten des Wiener Gebäudebestands errechnet (m-hub).';

  chapters: Chapter[] = [];
  isLoading = false;
  errorMessage = '';

  private response: CatalogResponse | null = null;

  constructor(private katalog: AufbautenKatalogService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.katalog.getCatalog()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: res => {
          this.response = res;
          this.buildChapters(res);
        },
        error: () => {
          this.errorMessage = 'Aufbauten-Katalog konnte nicht geladen werden.';
        }
      });
  }

  pct(anteil: number): string {
    return (anteil * 100).toLocaleString('de-AT', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });
  }

  orientationHint(art: string): string {
    return art === 'FB' || art === 'D'
      ? 'oben → unten'
      : 'innen → außen';
  }

  downloadCsv(): void {
    if (!this.response) return;
    const sep = ';';
    const lines: string[] = [
      'Aufbauten-Katalog — typische Schichtfolgen (m-hub)',
      '',
      ['Bauperiode', 'Lage', 'Bauteil', 'Anteil [%]', 'Aufbau (Schichtfolge)'].join(sep)
    ];
    for (const ch of this.chapters) {
      for (const cell of ch.cells) {
        for (const a of cell.aufbauten) {
          lines.push([
            ch.period,
            cell.ort_label,
            cell.art_label,
            this.pct(a.anteil),
            a.folge.join(' → ')
          ].join(sep));
        }
      }
    }
    const csv = '﻿' + lines.join('\r\n') + '\r\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'aufbauten-katalog.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private buildChapters(res: CatalogResponse): void {
    const allow = this.periodsFilter ? new Set(this.periodsFilter) : null;
    const byPeriod = new Map<string, CatalogCell[]>();
    for (const cell of res.cells) {
      if (allow && !allow.has(cell.bauperiode)) continue;
      const list = byPeriod.get(cell.bauperiode) ?? [];
      list.push(cell);
      byPeriod.set(cell.bauperiode, list);
    }
    this.chapters = res.period_order
      .filter(p => byPeriod.has(p))
      .map(period => ({ period, cells: byPeriod.get(period)! }));
  }
}
