import {
  ChangeDetectionStrategy, Component, computed, effect, HostListener, inject, OnDestroy, signal, ViewChild,
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
import { MatSliderModule } from '@angular/material/slider';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { PlanService } from '../../services/plan.service';
import { EditorStatsService } from '../../services/editor-stats.service';
import { FloorPolygon, PlanDoc, Placemark, WallSegment, WallGroup } from '../../models/plan.model';
import {
  WallPartType, WallBuildup, SlabBuildup, SlabPartType, MhubContext, toBauteilPayloads,
  FIXTURE_CATALOG, fixtureByKey, ObjektAggregate, objektToPayload, CreateObjektPayload,
  CreateBauteilPayload, ImportPacket, extractIdFor,
} from '../../models/mhub.model';
import { PlanViewerComponent, ViewerTool } from '../plan-viewer/plan-viewer.component';
import { MaterialPanelComponent } from '../material-panel/material-panel.component';
import { ObjectPanelComponent } from '../object-panel/object-panel.component';
import { FloorPanelComponent } from '../floor-panel/floor-panel.component';
import { IntegrationContextService } from '../../services/integration-context.service';
import { HandoffDialogComponent } from '../dialogs/handoff-dialog/handoff-dialog.component';

/** True when a keyboard event originates from a text-entry field. */
function isEditableTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/** Shoelace area of a closed polygon (PDF units²). */
function polygonArea(points: Array<{ x: number; y: number }>): number {
  let a = 0;
  for (let i = 0, n = points.length; i < n; i++) {
    const p = points[i], q = points[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

/** Run length of a wall segment ≈ its footprint area / measured thickness. */
function runLengthUnits(seg: WallSegment): number {
  if (seg.measuredThickness <= 0) return 0;
  return polygonArea(seg.polygon) / seg.measuredThickness;
}

/** Shoelace area of a closed [x,y] polygon (plan units²). */
function polyAreaTuples(pts: Array<[number, number]>): number {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const [px, py] = pts[i], [qx, qy] = pts[(i + 1) % n];
    a += px * qy - qx * py;
  }
  return Math.abs(a) / 2;
}

function centroidXY(pts: Array<{ x: number; y: number }>): { x: number; y: number } {
  let sx = 0, sy = 0;
  for (const p of pts) { sx += p.x; sy += p.y; }
  const n = pts.length || 1;
  return { x: sx / n, y: sy / n };
}

/** Ray-cast point-in-polygon against a closed [x,y] outline. */
function pointInPolyTuples(pt: { x: number; y: number }, poly: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > pt.y) !== (yj > pt.y)) && (pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

const TOOL_LABELS: Record<ViewerTool, string> = {
  'pan': 'Verschieben (Strg+1)', 'select': 'Auswählen (Strg+2)',
  'polygon': 'Bodenpolygon (Strg+3)',
  'pipette': '', 'region': '', 'object': '', 'floodfill': '',
};
const TOOL_HINTS: Record<ViewerTool, string> = {
  'pan': 'Klicken + ziehen. Oder Leertaste.',
  'select': 'Klick = auswählen. Shift+Klick = hinzufügen/entfernen. Ziehen = Rechteck. Entf = ausschließen.',
  'polygon': 'Grober Umriss ums Geschoss — die Wände darin werden abgezogen. Ziehen = Rechteck, Klicken = Eckpunkte. Enter = schließen, Esc = abbrechen.',
  'pipette': '', 'region': '',
  'object': 'Fixture unten wählen, dann auf den Plan klicken. Placemark anklicken = bearbeiten.',
  'floodfill': 'Klick in einen Raum = füllen. Über einen Fehler ziehen = wegnehmen (füllt neu).',
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
    MatSliderModule,
    PlanViewerComponent, MaterialPanelComponent, ObjectPanelComponent, FloorPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="editor">
      <mat-toolbar class="tool-bar">
        <button mat-icon-button (click)="back()" matTooltip="Zurück">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <span class="filename">{{ plan()?.originalFilename ?? '…' }}</span>

        <!-- History group -->
        <div class="actions-group">
          <button mat-icon-button (click)="undo()" [disabled]="undoStack.length === 0"
                  matTooltip="Rückgängig (Strg+Z)">
            <mat-icon>undo</mat-icon>
          </button>
          <button mat-icon-button (click)="redo()" [disabled]="redoStack.length === 0"
                  matTooltip="Wiederherstellen (Strg+Y)">
            <mat-icon>redo</mat-icon>
          </button>
        </div>

        <span class="divider"></span>

        <!-- Tools -->
        <mat-button-toggle-group [value]="tool()" (change)="setTool($event.value)" class="tools">
          <mat-button-toggle value="pan" matTooltip="Verschieben (Strg+1)"><mat-icon>pan_tool</mat-icon></mat-button-toggle>
          <mat-button-toggle value="select" matTooltip="Auswählen (Strg+2)"><mat-icon>ads_click</mat-icon></mat-button-toggle>
          <mat-button-toggle value="polygon" matTooltip="Bodenpolygon (Strg+3)"><mat-icon>crop_square</mat-icon></mat-button-toggle>
          <mat-button-toggle value="object" matTooltip="Objekt setzen (Strg+4)"><mat-icon>add_location_alt</mat-icon></mat-button-toggle>
          <mat-button-toggle value="floodfill" matTooltip="Boden füllen (Strg+5)"><mat-icon>format_color_fill</mat-icon></mat-button-toggle>
        </mat-button-toggle-group>

        <!-- Selection actions — next to the tools, for whatever is selected. -->
        @if (selection().length > 0) {
          <span class="divider"></span>
          <div class="actions-group">
            <button mat-icon-button color="warn" (click)="excludeSelected()"
                    matTooltip="Ausschließen (Entf)">
              <mat-icon>delete</mat-icon>
            </button>
            @if (selection().length > 1) {
              <button mat-icon-button color="primary" (click)="mergeSelected()"
                      matTooltip="Zusammenführen (Strg+M)">
                <mat-icon>merge_type</mat-icon>
              </button>
            }
          </div>
          <span class="sel-badge">{{ selection().length }} ausgewählt</span>
        } @else if (selectedPlacemark()) {
          <span class="divider"></span>
          <div class="actions-group">
            <button mat-icon-button color="warn" (click)="deletePlacemark(selectedPlacemarkId()!)"
                    matTooltip="Objekt löschen (Entf)">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
          <span class="sel-badge">Objekt</span>
        } @else if (selectedPolygon()) {
          <span class="divider"></span>
          <div class="actions-group">
            <button mat-icon-button color="warn" (click)="deletePolygon(selectedPolygonId()!)"
                    matTooltip="Boden löschen (Entf)">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
          <span class="sel-badge">Boden</span>
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

        <button mat-stroked-button (click)="toggleDespeckle()"
                [class.despeckle-on]="despeckleActive()"
                matTooltip="Kleine Falsch-Erkennungen (Fliegendreck) entfernen">
          <mat-icon>filter_alt</mat-icon> Despeckle
        </button>

        <button mat-stroked-button (click)="openReport()" matTooltip="Mengenauszug / Report">
          <mat-icon>summarize</mat-icon> Report
        </button>

        <button mat-flat-button color="primary" (click)="handoff()"
                [disabled]="assignedGroupCount() === 0 && placemarkCount() === 0 && floorBuildupCount() === 0"
                matTooltip="Bauteile + Objekte an m-hub übergeben">
          <mat-icon>upload</mat-icon> Übergeben
        </button>

        <button mat-stroked-button (click)="exportData()"
                [disabled]="assignedGroupCount() === 0 && placemarkCount() === 0 && floorBuildupCount() === 0"
                matTooltip="Bauteile + Objekte als m-hub-JSON exportieren">
          <mat-icon>output</mat-icon> Export
        </button>

        <span class="save-status">
          @if (saving()) {
            <mat-icon>sync</mat-icon> Speichert…
          } @else if (saved()) {
            <mat-icon>cloud_done</mat-icon> Gespeichert
          }
        </span>
      </mat-toolbar>

      @if (despeckleActive()) {
        <div class="despeckle-bar">
          <mat-icon>filter_alt</mat-icon>
          <span>Kleine Segmente unter</span>
          <mat-slider min="0" max="50" step="1" discrete class="despeckle-slider">
            <input matSliderThumb [value]="despeckleThresholdCm2()"
                   (valueChange)="despeckleThresholdCm2.set($event)" />
          </mat-slider>
          <span class="thr">{{ despeckleThresholdCm2() }} cm²</span>
          <span class="count">{{ despeckleCandidates().length }} markiert (rot)</span>
          <span class="spacer"></span>
          <button mat-flat-button color="warn" (click)="applyDespeckle()"
                  [disabled]="despeckleCandidates().length === 0">
            <mat-icon>delete_sweep</mat-icon> Anwenden
          </button>
          <button mat-button (click)="closeDespeckle()">Fertig</button>
        </div>
      } @else if (tool() === 'object') {
        <div class="fixture-bar">
          @for (f of fixtures; track f.key) {
            <button mat-stroked-button class="fx" [class.armed]="armedFixtureKey() === f.key"
                    (click)="armedFixtureKey.set(f.key)" [matTooltip]="f.label">
              <mat-icon>{{ f.icon }}</mat-icon> {{ f.label }}
            </button>
          }
        </div>
      } @else {
        <div class="hint-bar">{{ toolHint() }}</div>
      }

      <div class="split">
        <app-plan-viewer #viewer
          [plan]="plan()" [tool]="tool()" [selection]="selection()"
          [flaggedIds]="despeckleActive() ? despeckleCandidates() : []"
          [selectedPlacemarkId]="selectedPlacemarkId()"
          [selectedPolygonId]="selectedPolygonId()"
          (clickSegment)="onClickSegment($event)"
          (rectSelect)="onRectSelect($event)"
          (polygonCreated)="onPolygonCreated($event)"
          (placeObject)="onPlaceObject($event)"
          (floodFillAt)="onFloodFill($event)"
          (floodBlock)="onFloodBlock($event)"
          (clickPlacemark)="onClickPlacemark($event)"
          (clickPolygon)="onClickPolygon($event)"
          (emptyClick)="onEmptyClick($event)" />

        <aside class="side">
          @if (selectedPlacemark(); as pm) {
            <app-object-panel [placemark]="pm"
              (change)="onPlacemarkUpdate($event)" (remove)="deletePlacemark(pm.id)" />
          } @else if (selectedPolygon()) {
            <app-floor-panel [polygon]="selectedPolygon()!" [areaM2]="selectedPolygonAreaM2()"
              (change)="onPolygonUpdate($event)" (remove)="deletePolygon(selectedPolygon()!.id)" />
          } @else {
            <app-material-panel
              [group]="selectedGroup()"
              [measuredThicknessMm]="selectedMeasuredThicknessMm()"
              [memberLengthMm]="selectedMemberLengthMm()"
              [segmentCount]="selectedSegmentCount()"
              (groupChange)="onGroupUpdate($event)" />
          }
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
    .save-status { display: inline-flex; align-items: center; gap: 4px;
      font-size: 12px; color: #78909c; min-width: 96px; justify-content: flex-end; }
    .save-status mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .hint-bar { background: #f4f8fb; color: #455a64; font-size: 12px;
      padding: 4px 16px; border-bottom: 1px solid #eceff1; min-height: 22px; }
    .despeckle-bar { display: flex; align-items: center; gap: 12px;
      background: #fff3e0; border-bottom: 1px solid #ffe0b2; padding: 4px 16px;
      color: #7a4f1c; font-size: 13px; }
    .despeckle-bar .despeckle-slider { width: 220px; }
    .despeckle-bar .thr { font-weight: 600; min-width: 52px; }
    .despeckle-bar .count { color: #c62828; font-weight: 600; }
    .despeckle-bar .spacer { flex: 1; }
    .despeckle-on { background: #ffe0b2 !important; }
    .fixture-bar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
      background: #eef5fb; border-bottom: 1px solid #d8e6f2; padding: 5px 12px; }
    .fixture-bar .fx { font-size: 12px; min-width: 0; padding: 0 8px; }
    .fixture-bar .fx.armed { background: #107bbc !important; color: #fff !important; }
    .fixture-bar .fx.armed mat-icon { color: #fff !important; }
    .split { display: flex; flex: 1; min-height: 0; }
    .side { width: 380px; border-left: 1px solid #eceff1; background: #fff;
      overflow: hidden; display: flex; flex-direction: column; }
    @media (max-width: 1100px) { .side { width: 320px; } }
  `],
})
export class PlanEditorComponent implements OnDestroy {
  @ViewChild('viewer') viewer!: PlanViewerComponent;
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private planSvc = inject(PlanService);
  private statsSvc = inject(EditorStatsService);
  private ctxSvc = inject(IntegrationContextService);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  plan = signal<PlanDoc | null>(null);
  tool = signal<ViewerTool>('select');
  selection = signal<string[]>([]);
  dirty = signal(false);
  saving = signal(false);
  saved = signal(false);
  private saveTimer: any = null;

  selectedPlacemarkId = signal<string | null>(null);
  selectedPolygonId = signal<string | null>(null);
  armedFixtureKey = signal<string>('tuer');
  fixtures = FIXTURE_CATALOG;

  despeckleActive = signal(false);
  despeckleThresholdCm2 = signal(15);

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

  /** Non-excluded segments sharing a wallObjectId (the buildup's runs). */
  private groupMembers(wallObjectId: string): WallSegment[] {
    return (this.plan()?.wallSegments ?? [])
      .filter((s) => s.wallObjectId === wallObjectId && !s.excluded);
  }

  /** The buildup for the selected wall — existing, or an unsaved default. */
  selectedGroup = computed<WallGroup | null>(() => {
    const seg = this.selectedSegment();
    const p = this.plan();
    if (!seg || !p) return null;
    return (
      p.wallGroups.find((g) => g.id === seg.wallObjectId) ?? {
        id: seg.wallObjectId,
        partType: WallPartType.Innenwand,
        name: '',
        is_public: true,
        is_hazardous: false,
        layers: [],
      }
    );
  });

  selectedSegmentCount = computed(() => {
    const seg = this.selectedSegment();
    return seg ? this.groupMembers(seg.wallObjectId).length : 0;
  });

  selectedMemberLengthMm = computed<number | null>(() => {
    const seg = this.selectedSegment();
    const mmPerUnit = this.plan()?.calibration?.mmPerUnit;
    if (!seg || !mmPerUnit) return null;
    const units = this.groupMembers(seg.wallObjectId).reduce((a, s) => a + runLengthUnits(s), 0);
    return units * mmPerUnit;
  });

  selectedMeasuredThicknessMm = computed<number | null>(() => {
    const seg = this.selectedSegment();
    const mmPerUnit = this.plan()?.calibration?.mmPerUnit;
    if (!seg || !mmPerUnit) return null;
    const members = this.groupMembers(seg.wallObjectId);
    if (members.length === 0) return null;
    const mean = members.reduce((a, s) => a + s.measuredThickness, 0) / members.length;
    return mean * mmPerUnit;
  });

  /** Groups with an assigned buildup and at least one live member. */
  assignedGroupCount = computed(() =>
    (this.plan()?.wallGroups ?? [])
      .filter((g) => g.layers.length > 0 && this.groupMembers(g.id).length > 0).length,
  );

  /** Share of walls that already carry an assigned buildup. */
  donePercent = computed(() => {
    const total = this.objectCount();
    return total === 0 ? 0 : Math.round((this.assignedGroupCount() / total) * 100);
  });

  placemarkCount = computed(() => (this.plan()?.placemarks ?? []).length);
  floorBuildupCount = computed(() => (this.plan()?.polygons ?? []).filter((poly) => (poly.layers?.length ?? 0) > 0).length);

  selectedPlacemark = computed<Placemark | null>(() => {
    const id = this.selectedPlacemarkId();
    const p = this.plan();
    if (!id || !p) return null;
    return p.placemarks.find((m) => m.id === id) ?? null;
  });

  selectedPolygon = computed<FloorPolygon | null>(() => {
    const id = this.selectedPolygonId();
    const p = this.plan();
    if (!id || !p) return null;
    return p.polygons.find((poly) => poly.id === id) ?? null;
  });

  selectedPolygonAreaM2 = computed<number | null>(() => {
    const poly = this.selectedPolygon();
    return poly ? this.floorAreaM2(poly) : null;
  });

  /** Non-excluded segments whose footprint is below the despeckle threshold. */
  despeckleCandidates = computed<string[]>(() => {
    if (!this.despeckleActive()) return [];
    const p = this.plan();
    const mmPerUnit = p?.calibration?.mmPerUnit;
    if (!p || !mmPerUnit) return [];
    const thrMm2 = this.despeckleThresholdCm2() * 100; // cm² → mm²
    const k = mmPerUnit * mmPerUnit;
    return p.wallSegments
      .filter((s) => !s.excluded && polygonArea(s.polygon) * k < thrMm2)
      .map((s) => s.id);
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.planSvc.get(id).subscribe({
        next: (p) => this.plan.set(p),
        error: () => this.snack.open('Plan nicht gefunden', 'OK', { duration: 3000 }),
      });
    }
    // Publish stats to the app top bar (rendered next to the "Pläne" link).
    effect(() => {
      const p = this.plan();
      this.statsSvc.stats.set(p ? {
        segments: this.activeCount(),
        walls: this.objectCount(),
        withBuildup: this.assignedGroupCount(),
        donePercent: this.donePercent(),
        excluded: this.excludedCount(),
        objects: this.placemarkCount(),
      } : null);
    }, { allowSignalWrites: true });
  }

  // --- Keyboard shortcuts --------------------------------------------------

  @HostListener('window:keydown', ['$event'])
  onKeyDown(ev: KeyboardEvent) {
    // Never hijack keys while typing in a form field (thickness / name / search).
    if (isEditableTarget(ev.target)) return;
    const ctrl = ev.ctrlKey || ev.metaKey;

    // Tool shortcuts: Ctrl+1..4
    if (ctrl && ev.key === '1') { ev.preventDefault(); this.tool.set('pan'); return; }
    if (ctrl && ev.key === '2') { ev.preventDefault(); this.tool.set('select'); return; }
    if (ctrl && ev.key === '3') { ev.preventDefault(); this.tool.set('polygon'); return; }
    if (ctrl && ev.key === '4') { ev.preventDefault(); this.tool.set('object'); return; }
    if (ctrl && ev.key === '5') { ev.preventDefault(); this.tool.set('floodfill'); return; }

    // Undo: Ctrl+Z
    if (ctrl && ev.key === 'z' && !ev.shiftKey) { ev.preventDefault(); this.undo(); return; }
    // Redo: Ctrl+Y or Ctrl+Shift+Z
    if (ctrl && ev.key === 'y') { ev.preventDefault(); this.redo(); return; }
    if (ctrl && ev.key === 'z' && ev.shiftKey) { ev.preventDefault(); this.redo(); return; }

    // Merge: Ctrl+M
    if (ctrl && ev.key === 'm') { ev.preventDefault(); this.mergeSelected(); return; }

    // Delete/Backspace: selected floor → placemark → else exclude selected walls.
    if (ev.key === 'Delete' || ev.key === 'Backspace') {
      const polyId = this.selectedPolygonId();
      if (polyId) { ev.preventDefault(); this.deletePolygon(polyId); return; }
      const pmId = this.selectedPlacemarkId();
      if (pmId) { ev.preventDefault(); this.deletePlacemark(pmId); return; }
      if (this.selection().length > 0) {
        ev.preventDefault();
        this.excludeSelected();
      }
      return;
    }

    // Ctrl+S: save
    if (ctrl && ev.key === 's') { ev.preventDefault(); this.flushSave(); return; }

    // Ctrl+A: select all (non-excluded)
    if (ctrl && ev.key === 'a') {
      ev.preventDefault();
      const all = (this.plan()?.wallSegments ?? []).filter((s) => !s.excluded).map((s) => s.id);
      this.selection.set(all);
      return;
    }
  }

  openReport() {
    const p = this.plan();
    if (p) this.router.navigate(['/report', p.id]);
  }

  back() {
    // Flush any pending change, then leave once it's persisted.
    if (this.dirty() && this.plan()) {
      if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
      this.saving.set(true);
      this.planSvc.save(this.plan()!).subscribe({
        next: () => this.router.navigate(['/plans']),
        error: () => this.router.navigate(['/plans']),
      });
      return;
    }
    this.router.navigate(['/plans']);
  }

  setTool(t: ViewerTool) {
    this.tool.set(t);
  }

  // --- Selection -----------------------------------------------------------

  onClickSegment(ev: { seg: WallSegment; shift: boolean }) {
    this.selectedPlacemarkId.set(null); // wall selection is exclusive with placemarks/floors
    this.selectedPolygonId.set(null);
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
    this.selectedPlacemarkId.set(null);
    this.selectedPolygonId.set(null);
    if (ev.shift) {
      this.selection.update((prev) => [...new Set([...prev, ...ev.segIds])]);
    } else {
      this.selection.set(ev.segIds);
    }
    this.snack.open(`${this.selection().length} Segmente ausgewählt`, undefined, { duration: 1200 });
  }

  onEmptyClick(ev: { tool: ViewerTool; shift: boolean }) {
    if (!ev.shift) {
      this.selection.set([]);
      this.selectedPlacemarkId.set(null);
      this.selectedPolygonId.set(null);
    }
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
    this.markChanged();
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
    this.markChanged();
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
      const wallSegments = plan.wallSegments.map((s) =>
        sel.includes(s.id) ? { ...s, wallObjectId: targetObjectId } : s,
      );
      // Drop buildups whose group id no longer has any segment (merged away).
      const liveIds = new Set(wallSegments.map((s) => s.wallObjectId));
      return { ...plan, wallSegments, wallGroups: plan.wallGroups.filter((g) => liveIds.has(g.id)) };
    });
    this.markChanged();
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
    this.markChanged();
    this.viewer?.triggerFlash(ids);
    this.snack.open(`${ids.length} Segment(e) ausgeschlossen`, undefined, { duration: 2000 });
  }

  // --- Despeckle -----------------------------------------------------------

  toggleDespeckle() { this.despeckleActive.update((v) => !v); }
  closeDespeckle() { this.despeckleActive.set(false); }

  applyDespeckle() {
    const ids = this.despeckleCandidates();
    if (ids.length === 0) return;
    // Reuses the exclude action → undoable, flashes, marks dirty.
    this.excludeSegments(ids);
  }

  // --- Buildup panel -------------------------------------------------------

  onGroupUpdate(group: WallGroup) {
    this.plan.update((p) => {
      if (!p) return p;
      const others = p.wallGroups.filter((g) => g.id !== group.id);
      return { ...p, wallGroups: [...others, group] };
    });
    this.markChanged();
  }

  // --- Objekte (placemarks) ------------------------------------------------

  onPlaceObject(pt: { x: number; y: number }) {
    const f = fixtureByKey(this.armedFixtureKey()) ?? this.fixtures[0];
    const pm: Placemark = {
      id: 'pm-' + Math.random().toString(36).slice(2, 10),
      x: pt.x, y: pt.y,
      fixtureKey: f.key, objectType: f.objectType, name: f.name,
      count: 1, is_public: true, is_hazardous: false,
    };
    this.plan.update((p) => (p ? { ...p, placemarks: [...p.placemarks, pm] } : p));
    this.selection.set([]);
    this.selectedPolygonId.set(null);
    this.selectedPlacemarkId.set(pm.id);
    this.markChanged();
  }

  onClickPlacemark(pm: Placemark) {
    this.selection.set([]);
    this.selectedPolygonId.set(null);
    this.selectedPlacemarkId.set(pm.id);
  }

  onPlacemarkUpdate(pm: Placemark) {
    this.plan.update((p) => (p ? { ...p, placemarks: p.placemarks.map((m) => m.id === pm.id ? pm : m) } : p));
    this.markChanged();
  }

  deletePlacemark(id: string) {
    this.plan.update((p) => (p ? { ...p, placemarks: p.placemarks.filter((m) => m.id !== id) } : p));
    if (this.selectedPlacemarkId() === id) this.selectedPlacemarkId.set(null);
    this.markChanged();
  }

  /** Fold identical placemarks (type+name+dims+flags) into a single count. */
  private aggregateObjects(): ObjektAggregate[] {
    const p = this.plan();
    if (!p) return [];
    const map = new Map<string, ObjektAggregate>();
    for (const m of p.placemarks) {
      const key = [m.objectType, m.name, m.length ?? '', m.width ?? '', m.height ?? '', m.is_public, m.is_hazardous].join('|');
      const ex = map.get(key);
      if (ex) { ex.count += m.count; continue; }
      map.set(key, {
        objectType: m.objectType, name: m.name, count: m.count,
        length: m.length ?? null, width: m.width ?? null, height: m.height ?? null,
        is_public: m.is_public, is_hazardous: m.is_hazardous,
      });
    }
    return [...map.values()];
  }

  // --- Polygon -------------------------------------------------------------

  onPolygonCreated(poly: FloorPolygon) {
    const withBuildup: FloorPolygon = {
      ...poly,
      partType: poly.partType ?? SlabPartType.Bodenaufbau,
      name: poly.name ?? '',
      is_public: poly.is_public ?? true,
      is_hazardous: poly.is_hazardous ?? false,
      layers: poly.layers ?? [],
    };
    this.plan.update((p) => (p ? { ...p, polygons: [...p.polygons, withBuildup] } : p));
    this.selection.set([]);
    this.selectedPlacemarkId.set(null);
    this.selectedPolygonId.set(withBuildup.id);
    this.markChanged();
    this.snack.open('Bodenpolygon erstellt', undefined, { duration: 1500 });
  }

  onClickPolygon(poly: FloorPolygon) {
    this.selection.set([]);
    this.selectedPlacemarkId.set(null);
    this.selectedPolygonId.set(poly.id);
  }

  onPolygonUpdate(poly: FloorPolygon) {
    this.plan.update((p) => (p ? { ...p, polygons: p.polygons.map((x) => x.id === poly.id ? poly : x) } : p));
    this.markChanged();
  }

  deletePolygon(id: string) {
    this.plan.update((p) => (p ? { ...p, polygons: p.polygons.filter((x) => x.id !== id) } : p));
    if (this.selectedPolygonId() === id) this.selectedPolygonId.set(null);
    this.markChanged();
  }

  onFloodFill(pt: { x: number; y: number }) {
    const p = this.plan();
    if (!p) return;
    this.snack.open('Boden wird gefüllt…', undefined, { duration: 1500 });
    this.planSvc.floodfill(p.id, pt.x, pt.y).subscribe({
      next: (res) => {
        const poly: FloorPolygon = {
          id: 'poly-' + Math.random().toString(36).slice(2, 10),
          points: res.points,
          netAreaM2: res.areaM2,
          partType: SlabPartType.Bodenaufbau,
          name: '', is_public: true, is_hazardous: false, layers: [],
          floodClick: { x: pt.x, y: pt.y }, floodBlockers: [],
        };
        this.plan.update((pl) => (pl ? { ...pl, polygons: [...pl.polygons, poly] } : pl));
        this.selection.set([]);
        this.selectedPlacemarkId.set(null);
        this.selectedPolygonId.set(poly.id);
        this.markChanged();
        this.snack.open(`Boden: ${res.areaM2.toFixed(1)} m² — Fehler mit Ziehen wegnehmen`, 'OK', { duration: 3500 });
      },
      error: (e) => this.snack.open(e?.error?.error ?? 'Füllen fehlgeschlagen', 'OK', { duration: 3500 }),
    });
  }

  onFloodBlock(rect: { x: number; y: number; w: number; h: number }) {
    const p = this.plan();
    const poly = this.selectedPolygon();
    if (!p || !poly || !poly.floodClick) {
      this.snack.open('Erst einen Boden füllen, dann Fehler mit Ziehen wegnehmen', undefined, { duration: 2500 });
      return;
    }
    const blockers: Array<[number, number, number, number]> = [
      ...(poly.floodBlockers ?? []),
      [rect.x, rect.y, rect.w, rect.h],
    ];
    this.planSvc.floodfill(p.id, poly.floodClick.x, poly.floodClick.y, blockers).subscribe({
      next: (res) => {
        this.plan.update((pl) => (pl ? {
          ...pl,
          polygons: pl.polygons.map((x) => x.id === poly.id
            ? { ...x, points: res.points, netAreaM2: res.areaM2, floodBlockers: blockers }
            : x),
        } : pl));
        this.markChanged();
        this.snack.open(`Boden: ${res.areaM2.toFixed(1)} m²`, undefined, { duration: 2000 });
      },
      error: (e) => this.snack.open(e?.error?.error ?? 'Fehlgeschlagen', 'OK', { duration: 3000 }),
    });
  }

  /** Net floor area: backend flood-fill value if present, else geometry − walls. */
  private floorAreaM2(poly: FloorPolygon): number | null {
    if (poly.netAreaM2 != null) return poly.netAreaM2;
    const mmPerUnit = this.plan()?.calibration?.mmPerUnit;
    if (!mmPerUnit) return null;
    return this.netFloorAreaM2(poly, mmPerUnit);
  }

  /** Net floor area (m²) = drawn outline minus the footprint of the walls inside it. */
  private netFloorAreaM2(poly: FloorPolygon, mmPerUnit: number): number {
    const grossUnits2 = polyAreaTuples(poly.points);
    let wallUnits2 = 0;
    for (const seg of this.plan()?.wallSegments ?? []) {
      if (seg.excluded) continue;
      if (pointInPolyTuples(centroidXY(seg.polygon), poly.points)) {
        wallUnits2 += polygonArea(seg.polygon);
      }
    }
    const mPerUnit = mmPerUnit / 1000;
    return Math.max(0, grossUnits2 - wallUnits2) * mPerUnit * mPerUnit;
  }

  // --- Export --------------------------------------------------------------

  /** Build the m-hub payloads from the current plan (location left to the caller/endpoint). */
  private assemblePayloads(ctx: MhubContext): { bauteile: CreateBauteilPayload[]; objekte: CreateObjektPayload[] } {
    const p = this.plan();
    if (!p) return { bauteile: [], objekte: [] };
    const mmPerUnit = p.calibration?.mmPerUnit;
    const walls: WallBuildup[] = [];
    const slabs: SlabBuildup[] = [];
    if (mmPerUnit) {
      for (const g of p.wallGroups) {
        const members = this.groupMembers(g.id);
        if (g.layers.length === 0 || members.length === 0) continue;
        const totalLengthMm = members.reduce((a, s) => a + runLengthUnits(s), 0) * mmPerUnit;
        walls.push({
          partType: g.partType, name: g.name || `Wand ${g.id.slice(0, 6)}`,
          description: g.description, is_public: g.is_public, is_hazardous: g.is_hazardous,
          totalLengthMm, layers: g.layers,
        });
      }
      for (const poly of p.polygons) {
        const layers = poly.layers ?? [];
        if (layers.length === 0) continue;
        slabs.push({
          partType: poly.partType ?? SlabPartType.Bodenaufbau, name: poly.name || 'Bodenaufbau',
          description: poly.description, is_public: poly.is_public ?? true,
          is_hazardous: poly.is_hazardous ?? false, areaM2: this.floorAreaM2(poly) ?? 0, layers,
        });
      }
    }
    return {
      bauteile: toBauteilPayloads(walls, slabs, ctx),
      objekte: this.aggregateObjects().map((o) => objektToPayload(o, ctx)),
    };
  }

  exportData() {
    const p = this.plan();
    if (!p) return;
    const ctx: MhubContext = { building_id: '', user_building_id: '', owner_id: '', location: '' };
    const { bauteile, objekte } = this.assemblePayloads(ctx);
    if (bauteile.length === 0 && objekte.length === 0) {
      this.snack.open('Nichts zu exportieren', 'OK', { duration: 3000 });
      return;
    }
    this.download(`${p.originalFilename.replace(/\.pdf$/i, '')}-mhub.json`, { bauteile, objekte });
    this.snack.open(`${bauteile.length} Bauteil(e), ${objekte.length} Objekt(e) exportiert`, 'OK', { duration: 2500 });
  }

  /**
   * Hand-off to m-hub: pick storey(s), then POST one batch per storey (each with
   * its own delete-and-reallocate extract id), or download stand-alone.
   */
  async handoff() {
    const p = this.plan();
    if (!p) return;
    const ctx = this.ctxSvc.context;
    const base: MhubContext = {
      building_id: ctx?.buildingId ?? '', user_building_id: ctx?.userBuildingId ?? '',
      owner_id: ctx?.ownerId ?? '', location: '',
    };
    const probe = this.assemblePayloads(base);
    if (probe.bauteile.length === 0 && probe.objekte.length === 0) {
      this.snack.open('Nichts zu übergeben', 'OK', { duration: 3000 });
      return;
    }

    const locations = (await firstValueFrom(
      this.dialog.open(HandoffDialogComponent, {
        width: '440px', maxWidth: '95vw',
        data: { storeys: ctx?.storeys ?? [], integrated: !!ctx, bauteilCount: probe.bauteile.length, objektCount: probe.objekte.length },
      }).afterClosed(),
    )) as string[] | undefined;
    if (!locations || locations.length === 0) return;

    // Reflect the chosen storey(s) in the plan for the report header.
    this.plan.update((pl) => (pl ? { ...pl, location: locations.join(', ') } : pl));
    this.markChanged();

    // One packet per storey: each part/object stamped with that storey, own extract id.
    const documentId = ctx?.documentId ?? p.id;
    const packets: ImportPacket[] = [];
    for (const loc of locations) {
      const { bauteile, objekte } = this.assemblePayloads({ ...base, location: loc });
      packets.push({
        building_id: base.building_id,
        user_building_id: base.user_building_id,
        source_extract_id: await extractIdFor(documentId, loc),
        parts: bauteile,
        objects: objekte,
      });
    }

    if (!ctx) {
      this.download(`${p.originalFilename.replace(/\.pdf$/i, '')}-import.json`, packets);
      this.snack.open('Import-Packet(e) heruntergeladen (stand-alone)', 'OK', { duration: 2500 });
      return;
    }

    try {
      for (const packet of packets) {
        await firstValueFrom(this.planSvc.submitImport(ctx.submitUrl, ctx.token, packet));
      }
      this.snack.open(
        `Übergeben: ${probe.bauteile.length} Bauteil(e), ${probe.objekte.length} Objekt(e) × ${locations.length} Geschoss(e)`,
        'OK', { duration: 3500 },
      );
    } catch (e) {
      const msg = (e as { error?: { error?: string } })?.error?.error;
      this.snack.open(msg ?? 'Übergabe fehlgeschlagen', 'OK', { duration: 4000 });
    }
  }

  private download(filename: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Save ----------------------------------------------------------------

  /** Mark the plan dirty and (re)arm the debounced autosave. */
  private markChanged() {
    this.dirty.set(true);
    this.saved.set(false);
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flushSave(), 1000);
  }

  /** Persist now (autosave debounce fired, or Ctrl+S). No-op if nothing changed. */
  flushSave() {
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    const p = this.plan();
    if (!p || !this.dirty()) return;
    this.saving.set(true);
    this.planSvc.save(p).subscribe({
      next: () => { this.saving.set(false); this.saved.set(true); this.dirty.set(false); },
      error: () => { this.saving.set(false); this.snack.open('Speichern fehlgeschlagen', 'OK', { duration: 3000 }); },
    });
  }

  ngOnDestroy() {
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.flushSave(); }
    this.statsSvc.stats.set(null);
  }
}
