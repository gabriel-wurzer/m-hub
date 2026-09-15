import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';

import { EChartsOption } from 'echarts';
import { NgxEchartsModule } from 'ngx-echarts';

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
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatSelectModule,
    NgxEchartsModule
  ],
  templateUrl: './urban-stock.component.html',
  styleUrl: './urban-stock.component.scss'
})
export class UrbanStockComponent implements OnInit {
  groupLabels: string[] = [];
  rows: StockRow[] = [];
  total: StockRow | null = null;

  materialsPieChartOptions: EChartsOption = {};
  /** 'gesamt' oder eine Bauperiode (row.period) — steuert die Pie. */
  selectedPeriod = 'gesamt';

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
    this.selectedPeriod = 'gesamt';
    this.applyPeriod();
  }

  /** Pie auf die gewählte Bauperiode (oder Gesamt) umstellen. */
  applyPeriod(): void {
    if (this.selectedPeriod === 'gesamt' || !this.selectedPeriod) {
      this.buildPie(this.total?.values ?? [], 'gesamter Wiener Gebäudebestand');
      return;
    }
    const row = this.rows.find(r => r.period === this.selectedPeriod);
    this.buildPie(row?.values ?? [], `Bauperiode ${this.selectedPeriod}`);
  }

  /** Pie der Materialzusammensetzung — gespiegelt zu Lukas' Gebäude-Chart. */
  private buildPie(values: number[], subtitle: string): void {
    if (!values.length) {
      this.materialsPieChartOptions = {};
      return;
    }
    const data = this.groupLabels
      .map((name, i) => ({ name, value: values[i] ?? 0 }))
      .filter(d => d.value > 0);

    this.materialsPieChartOptions = {
      title: {
        left: 'center',
        text: 'Baumaterialgruppen',
        subtext: subtitle,
        subtextStyle: { fontSize: 13 }
      },
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (params: any) => {
          const mioT = (Number(params.value) / 1e6).toLocaleString('de-AT', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          });
          return `${params.marker} ${params.name}: <b>${mioT} Mio t</b> (${params.percent} %)`;
        },
        textStyle: { fontSize: 15 }
      },
      legend: {
        orient: 'vertical',
        top: 'bottom',
        left: 'right',
        selectedMode: false,
        type: 'scroll',
        height: 110,
        pageButtonPosition: 'start',
        pageIconSize: 11
      },
      series: [
        {
          name: 'Baumaterialgruppen',
          type: 'pie',
          radius: '60%',
          center: ['50%', '45%'],
          data,
          label: { show: false },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    };
  }
}
