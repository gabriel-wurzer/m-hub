import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PlanService } from '../../services/plan.service';
import { PlanDoc } from '../../models/plan.model';
import { MhubLayer } from '../../models/mhub.model';
import {
  computeQuantities, wallTotalsByType, floorTotalsByType, PlanQuantities,
} from '../../models/plan-quantities';

@Component({
  selector: 'app-report',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bar no-print">
      <button mat-icon-button (click)="back()" matTooltip="Zurück"><mat-icon>arrow_back</mat-icon></button>
      <span class="bar-title">Mengenauszug</span>
      <span class="spacer"></span>
      <button mat-stroked-button (click)="print()"><mat-icon>print</mat-icon> Drucken / PDF</button>
    </div>

    @if (plan(); as p) {
      <div class="sheet">
        <header>
          <h1>Mengenauszug</h1>
          <div class="meta">
            <div><b>Plan:</b> {{ p.originalFilename }}</div>
            @if (p.location) { <div><b>Geschoss:</b> {{ p.location }}</div> }
            <div><b>Maßstab:</b> 1:{{ p.calibration?.scaleDenominator ?? '—' }}</div>
            <div><b>Datum:</b> {{ today }}</div>
          </div>
          @if (!q().calibrated) {
            <div class="warn">Nicht kalibriert — Längen/Flächen sind 0. Erst Maßstab setzen.</div>
          }
        </header>

        <!-- Summary -->
        <section>
          <h2>Zusammenfassung</h2>
          <table class="sum">
            <tbody>
              <tr><td>Wände gesamt</td><td class="num">{{ q().wallTotalM | number:'1.2-2' }} m</td></tr>
              <tr><td>Boden gesamt</td><td class="num">{{ q().floorTotalM2 | number:'1.2-2' }} m²</td></tr>
              <tr><td>Objekte gesamt</td><td class="num">{{ q().objectTotal }} Stk</td></tr>
            </tbody>
          </table>
        </section>

        <!-- Walls -->
        <section>
          <h2>Wände <span class="sub">Laufmeter</span></h2>
          @if (q().walls.length === 0) { <p class="empty">Keine Wände mit Aufbau.</p> }
          @else {
            <table class="totals">
              <tbody>
                @for (t of wallTotals(); track t.partType) {
                  <tr><td>{{ t.partType }}</td><td class="num">{{ t.lengthM | number:'1.2-2' }} m</td></tr>
                }
              </tbody>
            </table>
            <table class="detail">
              <thead><tr><th>Bauteil</th><th>Typ</th><th class="num">Länge</th><th class="num">Dicke</th><th>Schichtaufbau (innen→außen)</th></tr></thead>
              <tbody>
                @for (w of q().walls; track $index) {
                  <tr>
                    <td>{{ w.name }}</td><td>{{ w.partType }}</td>
                    <td class="num">{{ w.lengthM | number:'1.2-2' }} m</td>
                    <td class="num">{{ w.thicknessMm }} mm</td>
                    <td class="layers">{{ layerText(w.layers) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </section>

        <!-- Floors -->
        <section>
          <h2>Böden <span class="sub">Fläche netto</span></h2>
          @if (q().floors.length === 0) { <p class="empty">Keine Böden mit Aufbau.</p> }
          @else {
            <table class="totals">
              <tbody>
                @for (t of floorTotals(); track t.partType) {
                  <tr><td>{{ t.partType }}</td><td class="num">{{ t.areaM2 | number:'1.2-2' }} m²</td></tr>
                }
              </tbody>
            </table>
            <table class="detail">
              <thead><tr><th>Bauteil</th><th>Typ</th><th class="num">Fläche</th><th>Schichtaufbau</th></tr></thead>
              <tbody>
                @for (f of q().floors; track $index) {
                  <tr>
                    <td>{{ f.name }}</td><td>{{ f.partType }}</td>
                    <td class="num">{{ f.areaM2 | number:'1.2-2' }} m²</td>
                    <td class="layers">{{ layerText(f.layers) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </section>

        <!-- Objects -->
        <section>
          <h2>Objekte</h2>
          @if (q().objects.length === 0) { <p class="empty">Keine Objekte.</p> }
          @else {
            <table class="detail">
              <thead><tr><th>Objekt</th><th>Typ</th><th class="num">Anzahl</th><th class="num">L×B×H (cm)</th></tr></thead>
              <tbody>
                @for (o of q().objects; track $index) {
                  <tr>
                    <td>{{ o.name }}</td><td>{{ o.objectType }}</td>
                    <td class="num">{{ o.count }}</td>
                    <td class="num">{{ dims(o) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </section>

        <footer class="foot">
          Erzeugt mit m-hub Plan Import · LCA-Wirkung (Masse, GWP) wird in m-hub berechnet.
        </footer>
      </div>
    } @else {
      <div class="loading">Lade …</div>
    }
  `,
  styles: [`
    :host { display: block; background: #eceff1; min-height: 100%; }
    .bar { display: flex; align-items: center; gap: 8px; padding: 8px 16px;
      background: #fff; border-bottom: 1px solid #e0e0e0; position: sticky; top: 0; }
    .bar-title { font-weight: 500; }
    .spacer { flex: 1; }
    .sheet { max-width: 820px; margin: 24px auto; background: #fff; padding: 32px 40px;
      box-shadow: 0 1px 6px rgba(0,0,0,0.15); color: #222; }
    header h1 { margin: 0 0 8px; font-size: 22px; }
    .meta { display: flex; flex-wrap: wrap; gap: 4px 24px; font-size: 13px; color: #455a64; }
    .warn { margin-top: 10px; padding: 8px 12px; background: #fff3e0; color: #a15311;
      border-radius: 4px; font-size: 13px; }
    section { margin-top: 24px; }
    h2 { font-size: 15px; border-bottom: 2px solid #263238; padding-bottom: 4px; margin: 0 0 10px; }
    h2 .sub { font-weight: 400; color: #78909c; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .sum td, .totals td { padding: 3px 6px; }
    .sum tr td:first-child, .totals tr td:first-child { color: #455a64; }
    .totals { margin-bottom: 10px; max-width: 340px; }
    .detail th, .detail td { border-bottom: 1px solid #eceff1; padding: 5px 6px; text-align: left; vertical-align: top; }
    .detail th { color: #607d8b; font-weight: 500; border-bottom: 1px solid #cfd8dc; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .layers { color: #37474f; }
    .empty { color: #90a4ae; font-size: 13px; }
    .foot { margin-top: 32px; padding-top: 10px; border-top: 1px solid #eceff1;
      font-size: 11px; color: #90a4ae; }
    .loading { padding: 40px; text-align: center; color: #607d8b; }
    @media print {
      :host { background: #fff; }
      .no-print { display: none !important; }
      .sheet { box-shadow: none; margin: 0; max-width: none; padding: 0; }
    }
  `],
})
export class ReportComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private planSvc = inject(PlanService);

  plan = signal<PlanDoc | null>(null);
  q = computed<PlanQuantities>(() => {
    const p = this.plan();
    return p ? computeQuantities(p)
      : { walls: [], floors: [], objects: [], wallTotalM: 0, floorTotalM2: 0, objectTotal: 0, calibrated: false };
  });
  wallTotals = computed(() => wallTotalsByType(this.q().walls));
  floorTotals = computed(() => floorTotalsByType(this.q().floors));
  today = new Date().toLocaleDateString('de-AT');

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.planSvc.get(id).subscribe((p) => this.plan.set(p));
  }

  layerText(layers: MhubLayer[]): string {
    return layers.map((l) => (l.thickness ? `${l.material} ${l.thickness}` : l.material)).join(' · ');
  }
  dims(o: { length?: number | null; width?: number | null; height?: number | null }): string {
    const v = [o.length, o.width, o.height];
    return v.some((x) => x != null) ? v.map((x) => x ?? '–').join('×') : '–';
  }
  print() { window.print(); }
  back() {
    const id = this.route.snapshot.paramMap.get('id');
    this.router.navigate(['/plan', id]);
  }
}
