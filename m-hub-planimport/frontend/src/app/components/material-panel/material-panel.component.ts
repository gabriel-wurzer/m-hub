import {
  ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges,
  Output, SimpleChanges, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { MaterialLayer, OekobaudatHit, WallSegment } from '../../models/plan.model';
import { PlanService } from '../../services/plan.service';

export type MaterialTarget = { kind: 'wall'; wall: WallSegment };

@Component({
  selector: 'app-material-panel',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatAutocompleteModule,
    MatIconModule, MatButtonModule, MatListModule, MatDividerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!segment) {
      <div class="empty">
        <mat-icon>info</mat-icon>
        <p>Wähle ein Wandsegment aus, um Materialien zuzuweisen.</p>
      </div>
    } @else {
      <div class="panel">
        <h3>Segment {{ segment.id.slice(0, 6) }}</h3>
        <div class="meta">
          <div>Dicke: <b>{{ thicknessLabel() }}</b></div>
          <div>Wand-ID: <b>{{ segment.wallObjectId.slice(0, 6) }}</b></div>
        </div>

        <mat-divider />
        <h4>Materialaufbau (innen → außen)</h4>

        @if (layers().length === 0) {
          <p class="empty-inline">Noch keine Materialschichten.</p>
        } @else {
          <mat-list class="layers">
            @for (layer of layers(); track $index) {
              <mat-list-item>
                <div matListItemTitle class="layer-row">
                  <span class="layer-name">{{ layer.name }}</span>
                  <input type="number" min="1" step="1" class="thickness-input"
                         [value]="layer.thicknessMm"
                         (change)="updateThickness($index, $event)" />
                  <span class="mm">mm</span>
                  <button mat-icon-button (click)="moveUp($index)" [disabled]="$index === 0">
                    <mat-icon>arrow_upward</mat-icon>
                  </button>
                  <button mat-icon-button (click)="moveDown($index)"
                          [disabled]="$index === layers().length - 1">
                    <mat-icon>arrow_downward</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" (click)="removeLayer($index)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </mat-list-item>
            }
          </mat-list>
        }

        <div class="add-row">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Material suchen (ÖKOBAU.dat)</mat-label>
            <input matInput [formControl]="searchCtrl" [matAutocomplete]="auto"
                   placeholder="z.B. Ziegel, Mörtel, EPS …" />
            <mat-autocomplete #auto="matAutocomplete"
                              (optionSelected)="pickMaterial($event)"
                              [displayWith]="displayHit">
              @for (hit of hits(); track hit.uuid) {
                <mat-option [value]="hit">
                  <div class="option-name">{{ hit.name }}</div>
                  @if (hit.category) { <div class="option-cat">{{ hit.category }}</div> }
                </mat-option>
              }
            </mat-autocomplete>
          </mat-form-field>
        </div>

        <mat-divider />
        <div class="summary" [class.warn]="sumWarning()">
          Σ Materialien: <b>{{ totalThickness() }} mm</b>
          @if (wallThicknessMm(); as wtm) {
            <span class="target-sum">/ Wand: {{ wtm | number:'1.0-0' }} mm</span>
            @if (sumWarning()) {
              <span class="diff">⚠ {{ sumDiff() | number:'1.0-0' }} mm Differenz</span>
            }
          }
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; height: 100%; overflow: auto; padding: 16px; background: #fff; }
    .empty { display: flex; flex-direction: column; align-items: center; gap: 8px;
      color: #607d8b; padding: 40px 16px; text-align: center; }
    .empty mat-icon { font-size: 36px; width: 36px; height: 36px; }
    .empty-inline { color: #90a4ae; font-size: 13px; padding: 8px 0; }
    h3 { margin: 0 0 4px; } h4 { margin: 16px 0 8px; font-weight: 500; color: #455a64; }
    .meta { font-size: 13px; color: #455a64; display: flex; gap: 16px; margin-bottom: 12px; }
    .layers { padding: 0; }
    .layer-row { display: flex; align-items: center; gap: 8px; width: 100%; }
    .layer-name { flex: 1; font-size: 14px; }
    .thickness-input { width: 70px; padding: 4px 6px; border: 1px solid #cfd8dc; border-radius: 4px; font-size: 13px; }
    .mm { font-size: 12px; color: #607d8b; }
    .add-row { margin-top: 16px; } .search-field { width: 100%; }
    .option-name { font-size: 14px; } .option-cat { font-size: 11px; color: #90a4ae; }
    .summary { margin-top: 12px; font-size: 14px; color: #084b86;
      display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .summary.warn { color: #c15811; }
    .target-sum { color: #607d8b; }
    .diff { margin-left: 6px; }
  `],
})
export class MaterialPanelComponent implements OnChanges {
  @Input() segment: WallSegment | null = null;
  @Input() mmPerUnit: number | null = null;
  @Output() segmentChange = new EventEmitter<WallSegment>();

  private planSvc = inject(PlanService);
  searchCtrl = new FormControl('', { nonNullable: true });
  hits = signal<OekobaudatHit[]>([]);

  constructor() {
    this.searchCtrl.valueChanges.pipe(
      debounceTime(250), distinctUntilChanged(),
      switchMap((q) => {
        const t = typeof q === 'string' ? q : '';
        if (t.length < 2) { this.hits.set([]); return []; }
        return this.planSvc.searchMaterials(t);
      }),
    ).subscribe((res) => this.hits.set(res as OekobaudatHit[]));
  }

  ngOnChanges(_c: SimpleChanges) {
    this.searchCtrl.setValue('', { emitEvent: false });
    this.hits.set([]);
    if (this.segment && (this.segment.materials?.length ?? 0) === 0) {
      const wtm = this.wallThicknessMm();
      if (wtm && wtm > 0) {
        const seeded: WallSegment = {
          ...this.segment,
          materials: [{ name: '(unbestimmt)', thicknessMm: Math.round(wtm), order: 0 }],
        };
        queueMicrotask(() => this.segmentChange.emit(seeded));
      }
    }
  }

  displayHit = (h: OekobaudatHit | string | null): string =>
    h && typeof h === 'object' ? h.name : '';

  layers(): MaterialLayer[] { return this.segment?.materials ?? []; }

  wallThicknessMm(): number | null {
    if (!this.segment || !this.mmPerUnit) return null;
    return this.segment.measuredThickness * this.mmPerUnit;
  }

  thicknessLabel(): string {
    const mm = this.wallThicknessMm();
    if (mm !== null) return `${mm.toFixed(0)} mm`;
    if (this.segment) return `${this.segment.measuredThickness.toFixed(1)} u`;
    return '—';
  }

  totalThickness(): number {
    return this.layers().reduce((a, l) => a + (l.thicknessMm || 0), 0);
  }
  sumDiff(): number {
    const wtm = this.wallThicknessMm();
    return wtm !== null ? this.totalThickness() - wtm : 0;
  }
  sumWarning(): boolean {
    const wtm = this.wallThicknessMm();
    return wtm !== null && Math.abs(this.totalThickness() - wtm) >= 1;
  }

  pickMaterial(ev: MatAutocompleteSelectedEvent) {
    const hit: OekobaudatHit = ev.option.value;
    if (!this.segment) return;
    const existing = this.layers();
    let newThick = 50;
    let filtered = existing;
    const pi = existing.findIndex((l) => l.name === '(unbestimmt)');
    if (pi >= 0) { newThick = existing[pi].thicknessMm; filtered = existing.filter((_, i) => i !== pi); }
    const layer: MaterialLayer = { oekobaudatUuid: hit.uuid, name: hit.name, thicknessMm: newThick, order: filtered.length };
    this.emitLayers([...filtered, layer].map((l, i) => ({ ...l, order: i })));
    this.searchCtrl.setValue('', { emitEvent: false }); this.hits.set([]);
  }

  updateThickness(i: number, ev: Event) {
    const v = Number((ev.target as HTMLInputElement).value) || 0;
    this.emitLayers(this.layers().map((l, idx) => idx === i ? { ...l, thicknessMm: v } : l));
  }
  removeLayer(i: number) {
    this.emitLayers(this.layers().filter((_, idx) => idx !== i).map((l, idx) => ({ ...l, order: idx })));
  }
  moveUp(i: number) {
    if (i === 0) return;
    const a = [...this.layers()]; [a[i - 1], a[i]] = [a[i], a[i - 1]];
    this.emitLayers(a.map((l, idx) => ({ ...l, order: idx })));
  }
  moveDown(i: number) {
    const a = [...this.layers()]; if (i >= a.length - 1) return;
    [a[i + 1], a[i]] = [a[i], a[i + 1]];
    this.emitLayers(a.map((l, idx) => ({ ...l, order: idx })));
  }

  private emitLayers(next: MaterialLayer[]) {
    if (!this.segment) return;
    this.segmentChange.emit({ ...this.segment, materials: next });
  }
}
