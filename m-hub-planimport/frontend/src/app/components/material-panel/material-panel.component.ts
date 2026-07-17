import {
  ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges,
  Output, SimpleChanges, ViewChild, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { WallGroup } from '../../models/plan.model';
import {
  LAYER_MATERIAL_OPTIONS, LayerMaterial, MhubLayer, WallPartType,
  buildupThicknessMm, isConnection,
} from '../../models/mhub.model';
import { MaterialPresetService } from '../../services/material-presets.service';

@Component({
  selector: 'app-material-panel',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatAutocompleteModule,
    MatCheckboxModule, MatIconModule, MatButtonModule, MatMenuModule, MatTooltipModule,
    MatListModule, MatDividerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!group) {
      <div class="empty">
        <mat-icon>info</mat-icon>
        <p>Wähle eine Wand aus, um einen Schichtaufbau zuzuweisen.</p>
      </div>
    } @else {
      <div class="panel">
        <div class="meta">
          <div>Gemessen: <b>{{ measuredLabel() }}</b></div>
          <div>Länge: <b>{{ lengthLabel() }}</b></div>
          <div>{{ segmentCount }} Segment(e)</div>
        </div>

        <mat-form-field appearance="outline" class="full">
          <mat-label>Name</mat-label>
          <input matInput [value]="group.name" (input)="setName($event)"
                 placeholder="z.B. Außenwand Nord" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full">
          <mat-label>Bauteiltyp</mat-label>
          <mat-select [value]="group.partType" (selectionChange)="setPartType($event.value)">
            @for (pt of partTypes; track pt) {
              <mat-option [value]="pt">{{ pt }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <div class="flags">
          <mat-checkbox [checked]="group.is_public" (change)="setPublic($event.checked)">Öffentlich</mat-checkbox>
          <mat-checkbox [checked]="group.is_hazardous" (change)="setHazardous($event.checked)">Gefahrenstoff</mat-checkbox>
        </div>

        <mat-divider />
        <h4>Schichtaufbau (innen → außen)</h4>

        @if (group.layers.length === 0) {
          <p class="empty-inline">Noch keine Schichten.</p>
        } @else {
          <mat-list class="layers">
            @for (layer of group.layers; track $index) {
              <mat-list-item>
                <div matListItemTitle class="layer-row">
                  <span class="layer-name">{{ layer.material }}</span>
                  <input type="number" min="0" step="1" class="thickness-input"
                         [value]="layer.thickness"
                         [disabled]="isConnection(layer.material)"
                         (change)="updateThickness($index, $event)" />
                  <span class="mm">mm</span>
                  <button mat-icon-button (click)="moveUp($index)" [disabled]="$index === 0">
                    <mat-icon>arrow_upward</mat-icon>
                  </button>
                  <button mat-icon-button (click)="moveDown($index)"
                          [disabled]="$index === group.layers.length - 1">
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
          <mat-form-field appearance="outline" class="full">
            <mat-label>Schichtaufbau (innen → außen)</mat-label>
            <input matInput [formControl]="searchCtrl" [matAutocomplete]="auto"
                   (keydown.enter)="onEnter($event)"
                   placeholder="z.B. Putz 15 Ziegel _ Putz 15" />
            <mat-autocomplete #auto="matAutocomplete" (optionSelected)="pickMaterial($event)">
              @for (opt of filteredOptions(); track opt) {
                <mat-option [value]="opt">{{ opt }}</mat-option>
              }
            </mat-autocomplete>
            <button matSuffix mat-icon-button type="button" [matMenuTriggerFor]="dslHelp"
                    matTooltip="Syntax-Beispiele" aria-label="Hilfe zur Eingabe">
              <mat-icon>info</mat-icon>
            </button>
          </mat-form-field>
        </div>

        <mat-menu #dslHelp="matMenu">
          <div style="padding:10px 14px; min-width:250px; font-size:13px; color:#455a64; line-height:1.8;"
               (click)="$event.stopPropagation()">
            <div style="font-weight:600; margin-bottom:4px; color:#37474f;">Beispiele</div>
            <div><code>Putz</code> → Putz mit Default-Dicke</div>
            <div><code>Putz 40</code> → Putz mit 40&nbsp;mm Dicke</div>
            <div><code>Ziegel _</code> → Ziegel mit Restdicke</div>
            <div><code>Putz 40 Ziegel _ Putz</code> → Putz 40 · Ziegel Rest · Putz 50</div>
            <div style="margin-top:6px; font-size:12px; color:#78909c;">Enter setzt den Aufbau</div>
          </div>
        </mat-menu>

        <mat-divider />
        <div class="summary" [class.warn]="sumWarning()">
          Σ Aufbau: <b>{{ totalThickness() }} mm</b>
          @if (measuredThicknessMm; as wtm) {
            <span class="target-sum">/ gemessen: {{ wtm | number:'1.0-0' }} mm</span>
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
    h4 { margin: 8px 0; font-weight: 500; color: #455a64; }
    .meta { font-size: 13px; color: #455a64; display: flex; gap: 16px; margin-bottom: 12px; flex-wrap: wrap; }
    .full { width: 100%; }
    .flags { display: flex; gap: 16px; margin: 4px 0 8px; }
    .layers { padding: 0; }
    .layer-row { display: flex; align-items: center; gap: 8px; width: 100%; }
    .layer-name { flex: 1; font-size: 14px; }
    .thickness-input { width: 70px; padding: 4px 6px; border: 1px solid #cfd8dc; border-radius: 4px; font-size: 13px; }
    .thickness-input:disabled { background: #eceff1; color: #90a4ae; }
    .mm { font-size: 12px; color: #607d8b; }
    .add-row { margin-top: 8px; }
    .summary { margin-top: 12px; font-size: 14px; color: #084b86;
      display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .summary.warn { color: #c15811; }
    .target-sum { color: #607d8b; }
    .diff { margin-left: 6px; }
  `],
})
export class MaterialPanelComponent implements OnChanges {
  /** The buildup for the selected wall (may be an unsaved default). */
  @Input() group: WallGroup | null = null;
  /** Measured total thickness of the group's runs, in mm. */
  @Input() measuredThicknessMm: number | null = null;
  /** Σ run length of the group's members, in mm. */
  @Input() memberLengthMm: number | null = null;
  @Input() segmentCount = 0;
  @Output() groupChange = new EventEmitter<WallGroup>();

  @ViewChild(MatAutocompleteTrigger) private trigger?: MatAutocompleteTrigger;
  private presets = inject(MaterialPresetService);
  searchCtrl = new FormControl('', { nonNullable: true });
  private filterText = signal('');
  private justSelected = false;
  partTypes = Object.values(WallPartType);
  isConnection = isConnection;

  constructor() {
    this.searchCtrl.valueChanges.subscribe((v) => this.filterText.set(v ?? ''));
  }

  ngOnChanges(_c: SimpleChanges) {
    this.searchCtrl.setValue('', { emitEvent: false });
    this.filterText.set('');
  }

  filteredOptions(): LayerMaterial[] {
    // Suggest names for the token currently being typed (the last one).
    const tokens = this.filterText().split(/\s+/);
    const q = (tokens[tokens.length - 1] ?? '').trim().toLowerCase();
    if (!q || q === '_' || /^\d/.test(q)) return [];
    return LAYER_MATERIAL_OPTIONS.filter((o) => o.toLowerCase().includes(q));
  }

  measuredLabel(): string {
    return this.measuredThicknessMm !== null ? `${this.measuredThicknessMm.toFixed(0)} mm` : '—';
  }
  lengthLabel(): string {
    if (this.memberLengthMm === null) return '—';
    return `${(this.memberLengthMm / 1000).toFixed(2)} m`;
  }

  totalThickness(): number {
    return this.group ? buildupThicknessMm(this.group.layers) : 0;
  }
  sumDiff(): number {
    return this.measuredThicknessMm !== null ? this.totalThickness() - this.measuredThicknessMm : 0;
  }
  sumWarning(): boolean {
    return this.measuredThicknessMm !== null && Math.abs(this.sumDiff()) >= 5;
  }

  // --- mutations -----------------------------------------------------------

  setName(ev: Event) { this.emit({ name: (ev.target as HTMLInputElement).value }); }
  setPartType(pt: WallPartType) { this.emit({ partType: pt }); }
  setPublic(v: boolean) { this.emit({ is_public: v }); }
  setHazardous(v: boolean) { this.emit({ is_hazardous: v }); }

  /** Autocomplete select: complete the last token in the line (no commit). */
  pickMaterial(ev: MatAutocompleteSelectedEvent) {
    this.justSelected = true;
    queueMicrotask(() => (this.justSelected = false));
    const opt = ev.option.value as string;
    const val = this.searchCtrl.value ?? '';
    this.searchCtrl.setValue(val.replace(/\S*$/, opt) + ' '); // complete current token
  }

  /** Enter parses the whole DSL line and REPLACES the buildup. */
  onEnter(ev: Event) {
    // If an option is active, let (optionSelected) complete the token first.
    if (this.trigger?.activeOption || this.justSelected) return;
    ev.preventDefault();
    const layers = this.parseBuildup(this.searchCtrl.value ?? '');
    if (!layers) return; // unknown material / empty → leave the text to fix
    this.emit({ layers });
    this.clearSearch();
    this.trigger?.closePanel();
  }

  /**
   * Buildup DSL, innen → außen. Example: "Putz 15 Ziegel _ Putz 15".
   *   Name        → 50 mm default (connections → 0 mm)
   *   Name <mm>   → explicit thickness
   *   Name _      → equal share of the remaining thickness (measured − fixed)
   */
  private parseBuildup(raw: string): MhubLayer[] | null {
    const tokens = raw.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return null;

    const parsed: Array<{ material: LayerMaterial; t: number | 'rest' }> = [];
    let i = 0;
    while (i < tokens.length) {
      const material = this.resolveMaterial(tokens[i]);
      if (!material) return null; // unknown material token → abort, keep input
      i++;
      let t: number | 'rest' = this.presets.defaultFor(material); // material-specific default
      const next = tokens[i];
      if (next === '_') { t = 'rest'; i++; }
      else if (next != null && /^\d+(?:[.,]\d+)?$/.test(next)) {
        t = parseFloat(next.replace(',', '.')); i++;
      }
      if (isConnection(material)) t = 0; // connections carry no thickness
      parsed.push({ material, t });
    }

    const fixed = parsed.reduce((s, p) => s + (p.t === 'rest' ? 0 : p.t), 0);
    const restCount = parsed.filter((p) => p.t === 'rest').length;
    let restEach = 0;
    if (restCount > 0) {
      const rest = this.measuredThicknessMm != null
        ? Math.max(0, this.measuredThicknessMm - fixed)
        : 50 * restCount;
      restEach = Math.round(rest / restCount);
    }

    return parsed.map((p, idx) => ({
      layer_index: idx + 1,
      material: p.material,
      thickness: p.t === 'rest' ? restEach : Math.max(0, Math.round(p.t)),
    }));
  }

  private resolveMaterial(name: string): LayerMaterial | null {
    const q = name.trim().toLowerCase();
    if (!q) return null;
    const opts = LAYER_MATERIAL_OPTIONS;
    return (
      opts.find((o) => o.toLowerCase() === q) ??
      opts.find((o) => o.toLowerCase().startsWith(q)) ??
      opts.find((o) => o.toLowerCase().includes(q)) ??
      null
    );
  }

  private clearSearch() {
    this.searchCtrl.setValue('', { emitEvent: false });
    this.filterText.set('');
  }

  updateThickness(i: number, ev: Event) {
    const v = Math.max(0, Number((ev.target as HTMLInputElement).value) || 0);
    this.emitLayers(this.layers().map((l, idx) => idx === i ? { ...l, thickness: v } : l));
  }
  removeLayer(i: number) {
    this.emitLayers(this.layers().filter((_, idx) => idx !== i));
  }
  moveUp(i: number) {
    if (i === 0) return;
    const a = [...this.layers()]; [a[i - 1], a[i]] = [a[i], a[i - 1]];
    this.emitLayers(a);
  }
  moveDown(i: number) {
    const a = [...this.layers()]; if (i >= a.length - 1) return;
    [a[i + 1], a[i]] = [a[i], a[i + 1]];
    this.emitLayers(a);
  }

  private layers(): MhubLayer[] { return this.group?.layers ?? []; }

  private emitLayers(next: MhubLayer[]) {
    this.emit({ layers: next.map((l, i) => ({ ...l, layer_index: i + 1 })) });
  }
  private emit(patch: Partial<WallGroup>) {
    if (!this.group) return;
    this.groupChange.emit({ ...this.group, ...patch });
  }
}
