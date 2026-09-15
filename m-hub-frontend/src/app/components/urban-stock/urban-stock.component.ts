import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';

import { MaterialPassService } from '../../services/material-pass/material-pass.service';

interface StockRow {
  period: string;
  count: number;
  values: number[];
}

/**
 * Materiallager (urban stock / anthropogenes Lager) — stadtweite Materialbilanz
 * des Wiener Gebaeudebestands aus der M-DAB, nach Bauperiode. Speist Tabelle UND
 * CSV-Download aus derselben Quelle (dem City-Endpoint), kein zweiter Datenpfad.
 */
@Component({
  selector: 'app-urban-stock',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  templateUrl: './urban-stock.component.html',
  styleUrl: './urban-stock.component.scss'
})
export class UrbanStockComponent implements OnInit {
  groupLabels: string[] = [];
  rows: StockRow[] = [];
  total: StockRow | null = null;

  isLoading = false;
  isDownloading = false;
  errorMessage = '';

  private csvText = '';

  constructor(
    private materialPass: MaterialPassService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.materialPass.fetchCityCsv()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: csv => {
          this.csvText = csv;
          this.parse(csv);
        },
        error: () => {
          this.errorMessage = 'Materiallager-Daten konnten nicht geladen werden.';
        }
      });
  }

  downloadCsv(): void {
    if (!this.csvText || this.isDownloading) return;
    this.isDownloading = true;
    try {
      const blob = new Blob([this.csvText], { type: 'text/csv;charset=utf-8' });
      this.materialPass.saveBlob(blob, 'mgp_stadt-wien.csv');
    } catch {
      this.snackBar.open('Download fehlgeschlagen.', 'OK', { duration: 5000 });
    } finally {
      this.isDownloading = false;
    }
  }

  /** t -> Mio t, de-AT formatiert. */
  toMioT(v: number): string {
    return (v / 1e6).toLocaleString('de-AT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  formatCount(v: number): string {
    return v.toLocaleString('de-AT');
  }

  private parse(csv: string): void {
    const lines = csv.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim().length);
    const headerIdx = lines.findIndex(l => l.startsWith('Bauperiode;'));
    if (headerIdx < 0) {
      this.errorMessage = 'Unerwartetes Datenformat.';
      return;
    }
    const header = lines[headerIdx].split(';');
    this.groupLabels = header.slice(2).map(h => h.replace(/\s*\[t\]\s*$/, ''));
    this.rows = [];
    this.total = null;
    for (const line of lines.slice(headerIdx + 1)) {
      const c = line.split(';');
      const row: StockRow = {
        period: c[0],
        count: Number(c[1]),
        values: c.slice(2).map(Number)
      };
      if (c[0] === 'Summe') {
        this.total = row;
      } else {
        this.rows.push(row);
      }
    }
  }
}
