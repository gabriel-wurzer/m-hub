import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy,
  EventEmitter, HostListener, Input, Output, ViewChild, computed, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DetectRegion, FloorPolygon, PlanDoc, Placemark, WallSegment } from '../../models/plan.model';
import { fixtureByKey, objectTypeColor } from '../../models/mhub.model';

export type ViewerTool = 'pan' | 'select' | 'polygon' | 'pipette' | 'region' | 'object' | 'floodfill';

interface ViewState { scale: number; tx: number; ty: number; }

// Distinct palette for wallObjectId groups.
const PALETTE = [
  '#179bde', '#43a047', '#e66c1a', '#8e24aa', '#00897b',
  '#d81b60', '#5e35b1', '#1e88e5', '#00acc1', '#7cb342',
  '#f4511e', '#3949ab', '#039be5', '#c0ca33', '#6d4c41',
];

/** True when a keyboard event originates from a text-entry field. */
function isEditableTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

@Component({
  selector: 'app-plan-viewer',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg #svg class="viewer"
         [style.cursor]="activeCursor()"
         (contextmenu)="$event.preventDefault()"
         (pointerdown)="onPointerDown($event)"
         (pointermove)="onPointerMove($event)"
         (pointerup)="onPointerUp($event)"
         (pointerleave)="onPointerUp($event)"
         (wheel)="onWheel($event)">
      <defs>
        <filter id="sel-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <pattern id="excluded-hatch" patternUnits="userSpaceOnUse"
                 width="8" height="8" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8"
                stroke="#c62828" stroke-width="2" stroke-opacity="0.6" />
        </pattern>
      </defs>

      <g [attr.transform]="transform()">
        <!-- Raster background -->
        @if (plan && plan.rasterUrl) {
          <image [attr.href]="plan.rasterUrl"
                 x="0" y="0"
                 [attr.width]="plan.pageWidth"
                 [attr.height]="plan.pageHeight"
                 preserveAspectRatio="none"
                 opacity="0.85" />
        }

        @if (plan) {
          <!-- Floor polygons -->
          @for (poly of plan.polygons; track poly.id) {
            <polygon [attr.points]="floorPolyPoints(poly)"
                     [attr.fill]="isPolySelected(poly.id) ? 'rgba(255,171,0,0.25)' : 'var(--polygon-fill)'"
                     [attr.stroke]="isPolySelected(poly.id) ? '#e65100' : 'var(--polygon-stroke)'"
                     [attr.stroke-width]="(isPolySelected(poly.id) ? 2.4 : 1.2) / view().scale"
                     [attr.pointer-events]="tool === 'select' ? 'fill' : 'none'"
                     [style.cursor]="tool === 'select' ? 'pointer' : null"
                     (pointerdown)="onPolygonDown($event, poly)" />
          }

          <!-- Wall segments: excluded segments hidden -->
          @for (seg of plan.wallSegments; track seg.id) {
            @if (!seg.excluded) {
              <!-- Visible + clickable polygon -->
              <polygon [attr.points]="segPoints(seg)"
                       [attr.fill]="segColor(seg)"
                       [attr.stroke]="isSelected(seg.id) ? '#e65100' : segStroke(seg)"
                       [attr.stroke-width]="(isSelected(seg.id) ? 3 : 1) / view().scale"
                       class="wall-seg"
                       [class.selected]="isSelected(seg.id)"
                       [class.flagged]="isFlagged(seg.id)"
                       [class.done]="isDone(seg)"
                       [attr.filter]="isSelected(seg.id) ? 'url(#sel-glow)' : null"
                       [attr.pointer-events]="tool === 'select' ? 'fill' : 'none'"
                       [style.cursor]="tool === 'select' ? 'pointer' : null"
                       (pointerdown)="onSegDown($event, seg)" />
              <!-- Invisible wider hit-test overlay for thin segments -->
              <polygon [attr.points]="segPoints(seg)"
                       fill="transparent"
                       stroke="transparent"
                       [attr.stroke-width]="10 / view().scale"
                       [attr.pointer-events]="tool === 'select' ? 'stroke' : 'none'"
                       [style.cursor]="tool === 'select' ? 'pointer' : null"
                       (pointerdown)="onSegDown($event, seg)" />
            }
          }

          <!-- Detection regions (ROI): dim everything outside their union -->
          @if (showDim()) {
            <path [attr.d]="dimPath()" fill="rgba(38,50,56,0.42)"
                  fill-rule="evenodd" pointer-events="none" />
          }
          @for (r of _regions(); track $index) {
            <rect [attr.x]="r.x" [attr.y]="r.y" [attr.width]="r.w" [attr.height]="r.h"
                  fill="none" stroke="#107bbc" [attr.stroke-width]="1.5 / view().scale"
                  stroke-dasharray="6 3" pointer-events="none" />
          }

          <!-- Region edit handles (region tool only): body = move, dots = resize -->
          @if (tool === 'region') {
            @for (r of _regions(); track $index; let ri = $index) {
              <rect [attr.x]="r.x" [attr.y]="r.y" [attr.width]="r.w" [attr.height]="r.h"
                    fill="transparent" style="cursor: move" pointer-events="fill"
                    (pointerdown)="onRegionHandleDown($event, ri, 'move')" />
              @for (hnd of regionHandles(r); track hnd.mode) {
                <circle [attr.cx]="hnd.cx" [attr.cy]="hnd.cy" [attr.r]="5 / view().scale"
                        fill="#fff" stroke="#107bbc" [attr.stroke-width]="1.5 / view().scale"
                        [style.cursor]="hnd.cursor" pointer-events="all"
                        (pointerdown)="onRegionHandleDown($event, ri, hnd.mode)" />
              }
            }
          }

          <!-- Marquee rectangle -->
          @if (marquee(); as m) {
            <rect [attr.x]="mRect(m).x" [attr.y]="mRect(m).y"
                  [attr.width]="mRect(m).w" [attr.height]="mRect(m).h"
                  fill="rgba(23,155,222,0.08)" stroke="#107bbc"
                  [attr.stroke-width]="1.2 / view().scale"
                  stroke-dasharray="4 3" pointer-events="none" />
          }

          <!-- Polygon draft -->
          @if (polygonDraft().length > 0) {
            <polyline [attr.points]="draftPolyPoints()"
              fill="none" stroke="#e66c1a"
              [attr.stroke-width]="1.5 / view().scale"
              stroke-dasharray="4 3" />
            @for (p of polygonDraft(); track $index) {
              <circle [attr.cx]="p[0]" [attr.cy]="p[1]"
                      [attr.r]="3 / view().scale" fill="#e66c1a" />
            }
          }

          <!-- Object placemarks (constant screen size via inverse scale) -->
          @for (pm of plan.placemarks; track pm.id) {
            <g [attr.transform]="pmTransform(pm)">
              <circle r="13" [attr.fill]="pmColor(pm)" stroke="#fff" stroke-width="2"
                      class="placemark" [class.pm-selected]="isPmSelected(pm.id)"
                      [attr.pointer-events]="tool === 'select' || tool === 'object' ? 'all' : 'none'"
                      [style.cursor]="tool === 'select' || tool === 'object' ? 'pointer' : null"
                      (pointerdown)="onPlacemarkDown($event, pm)" />
              <foreignObject x="-9" y="-9" width="18" height="18" pointer-events="none">
                <span class="material-icons pm-icon">{{ pmIcon(pm) }}</span>
              </foreignObject>
              @if (pm.count > 1) {
                <circle cx="11" cy="-11" r="7" fill="#263238" stroke="#fff" stroke-width="1.5" pointer-events="none" />
                <text x="11" y="-8" text-anchor="middle" font-size="9" fill="#fff"
                      font-family="Roboto, sans-serif" pointer-events="none">{{ pm.count }}</text>
              }
            </g>
          }
        }
      </g>
    </svg>
  `,
  styles: [`
    :host { display: block; flex: 1; min-height: 0; min-width: 0; position: relative; }
    .viewer { width: 100%; height: 100%; background: #eceff1; user-select: none; touch-action: none; }
    .wall-seg { fill-opacity: 0.40; transition: fill-opacity 0.15s; }
    .wall-seg:hover { fill-opacity: 0.55; }
    .wall-seg.done { fill: #000 !important; fill-opacity: 1; stroke: #000 !important; }
    .wall-seg.selected { fill: #ffab00 !important; fill-opacity: 0.65; stroke: #e65100 !important; }
    .wall-seg.flagged { fill: #e53935 !important; fill-opacity: 0.7; stroke: #b71c1c !important; }
    .wall-seg.excluded { fill-opacity: 1; }
    .placemark { transition: stroke 0.15s; }
    .placemark.pm-selected { stroke: #ffab00 !important; stroke-width: 3; }
    .pm-icon { display: block; width: 18px; height: 18px; font-size: 18px;
      line-height: 18px; color: #fff; user-select: none; }
    .wall-seg.excluded.selected { stroke: #e65100 !important; stroke-dasharray: none; }
  `],
})
export class PlanViewerComponent implements AfterViewInit, OnDestroy {
  @Input() set plan(val: PlanDoc | null) { this._plan.set(val); }
  _plan = signal<PlanDoc | null>(null);
  get plan(): PlanDoc | null { return this._plan(); }

  @Input() tool: ViewerTool = 'select';

  @Input() set selection(val: string[]) { this._selection.set(val); }
  _selection = signal<string[]>([]);

  @Input() set thicknessFilterMm(val: [number, number]) { this._thicknessFilter.set(val); }
  _thicknessFilter = signal<[number, number]>([0, 99999]);

  @Input() set regions(val: DetectRegion[]) { this._regions.set(val ?? []); }
  _regions = signal<DetectRegion[]>([]);

  @Input() set flaggedIds(val: string[]) { this._flagged.set(new Set(val ?? [])); }
  _flagged = signal<Set<string>>(new Set());

  @Input() set selectedPlacemarkId(val: string | null) { this._selPm.set(val); }
  _selPm = signal<string | null>(null);

  @Input() set selectedPolygonId(val: string | null) { this._selPoly.set(val); }
  _selPoly = signal<string | null>(null);

  @Output() clickSegment = new EventEmitter<{ seg: WallSegment; shift: boolean }>();
  @Output() rectSelect = new EventEmitter<{ segIds: string[]; shift: boolean }>();
  @Output() colorPicked = new EventEmitter<[number, number, number]>();
  @Output() polygonCreated = new EventEmitter<FloorPolygon>();
  @Output() regionsChange = new EventEmitter<DetectRegion[]>();
  @Output() placeObject = new EventEmitter<{ x: number; y: number }>();
  @Output() floodFillAt = new EventEmitter<{ x: number; y: number }>();
  @Output() floodBlock = new EventEmitter<{ x: number; y: number; w: number; h: number }>();
  @Output() clickPlacemark = new EventEmitter<Placemark>();
  @Output() clickPolygon = new EventEmitter<FloorPolygon>();
  @Output() emptyClick = new EventEmitter<{ tool: ViewerTool; shift: boolean }>();

  @ViewChild('svg', { static: true }) svgRef!: ElementRef<SVGSVGElement>;

  view = signal<ViewState>({ scale: 1, tx: 0, ty: 0 });
  transform = computed(() => {
    const v = this.view();
    return `matrix(${v.scale} 0 0 ${v.scale} ${v.tx} ${v.ty})`;
  });

  private panning = false;
  private panStart = { x: 0, y: 0, tx: 0, ty: 0 };
  spaceDown = signal(false);
  polygonDraft = signal<Array<[number, number]>>([]);
  flashIds = signal<Set<string>>(new Set());
  marquee = signal<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  private dragging = false;
  private marqueeShift = false;
  private regionDrag: {
    index: number; mode: string; startX: number; startY: number; orig: DetectRegion;
  } | null = null;
  private polyStart: { x: number; y: number } | null = null;
  private polyMoved = false;
  private ffStart: { x: number; y: number } | null = null;
  private ffMoved = false;

  // Pipette raster canvas.
  private rasterCanvas: HTMLCanvasElement | null = null;
  private rasterCtx: CanvasRenderingContext2D | null = null;
  private rasterLoaded = false;

  selectionSet = computed(() => new Set(this._selection()));
  isSelected(id: string): boolean { return this.selectionSet().has(id); }
  isFlagged(id: string): boolean { return this._flagged().has(id); }

  /** Wall-object ids that already carry an assigned buildup. */
  private doneObjectIds = computed(() => {
    const p = this._plan();
    return new Set((p?.wallGroups ?? []).filter((g) => g.layers.length > 0).map((g) => g.id));
  });
  isDone(seg: WallSegment): boolean { return this.doneObjectIds().has(seg.wallObjectId); }

  pmTransform(pm: Placemark): string { return `translate(${pm.x},${pm.y}) scale(${1 / this.view().scale})`; }
  pmColor(pm: Placemark): string { return objectTypeColor(pm.objectType); }
  pmIcon(pm: Placemark): string { return fixtureByKey(pm.fixtureKey)?.icon ?? 'place'; }
  isPmSelected(id: string): boolean { return this._selPm() === id; }

  // wallObjectId → palette color mapping.
  private objectColorCache = new Map<string, string>();
  private colorIndex = 0;

  activeCursor = computed(() => {
    if (this.panning) return 'grabbing';
    const map: Record<ViewerTool, string> = {
      'pan': 'grab', 'select': 'crosshair',
      'polygon': 'crosshair', 'pipette': 'crosshair', 'region': 'crosshair', 'object': 'copy',
      'floodfill': 'cell',
    };
    return map[this.tool] ?? 'default';
  });

  private resizeObs: ResizeObserver | null = null;

  ngAfterViewInit() {
    // fitToView needs the SVG to have its final layout size. In dialogs
    // this may take a few frames, so use ResizeObserver to catch it.
    const svg = this.svgRef.nativeElement;
    this.resizeObs = new ResizeObserver(() => {
      const r = svg.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) this.fitToView();
    });
    this.resizeObs.observe(svg);
    // Also try immediately and after a short delay as fallbacks.
    queueMicrotask(() => this.fitToView());
    setTimeout(() => this.fitToView(), 300);
  }

  ngOnDestroy() {
    this.resizeObs?.disconnect();
  }
  ngOnChanges() {
    if (this.tool !== 'polygon') this.polygonDraft.set([]);
    this.ensureRasterCanvas();
    // Reset color cache when plan changes.
    this.objectColorCache.clear();
    this.colorIndex = 0;
  }

  @Input() fitMargin = 40;

  /** Current zoom as percentage (100 = 1:1 pixel mapping). */
  zoomPercent = computed(() => Math.round(this.view().scale * 100));

  fitToView() {
    if (!this.plan) return;
    const svg = this.svgRef.nativeElement;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const margin = this.fitMargin;
    const sx = (rect.width - margin * 2) / this.plan.pageWidth;
    const sy = (rect.height - margin * 2) / this.plan.pageHeight;
    const scale = Math.min(sx, sy);
    this.view.set({
      scale,
      tx: (rect.width - this.plan.pageWidth * scale) / 2,
      ty: (rect.height - this.plan.pageHeight * scale) / 2,
    });
  }

  /** Zoom to a specific percentage, centered. */
  zoomTo(percent: number) {
    if (!this.plan) return;
    const svg = this.svgRef.nativeElement;
    const rect = svg.getBoundingClientRect();
    const scale = percent / 100;
    this.view.set({
      scale,
      tx: (rect.width - this.plan.pageWidth * scale) / 2,
      ty: (rect.height - this.plan.pageHeight * scale) / 2,
    });
  }

  /** Zoom so the plan fills the viewport width. */
  zoomToWidth() {
    if (!this.plan) return;
    const rect = this.svgRef.nativeElement.getBoundingClientRect();
    if (rect.width === 0) return;
    const scale = rect.width / this.plan.pageWidth;
    this.view.set({
      scale,
      tx: 0,
      ty: (rect.height - this.plan.pageHeight * scale) / 2,
    });
  }

  /** Zoom so the plan fills the viewport height. */
  zoomToHeight() {
    if (!this.plan) return;
    const rect = this.svgRef.nativeElement.getBoundingClientRect();
    if (rect.height === 0) return;
    const scale = rect.height / this.plan.pageHeight;
    this.view.set({
      scale,
      tx: (rect.width - this.plan.pageWidth * scale) / 2,
      ty: 0,
    });
  }

  triggerFlash(ids: string[]) {
    this.flashIds.set(new Set(ids));
    setTimeout(() => this.flashIds.set(new Set()), 450);
  }

  // --- rendering helpers ---------------------------------------------------

  segPoints(seg: WallSegment): string {
    return seg.polygon.map((p) => `${p.x},${p.y}`).join(' ');
  }

  segColor(seg: WallSegment): string {
    let c = this.objectColorCache.get(seg.wallObjectId);
    if (!c) {
      c = PALETTE[this.colorIndex % PALETTE.length];
      this.colorIndex++;
      this.objectColorCache.set(seg.wallObjectId, c);
    }
    return c;
  }

  segStroke(seg: WallSegment): string {
    const fill = this.segColor(seg);
    // Darken the fill color slightly for the stroke.
    return fill;
  }

  floorPolyPoints(p: FloorPolygon): string {
    return p.points.map(([x, y]) => `${x},${y}`).join(' ');
  }
  draftPolyPoints(): string {
    return this.polygonDraft().map(([x, y]) => `${x},${y}`).join(' ');
  }

  mRect(m: { x1: number; y1: number; x2: number; y2: number }) {
    return {
      x: Math.min(m.x1, m.x2), y: Math.min(m.y1, m.y2),
      w: Math.abs(m.x2 - m.x1), h: Math.abs(m.y2 - m.y1),
    };
  }

  showDim(): boolean { return this._regions().length > 0; }

  /** Page rect + region rects; evenodd fill dims everything outside the regions. */
  dimPath(): string {
    const p = this.plan;
    if (!p) return '';
    let d = `M0 0 H${p.pageWidth} V${p.pageHeight} H0 Z`;
    for (const r of this._regions()) {
      d += ` M${r.x} ${r.y} H${r.x + r.w} V${r.y + r.h} H${r.x} Z`;
    }
    return d;
  }

  /** 4 corner + 4 edge handles for a region, in plan coords. */
  regionHandles(r: DetectRegion): Array<{ cx: number; cy: number; mode: string; cursor: string }> {
    const { x, y, w, h } = r;
    return [
      { cx: x,         cy: y,         mode: 'nw', cursor: 'nwse-resize' },
      { cx: x + w,     cy: y,         mode: 'ne', cursor: 'nesw-resize' },
      { cx: x,         cy: y + h,     mode: 'sw', cursor: 'nesw-resize' },
      { cx: x + w,     cy: y + h,     mode: 'se', cursor: 'nwse-resize' },
      { cx: x + w / 2, cy: y,         mode: 'n',  cursor: 'ns-resize' },
      { cx: x + w / 2, cy: y + h,     mode: 's',  cursor: 'ns-resize' },
      { cx: x,         cy: y + h / 2, mode: 'w',  cursor: 'ew-resize' },
      { cx: x + w,     cy: y + h / 2, mode: 'e',  cursor: 'ew-resize' },
    ];
  }

  onRegionHandleDown(ev: PointerEvent, index: number, mode: string) {
    if (this.tool !== 'region') return;
    ev.stopPropagation();
    const pt = this.clientToPlan(ev.clientX, ev.clientY);
    this.regionDrag = { index, mode, startX: pt.x, startY: pt.y, orig: { ...this._regions()[index] } };
    (ev.target as Element).setPointerCapture?.(ev.pointerId);
  }

  /** Apply a move/resize drag to a region, normalizing inverted edges. */
  private applyRegionDrag(o: DetectRegion, mode: string, dx: number, dy: number): DetectRegion {
    let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
    switch (mode) {
      case 'move': x1 += dx; y1 += dy; x2 += dx; y2 += dy; break;
      case 'nw': x1 += dx; y1 += dy; break;
      case 'ne': x2 += dx; y1 += dy; break;
      case 'sw': x1 += dx; y2 += dy; break;
      case 'se': x2 += dx; y2 += dy; break;
      case 'n': y1 += dy; break;
      case 's': y2 += dy; break;
      case 'w': x1 += dx; break;
      case 'e': x2 += dx; break;
    }
    const nx = Math.min(x1, x2), ny = Math.min(y1, y2);
    return { x: nx, y: ny, w: Math.max(1, Math.abs(x2 - x1)), h: Math.max(1, Math.abs(y2 - y1)) };
  }

  // --- pipette -------------------------------------------------------------

  private ensureRasterCanvas() {
    if (this.rasterLoaded || !this.plan?.rasterUrl) return;
    this.rasterLoaded = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      this.rasterCanvas = c; this.rasterCtx = ctx;
    };
    img.src = this.plan.rasterUrl;
  }

  private pickColorAt(px: number, py: number): [number, number, number] | null {
    if (!this.rasterCtx || !this.rasterCanvas || !this.plan) return null;
    const rx = (px / this.plan.pageWidth) * this.rasterCanvas.width;
    const ry = (py / this.plan.pageHeight) * this.rasterCanvas.height;
    if (rx < 0 || ry < 0 || rx >= this.rasterCanvas.width || ry >= this.rasterCanvas.height) return null;
    const d = this.rasterCtx.getImageData(Math.floor(rx), Math.floor(ry), 1, 1).data;
    return [d[0], d[1], d[2]];
  }

  // --- input handling ------------------------------------------------------

  @HostListener('window:keydown', ['$event'])
  onKeyDown(ev: KeyboardEvent) {
    if (isEditableTarget(ev.target)) return;
    if (ev.key === 'Escape') { this.polygonDraft.set([]); this.marquee.set(null); this.dragging = false; }
    if (ev.key === 'Enter' && this.tool === 'polygon' && this.polygonDraft().length >= 3) this.commitPolygon();
  }
  @HostListener('window:keyup', ['$event'])
  onKeyUp(_ev: KeyboardEvent) { }

  onWheel(ev: WheelEvent) {
    ev.preventDefault();
    const pt = this.clientToPlan(ev.clientX, ev.clientY);
    let d = ev.deltaY;
    if (ev.deltaMode === 1) d *= 33;
    else if (ev.deltaMode === 2) d *= 400;
    const f = Math.exp(-Math.max(-100, Math.min(100, d)) / 400);
    const v = this.view();
    const ns = Math.max(0.05, Math.min(50, v.scale * f));
    const r = this.svgRect();
    this.view.set({ scale: ns, tx: ev.clientX - r.left - pt.x * ns, ty: ev.clientY - r.top - pt.y * ns });
  }

  onPointerDown(ev: PointerEvent) {
    // Pan: pan tool or right mouse button.
    if (this.tool === 'pan' || ev.button === 2) {
      ev.preventDefault();
      this.beginPan(ev);
      return;
    }
    if (ev.button !== 0) return;
    if (this.tool === 'polygon') {
      const raw = this.clientToPlan(ev.clientX, ev.clientY);
      const snap = this.snapPoint(raw.x, raw.y);
      this.polyStart = snap;
      this.polyMoved = false;
      // Drag from an empty draft draws a rectangle; otherwise clicks add vertices.
      if (this.polygonDraft().length === 0) {
        this.marquee.set({ x1: snap.x, y1: snap.y, x2: snap.x, y2: snap.y });
      }
      (ev.target as Element).setPointerCapture?.(ev.pointerId);
      ev.stopPropagation(); return;
    }
    if (this.tool === 'pipette') {
      const pt = this.clientToPlan(ev.clientX, ev.clientY);
      const c = this.pickColorAt(pt.x, pt.y);
      if (c) this.colorPicked.emit(c);
      ev.stopPropagation(); return;
    }
    if (this.tool === 'object') {
      const pt = this.clientToPlan(ev.clientX, ev.clientY);
      this.placeObject.emit({ x: pt.x, y: pt.y });
      ev.stopPropagation(); return;
    }
    if (this.tool === 'floodfill') {
      const pt = this.clientToPlan(ev.clientX, ev.clientY);
      this.ffStart = { x: pt.x, y: pt.y };
      this.ffMoved = false;
      this.marquee.set({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
      (ev.target as Element).setPointerCapture?.(ev.pointerId);
      ev.stopPropagation(); return;
    }
    if (this.tool === 'select' || this.tool === 'region') {
      const pt = this.clientToPlan(ev.clientX, ev.clientY);
      this.marquee.set({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
      this.marqueeShift = ev.shiftKey;
      this.dragging = true;
      (ev.target as Element).setPointerCapture?.(ev.pointerId);
      return;
    }
  }

  onPointerMove(ev: PointerEvent) {
    if (this.regionDrag) {
      const pt = this.clientToPlan(ev.clientX, ev.clientY);
      const dx = pt.x - this.regionDrag.startX;
      const dy = pt.y - this.regionDrag.startY;
      const nr = this.applyRegionDrag(this.regionDrag.orig, this.regionDrag.mode, dx, dy);
      const idx = this.regionDrag.index;
      this._regions.update((list) => list.map((x, i) => (i === idx ? nr : x)));
      return;
    }
    if (this.panning) {
      const v = this.view();
      this.view.set({ scale: v.scale, tx: this.panStart.tx + (ev.clientX - this.panStart.x), ty: this.panStart.ty + (ev.clientY - this.panStart.y) });
      return;
    }
    if (this.polyStart) {
      const pt = this.clientToPlan(ev.clientX, ev.clientY);
      if (Math.hypot(pt.x - this.polyStart.x, pt.y - this.polyStart.y) * this.view().scale > 4) this.polyMoved = true;
      this.marquee.update((m) => m ? { ...m, x2: pt.x, y2: pt.y } : null);
      return;
    }
    if (this.ffStart) {
      const pt = this.clientToPlan(ev.clientX, ev.clientY);
      if (Math.hypot(pt.x - this.ffStart.x, pt.y - this.ffStart.y) * this.view().scale > 4) this.ffMoved = true;
      this.marquee.update((m) => m ? { ...m, x2: pt.x, y2: pt.y } : null);
      return;
    }
    if (this.dragging) {
      const pt = this.clientToPlan(ev.clientX, ev.clientY);
      this.marquee.update((m) => m ? { ...m, x2: pt.x, y2: pt.y } : null);
    }
  }

  onPointerUp(_ev?: PointerEvent) {
    if (this.polyStart) {
      const start = this.polyStart;
      this.polyStart = null;
      const m = this.marquee();
      this.marquee.set(null);
      // Drag from empty draft → rectangle floor (corners snapped to walls).
      if (this.polyMoved && this.polygonDraft().length === 0 && m) {
        const end = this.snapPoint(m.x2, m.y2);
        const x1 = Math.min(start.x, end.x), y1 = Math.min(start.y, end.y);
        const x2 = Math.max(start.x, end.x), y2 = Math.max(start.y, end.y);
        if ((x2 - x1) > 2 && (y2 - y1) > 2) {
          this.polygonCreated.emit({
            id: 'poly-' + Math.random().toString(36).slice(2, 10),
            points: [[x1, y1], [x2, y1], [x2, y2], [x1, y2]],
          });
        }
        return;
      }
      // Click → add a snapped vertex.
      this.polygonDraft.update((pts) => [...pts, [start.x, start.y]]);
      return;
    }
    if (this.ffStart) {
      const start = this.ffStart;
      this.ffStart = null;
      const m = this.marquee();
      this.marquee.set(null);
      if (this.ffMoved && m) {
        const r = this.mRect(m);
        if (r.w > 2 && r.h > 2) this.floodBlock.emit({ x: r.x, y: r.y, w: r.w, h: r.h });
      } else {
        this.floodFillAt.emit({ x: start.x, y: start.y });
      }
      return;
    }
    if (this.regionDrag) {
      this.regionDrag = null;
      this.regionsChange.emit(this._regions());
      return;
    }
    if (this.panning) { this.panning = false; return; }
    if (this.dragging) {
      this.dragging = false;
      const m = this.marquee();
      this.marquee.set(null);
      if (!m) return;
      // Region tool: a dragged rectangle becomes a detection ROI.
      if (this.tool === 'region') {
        const r = this.mRect(m);
        if (r.w >= 3 && r.h >= 3) {
          const next = [...this._regions(), { x: r.x, y: r.y, w: r.w, h: r.h }];
          this._regions.set(next);
          this.regionsChange.emit(next);
        }
        return;
      }
      if (Math.abs(m.x2 - m.x1) < 2 && Math.abs(m.y2 - m.y1) < 2) {
        this.emptyClick.emit({ tool: this.tool, shift: this.marqueeShift }); return;
      }
      const rx1 = Math.min(m.x1, m.x2), ry1 = Math.min(m.y1, m.y2);
      const rx2 = Math.max(m.x1, m.x2), ry2 = Math.max(m.y1, m.y2);
      const hits: string[] = [];
      for (const seg of this.plan?.wallSegments ?? []) {
        if (seg.polygon.every((p) => p.x >= rx1 && p.x <= rx2 && p.y >= ry1 && p.y <= ry2)) {
          hits.push(seg.id);
        }
      }
      if (hits.length > 0) this.rectSelect.emit({ segIds: hits, shift: this.marqueeShift });
      else this.emptyClick.emit({ tool: this.tool, shift: this.marqueeShift });
    }
  }

  onSegDown(ev: PointerEvent, seg: WallSegment) {
    if (this.tool === 'pan' || this.spaceDown()) return;
    ev.stopPropagation();
    this.dragging = false; this.marquee.set(null);
    this.clickSegment.emit({ seg, shift: ev.shiftKey });
  }

  onPlacemarkDown(ev: PointerEvent, pm: Placemark) {
    if (this.tool === 'pan' || this.spaceDown()) return;
    ev.stopPropagation();
    this.clickPlacemark.emit(pm);
  }

  isPolySelected(id: string): boolean { return this._selPoly() === id; }
  onPolygonDown(ev: PointerEvent, poly: FloorPolygon) {
    if (this.tool !== 'select') return;
    ev.stopPropagation();
    this.clickPolygon.emit(poly);
  }

  /** Snap a point to the nearest wall-segment corner within ~12 screen px. */
  private snapPoint(x: number, y: number): { x: number; y: number } {
    const p = this.plan;
    if (!p) return { x, y };
    const thr = 12 / this.view().scale;
    let best: { x: number; y: number } | null = null;
    let bestD = thr;
    for (const seg of p.wallSegments) {
      if (seg.excluded) continue;
      for (const v of seg.polygon) {
        const d = Math.hypot(v.x - x, v.y - y);
        if (d < bestD) { bestD = d; best = { x: v.x, y: v.y }; }
      }
    }
    return best ?? { x, y };
  }

  private beginPan(ev: PointerEvent) {
    this.panning = true;
    const v = this.view();
    this.panStart = { x: ev.clientX, y: ev.clientY, tx: v.tx, ty: v.ty };
    (ev.target as Element).setPointerCapture?.(ev.pointerId);
  }

  private commitPolygon() {
    const pts = this.polygonDraft();
    if (pts.length < 3) return;
    this.polygonDraft.set([]);
    this.polygonCreated.emit({ id: 'poly-' + Math.random().toString(36).slice(2, 10), points: pts.slice() });
  }

  private svgRect(): DOMRect { return this.svgRef.nativeElement.getBoundingClientRect(); }
  private clientToPlan(cx: number, cy: number) {
    const r = this.svgRect(); const v = this.view();
    return { x: (cx - r.left - v.tx) / v.scale, y: (cy - r.top - v.ty) / v.scale };
  }
}
