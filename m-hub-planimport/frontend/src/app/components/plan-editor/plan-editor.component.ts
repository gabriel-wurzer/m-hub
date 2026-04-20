import {
  ChangeDetectionStrategy, Component, computed, HostListener, inject, signal, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { PlanService } from '../../services/plan.service';
import { FloorPolygon, PlanDoc, WallSegment } from '../../models/plan.model';
import { PlanViewerComponent, ViewerTool } from '../plan-viewer/plan-viewer.component';
import { MaterialPanelComponent } from '../material-panel/material-panel.component';

const TOOL_LABELS: Record<ViewerTool, string> = {
  'pan': 'Verschieben (Strg+1)', 'select': 'Auswählen (Strg+2)',
  'exclude': 'Ausschließen (Strg+3)', 'polygon': 'Bodenpolygon (Strg+4)',
  'pipette': '',
};
const TOOL_HINTS: Record<ViewerTool, string> = {
  'pan': 'Klicken + ziehen. Oder Leertaste.',
  'select': 'Klick = auswählen. Shift+Klick = hinzufügen/entfernen. Ziehen = Rechteck. Entf = ausschließen.',
  'exclude': 'Klick/Ziehen = Wände ausschließen. Entf = ausschließen.',
  'polygon': 'Eckpunkte klicken. Enter = schließen, Esc = abbrechen.',
  'pipette': '',
};

interface UndoEntry {
  type: 'exclude' | 'merge';
  /** Snapshot of affected segments before the action. */
  before: WallSegment[];
}

@Component({
  selector: 'app-plan-editor',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatToolbarModule, MatButtonToggleModule, MatButtonModule, MatIconModule,
    MatSnackBarModule, MatDialogModule, MatTooltipModule, MatMenuModule, MatDividerModule,
    PlanViewerComponent, MaterialPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="editor">
      <mat-toolbar class="tool-bar">
        <button mat-icon-button (click)="back()" matTooltip="Zurück">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <span class="filename">{{ plan()?.originalFilename ?? '…' }}</span>

        <!-- Tools -->
        <mat-button-toggle-group [value]="tool()" (change)="setTool($event.value)" class="tools">
          <mat-button-toggle value="pan" matTooltip="Verschieben (Strg+1)"><mat-icon>pan_tool</mat-icon></mat-button-toggle>
          <mat-button-toggle value="select" matTooltip="Auswählen (Strg+2)"><mat-icon>ads_click</mat-icon></mat-button-toggle>
          <mat-button-toggle value="exclude" matTooltip="Ausschließen (Strg+3)"><mat-icon>block</mat-icon></mat-button-toggle>
          <mat-button-toggle value="polygon" matTooltip="Bodenpolygon (Strg+4)"><mat-icon>crop_square</mat-icon></mat-button-toggle>
        </mat-button-toggle-group>

        <!-- Divider between tools and actions -->
        <span class="divider"></span>

        <!-- Actions group -->
        <div class="actions-group">
          <button mat-icon-button (click)="undo()" [disabled]="undoStack.length === 0"
                  matTooltip="Rückgängig (Strg+Z)">
            <mat-icon>undo</mat-icon>
          </button>
          <button mat-icon-button (click)="redo()" [disabled]="redoStack.length === 0"
                  matTooltip="Wiederherstellen (Strg+Y)">
            <mat-icon>redo</mat-icon>
          </button>

          @if (selection().length > 0) {
            <button mat-icon-button color="warn" (click)="excludeSelected()"
                    matTooltip="Ausschließen (Entf)">
              <mat-icon>delete</mat-icon>
            </button>
          }
          @if (selection().length > 1) {
            <button mat-icon-button color="primary" (click)="mergeSelected()"
                    matTooltip="Zusammenführen (Strg+M)">
              <mat-icon>merge_type</mat-icon>
            </button>
          }
        </div>

        @if (selection().length > 0) {
          <span class="sel-badge">{{ selection().length }} ausgewählt</span>
        }

        <span class="divider"></span>

        <!-- Zoom dropdown -->
        <button mat-stroked-button [matMenuTriggerFor]="zoomMenu" class="zoom-btn">
          <mat-icon>zoom_in</mat-icon>
          {{ viewer?.zoomPercent() ?? 100 }}%
        </button>
        <mat-menu #zoomMenu="matMenu">
          <button mat-menu-item (click)="viewer.zoomTo(25)">25%</button>
          <button mat-menu-item (click)="viewer.zoomTo(50)">50%</button>
          <button mat-menu-item (click)="viewer.zoomTo(75)">75%</button>
          <button mat-menu-item (click)="viewer.zoomTo(100)">100%</button>
          <button mat-menu-item (click)="viewer.zoomTo(200)">200%</button>
          <button mat-menu-item (click)="viewer.zoomTo(400)">400%</button>
          <mat-divider />
          <button mat-menu-item (click)="viewer.zoomToWidth()">Gesamte Breite</button>
          <button mat-menu-item (click)="viewer.zoomToHeight()">Gesamte Höhe</button>
        </mat-menu>

        <span class="spacer"></span>

        <span class="stats">
          {{ activeCount() }} Segmente · {{ objectCount() }} Wände
          @if (excludedCount() > 0) { · {{ excludedCount() }} ausgeschl. }
        </span>

        <button mat-raised-button color="primary" (click)="save()" [disabled]="!dirty()">
          <mat-icon>save</mat-icon> Speichern
        </button>
      </mat-toolbar>

      <div class="hint-bar">{{ toolHint() }}</div>

      <div class="split">
        <app-plan-viewer #viewer
          [plan]="plan()" [tool]="tool()" [selection]="selection()"
          (clickSegment)="onClickSegment($event)"
          (rectSelect)="onRectSelect($event)"
          (polygonCreated)="onPolygonCreated($event)"
          (emptyClick)="onEmptyClick($event)" />

        <aside class="side">
          <app-material-panel
            [segment]="selectedSegment()"
            [mmPerUnit]="plan()?.calibration?.mmPerUnit ?? null"
            (segmentChange)="onSegmentUpdate($event)" />
        </aside>
      </div>
    </div>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-height: 0; width: 100%; }
    .editor { display: flex; flex-direction: column; flex: 1; min-height: 0; width: 100%; }
    .tool-bar {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      background: #fff; border-bottom: 1px solid #eceff1; padding: 0 12px; min-height: 56px;
    }
    .filename { font-weight: 500; margin-right: 8px; max-width: 200px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tools { margin-left: 4px; }
    /* Active tool toggle: blue background + white icon */
    .tools .mat-button-toggle-checked {
      background: #107bbc !important;
      color: #fff !important;
    }
    .tools .mat-button-toggle-checked .mat-icon {
      color: #fff !important;
    }
    .divider {
      width: 1px; height: 28px; background: #cfd8dc; margin: 0 4px;
    }
    .actions-group {
      display: flex; align-items: center; gap: 2px;
      padding: 2px 4px; background: #f4f8fb; border-radius: 6px;
    }
    .sel-badge { font-size: 12px; font-weight: 500; color: #084b86;
      padding: 3px 10px; background: #e0f3fb; border-radius: 12px; }
    .zoom-btn { font-size: 13px; min-width: 80px; }
    .spacer { flex: 1; }
    .stats { font-size: 12px; color: #607d8b; margin: 0 8px; }
    .hint-bar { background: #f4f8fb; color: #455a64; font-size: 12px;
      padding: 4px 16px; border-bottom: 1px solid #eceff1; min-height: 22px; }
    .split { display: flex; flex: 1; min-height: 0; }
    .side { width: 380px; border-left: 1px solid #eceff1; background: #fff;
      overflow: hidden; display: flex; flex-direction: column; }
    @media (max-width: 1100px) { .side { width: 320px; } }
  `],
})
export class PlanEditorComponent {
  @ViewChild('viewer') viewer!: PlanViewerComponent;
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private planSvc = inject(PlanService);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  plan = signal<PlanDoc | null>(null);
  tool = signal<ViewerTool>('select');
  selection = signal<string[]>([]);
  dirty = signal(false);

  undoStack: UndoEntry[] = [];
  redoStack: UndoEntry[] = [];

  toolLabel = computed(() => TOOL_LABELS[this.tool()]);
  toolHint = computed(() => {
    const n = this.selection().length;
    const base = TOOL_HINTS[this.tool()];
    return n > 1 ? `${base} — ${n} Segmente ausgewählt.` : base;
  });

  activeCount = computed(() => (this.plan()?.wallSegments ?? []).filter((s) => !s.excluded).length);
  excludedCount = computed(() => (this.plan()?.wallSegments ?? []).filter((s) => s.excluded).length);
  objectCount = computed(() => {
    const segs = (this.plan()?.wallSegments ?? []).filter((s) => !s.excluded);
    return new Set(segs.map((s) => s.wallObjectId)).size;
  });

  selectedSegment = computed<WallSegment | null>(() => {
    const p = this.plan();
    const sel = this.selection();
    if (!p || sel.length === 0) return null;
    return p.wallSegments.find((s) => s.id === sel[sel.length - 1]) ?? null;
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.planSvc.get(id).subscribe({
        next: (p) => this.plan.set(p),
        error: () => this.snack.open('Plan nicht gefunden', 'OK', { duration: 3000 }),
      });
    }
  }

  // --- Keyboard shortcuts --------------------------------------------------

  @HostListener('window:keydown', ['$event'])
  onKeyDown(ev: KeyboardEvent) {
    const ctrl = ev.ctrlKey || ev.metaKey;

    // Tool shortcuts: Ctrl+1..4
    if (ctrl && ev.key === '1') { ev.preventDefault(); this.tool.set('pan'); return; }
    if (ctrl && ev.key === '2') { ev.preventDefault(); this.tool.set('select'); return; }
    if (ctrl && ev.key === '3') { ev.preventDefault(); this.tool.set('exclude'); return; }
    if (ctrl && ev.key === '4') { ev.preventDefault(); this.tool.set('polygon'); return; }

    // Undo: Ctrl+Z
    if (ctrl && ev.key === 'z' && !ev.shiftKey) { ev.preventDefault(); this.undo(); return; }
    // Redo: Ctrl+Y or Ctrl+Shift+Z
    if (ctrl && ev.key === 'y') { ev.preventDefault(); this.redo(); return; }
    if (ctrl && ev.key === 'z' && ev.shiftKey) { ev.preventDefault(); this.redo(); return; }

    // Merge: Ctrl+M
    if (ctrl && ev.key === 'm') { ev.preventDefault(); this.mergeSelected(); return; }

    // Delete/Backspace: exclude selected
    if (ev.key === 'Delete' || ev.key === 'Backspace') {
      if (this.selection().length > 0) {
        ev.preventDefault();
        this.excludeSelected();
      }
      return;
    }

    // Ctrl+S: save
    if (ctrl && ev.key === 's') { ev.preventDefault(); this.save(); return; }

    // Ctrl+A: select all (non-excluded)
    if (ctrl && ev.key === 'a') {
      ev.preventDefault();
      const all = (this.plan()?.wallSegments ?? []).filter((s) => !s.excluded).map((s) => s.id);
      this.selection.set(all);
      return;
    }
  }

  back() { this.router.navigate(['/plans']); }

  setTool(t: ViewerTool) {
    this.tool.set(t);
    if (t === 'exclude' && this.selection().length > 0) {
      this.excludeSelected();
      this.tool.set('select');
    }
  }

  // --- Selection -----------------------------------------------------------

  onClickSegment(ev: { seg: WallSegment; shift: boolean }) {
    if (this.tool() === 'exclude') {
      // Exclude the whole wall group, not just the clicked segment.
      const groupIds = this.getGroupIds(ev.seg.wallObjectId);
      this.excludeSegments(groupIds);
      return;
    }
    // Select all segments in the same wall group.
    const groupIds = this.getGroupIds(ev.seg.wallObjectId);
    this.selection.update((prev) => {
      if (ev.shift) {
        // Toggle: if any of the group is already selected, remove all; otherwise add all.
        const anySelected = groupIds.some((id) => prev.includes(id));
        if (anySelected) {
          const groupSet = new Set(groupIds);
          return prev.filter((id) => !groupSet.has(id));
        }
        return [...new Set([...prev, ...groupIds])];
      }
      return groupIds;
    });
    const mmPerUnit = this.plan()?.calibration?.mmPerUnit;
    const info = mmPerUnit ? ` (${(ev.seg.measuredThickness * mmPerUnit).toFixed(0)} mm)` : '';
    const label = groupIds.length > 1 ? `Wand (${groupIds.length} Segmente)` : 'Segment';
    this.snack.open(`${label} ausgewählt${info}`, undefined, { duration: 1200 });
  }

  /** Get all segment ids sharing the same wallObjectId. */
  private getGroupIds(wallObjectId: string): string[] {
    return (this.plan()?.wallSegments ?? [])
      .filter((s) => s.wallObjectId === wallObjectId && !s.excluded)
      .map((s) => s.id);
  }

  onRectSelect(ev: { segIds: string[]; shift: boolean }) {
    if (ev.shift) {
      this.selection.update((prev) => [...new Set([...prev, ...ev.segIds])]);
    } else {
      this.selection.set(ev.segIds);
    }
    this.snack.open(`${this.selection().length} Segmente ausgewählt`, undefined, { duration: 1200 });
    if (this.tool() === 'exclude') this.excludeSelected();
  }

  onEmptyClick(ev: { tool: ViewerTool; shift: boolean }) {
    if (!ev.shift) this.selection.set([]);
  }

  // --- Undo / Redo ---------------------------------------------------------

  private pushUndo(entry: UndoEntry) {
    this.undoStack.push(entry);
    this.redoStack.length = 0; // clear redo on new action
  }

  undo() {
    const entry = this.undoStack.pop();
    if (!entry) return;
    const p = this.plan();
    if (!p) return;

    // Save current state of affected segments for redo.
    const affectedIds = new Set(entry.before.map((s) => s.id));
    const currentState = p.wallSegments.filter((s) => affectedIds.has(s.id)).map((s) => ({ ...s }));
    this.redoStack.push({ type: entry.type, before: currentState });

    // Restore previous state.
    const beforeMap = new Map(entry.before.map((s) => [s.id, s]));
    this.plan.update((plan) => {
      if (!plan) return plan;
      return {
        ...plan,
        wallSegments: plan.wallSegments.map((s) => beforeMap.get(s.id) ?? s),
      };
    });
    this.dirty.set(true);
    this.snack.open('Rückgängig', undefined, { duration: 1200 });
  }

  redo() {
    const entry = this.redoStack.pop();
    if (!entry) return;
    const p = this.plan();
    if (!p) return;

    const affectedIds = new Set(entry.before.map((s) => s.id));
    const currentState = p.wallSegments.filter((s) => affectedIds.has(s.id)).map((s) => ({ ...s }));
    this.undoStack.push({ type: entry.type, before: currentState });

    const beforeMap = new Map(entry.before.map((s) => [s.id, s]));
    this.plan.update((plan) => {
      if (!plan) return plan;
      return {
        ...plan,
        wallSegments: plan.wallSegments.map((s) => beforeMap.get(s.id) ?? s),
      };
    });
    this.dirty.set(true);
    this.snack.open('Wiederherstellt', undefined, { duration: 1200 });
  }

  // --- Merge ---------------------------------------------------------------

  mergeSelected() {
    const sel = this.selection();
    if (sel.length < 2) return;
    const p = this.plan();
    if (!p) return;

    const targetSeg = p.wallSegments.find((s) => s.id === sel[0]);
    if (!targetSeg) return;
    const targetObjectId = targetSeg.wallObjectId;

    // Snapshot before for undo.
    const affected = p.wallSegments.filter((s) => sel.includes(s.id));
    this.pushUndo({ type: 'merge', before: affected.map((s) => ({ ...s })) });

    this.plan.update((plan) => {
      if (!plan) return plan;
      return {
        ...plan,
        wallSegments: plan.wallSegments.map((s) =>
          sel.includes(s.id) ? { ...s, wallObjectId: targetObjectId } : s,
        ),
      };
    });
    this.dirty.set(true);
    this.snack.open(`${sel.length} Segmente zusammengeführt`, undefined, { duration: 2000 });
  }

  // --- Exclude -------------------------------------------------------------

  excludeSelected() {
    const ids = this.selection();
    if (ids.length === 0) return;
    this.excludeSegments(ids);
    this.selection.set([]);
  }

  private excludeSegments(ids: string[]) {
    const p = this.plan();
    if (!p) return;
    const idSet = new Set(ids);

    // Snapshot for undo.
    const affected = p.wallSegments.filter((s) => idSet.has(s.id));
    this.pushUndo({ type: 'exclude', before: affected.map((s) => ({ ...s })) });

    this.plan.update((plan) => {
      if (!plan) return plan;
      return {
        ...plan,
        wallSegments: plan.wallSegments.map((s) =>
          idSet.has(s.id) ? { ...s, excluded: true } : s,
        ),
      };
    });
    this.dirty.set(true);
    this.viewer?.triggerFlash(ids);
    this.snack.open(`${ids.length} Segment(e) ausgeschlossen`, undefined, { duration: 2000 });
  }

  // --- Material panel ------------------------------------------------------

  onSegmentUpdate(seg: WallSegment) {
    this.plan.update((p) => {
      if (!p) return p;
      return { ...p, wallSegments: p.wallSegments.map((s) => s.id === seg.id ? seg : s) };
    });
    this.dirty.set(true);
  }

  // --- Polygon -------------------------------------------------------------

  onPolygonCreated(poly: FloorPolygon) {
    this.plan.update((p) => (p ? { ...p, polygons: [...p.polygons, poly] } : p));
    this.dirty.set(true);
    this.snack.open('Bodenpolygon erstellt', undefined, { duration: 1500 });
  }

  // --- Save ----------------------------------------------------------------

  save() {
    const p = this.plan();
    if (!p) return;
    this.planSvc.save(p).subscribe({
      next: (saved) => {
        this.plan.set(saved);
        this.dirty.set(false);
        this.snack.open('Gespeichert', 'OK', { duration: 2000 });
      },
      error: () => this.snack.open('Speichern fehlgeschlagen', 'OK', { duration: 3000 }),
    });
  }
}
