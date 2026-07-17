import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MaterialPresetService } from '../../../services/material-presets.service';

@Component({
  selector: 'app-material-presets-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Material-Defaults</h2>
    <mat-dialog-content>
      <p class="sub">
        Standard-Schichtdicke je Material (mm) — wird gesetzt, wenn du im Aufbau nur
        den Namen eingibst. Änderungen gelten lokal (im Browser) und überschreiben die Vorgabe.
      </p>
      <div class="grid">
        @for (row of presets.rows(); track row.material) {
          <div class="row" [class.ov]="row.overridden">
            <span class="name">{{ row.material }}</span>
            <input type="number" min="0" step="1" [value]="row.value"
                   (change)="onChange(row.material, $event)" />
            <span class="mm">mm</span>
            <button mat-icon-button [disabled]="!row.overridden"
                    (click)="presets.resetOverride(row.material)"
                    matTooltip="Auf Vorgabe zurücksetzen ({{ presets.builtinFor(row.material) }} mm)">
              <mat-icon>undo</mat-icon>
            </button>
          </div>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="presets.resetAll()">Alle zurücksetzen</button>
      <button mat-flat-button color="primary" mat-dialog-close>Schließen</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .sub { color: #607d8b; font-size: 13px; margin: 0 0 14px; line-height: 1.5; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(240px, 1fr)); gap: 2px 24px; }
    .row { display: flex; align-items: center; gap: 8px; padding: 1px 0; }
    .row .name { flex: 1; font-size: 14px; color: #37474f; }
    .row.ov .name { font-weight: 600; color: #084b86; }
    .row input { width: 66px; padding: 4px 6px; border: 1px solid #cfd8dc;
      border-radius: 4px; font-size: 13px; text-align: right; }
    .row.ov input { border-color: #107bbc; }
    .row .mm { font-size: 12px; color: #607d8b; width: 22px; }
    @media (max-width: 620px) { .grid { grid-template-columns: 1fr; } }
  `],
})
export class MaterialPresetsDialogComponent {
  presets = inject(MaterialPresetService);

  onChange(material: string, ev: Event) {
    const v = Number((ev.target as HTMLInputElement).value);
    if (!Number.isFinite(v)) return;
    this.presets.setOverride(material, v);
  }
}
