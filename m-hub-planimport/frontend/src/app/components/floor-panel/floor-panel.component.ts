import {
  ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { FloorPolygon } from '../../models/plan.model';
import {
  LAYER_MATERIAL_OPTIONS, LayerMaterial, MhubLayer, SlabPartType, isConnection,
} from '../../models/mhub.model';
import { MaterialPresetService } from '../../services/material-presets.service';

@Component({
  selector: 'app-floor-panel',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatAutocompleteModule,
    MatCheckboxModule, MatIconModule, MatButtonModule, MatListModule, MatDividerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel">
      <div class="head">
        <span class="pin"><mat-icon>layers</mat-icon></span>
        <div class="head-txt">
          <div class="label">{{ polygon.name || 'Bodenaufbau' }}</div>
          <div class="type">Bauteil · {{ areaLabel() }}</div>
        </div>
      </div>

      <p class="net-hint">Fläche = grober Umriss − Wände darin. Grob zeichnen reicht.</p>

      <mat-form-field appearance="outline" class="full">
        <mat-label>Bauteiltyp</mat-label>
        <mat-select [value]="polygon.partType ?? 'Bodenaufbau'" (selectionChange)="set({ partType: $event.value })">
          @for (pt of partTypes; track pt) {
            <mat-option [value]="pt">{{ pt }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full">
        <mat-label>Name</mat-label>
        <input matInput [value]="polygon.name ?? ''" (input)="set({ name: str($event) })"
               placeholder="z.B. Bodenaufbau EG" />
      </mat-form-field>

      <div class="flags">
        <mat-checkbox [checked]="polygon.is_public ?? true" (change)="set({ is_public: $event.checked })">Öffentlich</mat-checkbox>
        <mat-checkbox [checked]="polygon.is_hazardous ?? false" (change)="set({ is_hazardous: $event.checked })">Gefahrenstoff</mat-checkbox>
      </div>

      <mat-divider />
      <h4>Schichtaufbau (oben → unten)</h4>

      @if (layers().length === 0) {
        <p class="empty-inline">Noch keine Schichten.</p>
      } @else {
        <mat-list class="layers">
          @for (layer of layers(); track $index) {
            <mat-list-item>
              <div matListItemTitle class="layer-row">
                <span class="layer-name">{{ layer.material }}</span>
                <input type="number" min="0" step="1" class="thickness-input"
                       [value]="layer.thickness" [disabled]="isConnection(layer.material)"
                       (change)="updateThickness($index, $event)" />
                <span class="mm">mm</span>
                <button mat-icon-button (click)="moveUp($index)" [disabled]="$index === 0">
                  <mat-icon>arrow_upward</mat-icon>
                </button>
                <button mat-icon-button (click)="moveDown($index)" [disabled]="$index === layers().length - 1">
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

      <mat-form-field appearance="outline" class="full">
        <mat-label>Material / Verbindung hinzufügen</mat-label>
        <input matInput [formControl]="searchCtrl" [matAutocomplete]="auto"
               placeholder="z.B. Estrich, Beton …" />
        <mat-autocomplete #auto="matAutocomplete" (optionSelected)="pickMaterial($event)">
          @for (opt of filteredOptions(); track opt) {
            <mat-option [value]="opt">{{ opt }}</mat-option>
          }
        </mat-autocomplete>
      </mat-form-field>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; overflow: auto; padding: 16px; background: #fff; }
    .head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
    .pin { width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center;
      justify-content: center; flex-shrink: 0; background: #107bbc; }
    .pin mat-icon { color: #fff; font-size: 20px; width: 20px; height: 20px; }
    .head-txt { flex: 1; min-width: 0; }
    .head-txt .label { font-weight: 600; font-size: 15px; }
    .head-txt .type { font-size: 12px; color: #607d8b; }
    .full { width: 100%; }
    .net-hint { font-size: 12px; color: #607d8b; margin: 0 0 12px; line-height: 1.4; }
    .flags { display: flex; gap: 16px; margin: 4px 0 8px; }
    h4 { margin: 8px 0; font-weight: 500; color: #455a64; }
    .empty-inline { color: #90a4ae; font-size: 13px; padding: 8px 0; }
    .layers { padding: 0; }
    .layer-row { display: flex; align-items: center; gap: 8px; width: 100%; }
    .layer-name { flex: 1; font-size: 14px; }
    .thickness-input { width: 70px; padding: 4px 6px; border: 1px solid #cfd8dc; border-radius: 4px; font-size: 13px; }
    .thickness-input:disabled { background: #eceff1; color: #90a4ae; }
    .mm { font-size: 12px; color: #607d8b; }
  `],
})
export class FloorPanelComponent {
  @Input() polygon!: FloorPolygon;
  @Input() areaM2: number | null = null;
  @Output() change = new EventEmitter<FloorPolygon>();
  @Output() remove = new EventEmitter<void>();

  private presets = inject(MaterialPresetService);
  searchCtrl = new FormControl('', { nonNullable: true });
  private filterText = signal('');
  partTypes = Object.values(SlabPartType);
  isConnection = isConnection;

  constructor() {
    this.searchCtrl.valueChanges.subscribe((v) => this.filterText.set(v ?? ''));
  }

  areaLabel(): string {
    return this.areaM2 != null ? `${this.areaM2.toFixed(2)} m² netto` : 'Fläche —';
  }

  layers(): MhubLayer[] { return this.polygon.layers ?? []; }

  filteredOptions(): LayerMaterial[] {
    const q = this.filterText().trim().toLowerCase();
    if (!q) return [];
    return LAYER_MATERIAL_OPTIONS.filter((o) => o.toLowerCase().includes(q));
  }

  pickMaterial(ev: MatAutocompleteSelectedEvent) {
    const material = ev.option.value as LayerMaterial;
    const thickness = isConnection(material) ? 0 : this.presets.defaultFor(material);
    this.emitLayers([...this.layers(), { layer_index: 0, material, thickness }]);
    this.searchCtrl.setValue('', { emitEvent: false });
    this.filterText.set('');
  }

  updateThickness(i: number, ev: Event) {
    const v = Math.max(0, Number((ev.target as HTMLInputElement).value) || 0);
    this.emitLayers(this.layers().map((l, idx) => idx === i ? { ...l, thickness: v } : l));
  }
  removeLayer(i: number) { this.emitLayers(this.layers().filter((_, idx) => idx !== i)); }
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

  str(ev: Event): string { return (ev.target as HTMLInputElement).value; }

  private emitLayers(next: MhubLayer[]) {
    this.set({ layers: next.map((l, i) => ({ ...l, layer_index: i + 1 })) });
  }
  set(patch: Partial<FloorPolygon>) { this.change.emit({ ...this.polygon, ...patch }); }
}
