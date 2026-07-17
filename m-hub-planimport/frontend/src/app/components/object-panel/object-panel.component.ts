import {
  ChangeDetectionStrategy, Component, EventEmitter, Input, Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { Placemark } from '../../models/plan.model';
import { FIXTURE_CATALOG, fixtureByKey, objectTypeColor } from '../../models/mhub.model';

@Component({
  selector: 'app-object-panel',
  standalone: true,
  imports: [
    CommonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule,
    MatIconModule, MatButtonModule, MatDividerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel">
      <div class="head">
        <span class="pin" [style.background]="color()"><mat-icon>{{ icon() }}</mat-icon></span>
        <div class="head-txt">
          <div class="label">{{ placemark.name || fixtureLabel() }}</div>
          <div class="type">Objekt · {{ placemark.objectType }}</div>
        </div>
      </div>

      <mat-form-field appearance="outline" class="full">
        <mat-label>Typ</mat-label>
        <mat-select [value]="placemark.fixtureKey" (selectionChange)="changeFixture($event.value)">
          @for (f of fixtures; track f.key) {
            <mat-option [value]="f.key"><mat-icon class="opt-ic">{{ f.icon }}</mat-icon> {{ f.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full">
        <mat-label>Name</mat-label>
        <input matInput [value]="placemark.name" (input)="set({ name: str($event) })"
               placeholder="z.B. WC, Eingangstür …" />
      </mat-form-field>

      <div class="row">
        <label>Anzahl</label>
        <input type="number" min="1" step="1" class="num" [value]="placemark.count"
               (change)="set({ count: int($event, 1) })" />
      </div>

      <mat-divider />
      <h4>Maße (cm, optional)</h4>
      <div class="dims">
        <div class="dim">
          <label>Länge</label>
          <input type="number" min="0" step="1" class="num" [value]="placemark.length ?? null"
                 (change)="set({ length: intOrNull($event) })" />
        </div>
        <div class="dim">
          <label>Breite</label>
          <input type="number" min="0" step="1" class="num" [value]="placemark.width ?? null"
                 (change)="set({ width: intOrNull($event) })" />
        </div>
        <div class="dim">
          <label>Höhe</label>
          <input type="number" min="0" step="1" class="num" [value]="placemark.height ?? null"
                 (change)="set({ height: intOrNull($event) })" />
        </div>
      </div>

      <mat-divider />
      <div class="flags">
        <mat-checkbox [checked]="placemark.is_public" (change)="set({ is_public: $event.checked })">Öffentlich</mat-checkbox>
        <mat-checkbox [checked]="placemark.is_hazardous" (change)="set({ is_hazardous: $event.checked })">Gefahrenstoff</mat-checkbox>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; overflow: auto; padding: 16px; background: #fff; }
    .head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
    .pin { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center;
      justify-content: center; flex-shrink: 0; box-shadow: 0 0 0 2px #fff, 0 1px 3px rgba(0,0,0,0.3); }
    .pin mat-icon { color: #fff; font-size: 20px; width: 20px; height: 20px; }
    .head-txt { flex: 1; min-width: 0; }
    .head-txt .label { font-weight: 600; font-size: 15px; }
    .head-txt .type { font-size: 12px; color: #607d8b; }
    .full { width: 100%; }
    .opt-ic { font-size: 18px; width: 18px; height: 18px; vertical-align: middle; margin-right: 6px; }
    h4 { margin: 12px 0 8px; font-weight: 500; color: #455a64; }
    .row { display: flex; align-items: center; gap: 10px; margin: 4px 0; }
    .row label { font-size: 14px; color: #455a64; }
    .dims { display: flex; gap: 10px; }
    .dim { display: flex; flex-direction: column; gap: 4px; flex: 1; }
    .dim label { font-size: 12px; color: #607d8b; }
    .num { width: 100%; padding: 6px 8px; border: 1px solid #cfd8dc; border-radius: 4px; font-size: 13px; }
    .row .num { width: 80px; }
    .flags { display: flex; gap: 16px; margin-top: 8px; }
  `],
})
export class ObjectPanelComponent {
  @Input() placemark!: Placemark;
  @Output() change = new EventEmitter<Placemark>();
  @Output() remove = new EventEmitter<void>();

  fixtures = FIXTURE_CATALOG;

  /** Switch the fixture/type; carry the default name unless the user set a custom one. */
  changeFixture(key: string) {
    const f = fixtureByKey(key);
    if (!f) return;
    const oldF = fixtureByKey(this.placemark.fixtureKey);
    const custom = !!this.placemark.name && this.placemark.name !== (oldF?.name ?? '');
    this.set({ fixtureKey: f.key, objectType: f.objectType, name: custom ? this.placemark.name : f.name });
  }

  fixtureLabel(): string { return fixtureByKey(this.placemark.fixtureKey)?.label ?? this.placemark.objectType; }
  icon(): string { return fixtureByKey(this.placemark.fixtureKey)?.icon ?? 'place'; }
  color(): string { return objectTypeColor(this.placemark.objectType); }

  str(ev: Event): string { return (ev.target as HTMLInputElement).value; }
  int(ev: Event, min: number): number {
    return Math.max(min, Math.round(Number((ev.target as HTMLInputElement).value) || min));
  }
  intOrNull(ev: Event): number | null {
    const v = (ev.target as HTMLInputElement).value.trim();
    if (v === '') return null;
    return Math.max(0, Math.round(Number(v) || 0));
  }

  set(patch: Partial<Placemark>) { this.change.emit({ ...this.placemark, ...patch }); }
}
