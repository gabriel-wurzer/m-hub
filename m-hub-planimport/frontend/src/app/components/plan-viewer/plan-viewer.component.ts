import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy,
  EventEmitter, HostListener, Input, Output, ViewChild, computed, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FloorPolygon, PlanDoc, WallSegment } from '../../models/plan.model';

export type ViewerTool = 'pan' | 'select' | 'exclude' | 'polygon' | 'pipette';

interface ViewState { scale: number; tx: number; ty: number; }

// Distinct palette for wallObjectId groups.
const PALETTE = [
  '#179bde', '#43a047', '#e66c1a', '#8e24aa', '#00897b',
  '#d81b60', '#5e35b1', '#1e88e5', '#00acc1', '#7cb342',
  '#f4511e', '#3949ab', '#039be5', '#c0ca33', '#6d4c41',
];

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
                     fill="var(--polygon-fill)"
                     stroke="var(--polygon-stroke)"
                     [attr.stroke-width]="1.2 / view().scale" />
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
                       [attr.filter]="isSelected(seg.id) ? 'url(#sel-glow)' : null"
                       pointer-events="fill"
                       style="cursor: pointer"
                       (pointerdown)="onSegDown($event, seg)" />
              <!-- Invisible wider hit-test overlay for thin segments -->
              <polygon [attr.points]="segPoints(seg)"
                       fill="transparent"
                       stroke="transparent"
                       [attr.stroke-width]="10 / view().scale"
                       pointer-events="stroke"
                       style="cursor: pointer"
                       (pointerdown)="onSegDown($event, seg)" />
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
        }
      </g>
    </svg>
  `,
  styles: [`
    :host { display: block; flex: 1; min-height: 0; min-width: 0; position: relative; }
    .viewer { width: 100%; height: 100%; background: #eceff1; user-select: none; touch-action: none; }
    .wall-seg { fill-opacity: 0.40; transition: fill-opacity 0.15s; }
    .wall-seg:hover { fill-opacity: 0.55; }
    .wall-seg.selected { fill: #ffab00 !important; fill-opacity: 0.65; stroke: #e65100 !important; }
    .wall-seg.excluded { fill-opacity: 1; }
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

  @Output() clickSegment = new EventEmitter<{ seg: WallSegment; shift: boolean }>();
  @Output() rectSelect = new EventEmitter<{ segIds: string[]; shift: boolean }>();
  @Output() colorPicked = new EventEmitter<[number, number, number]>();
  @Output() polygonCreated = new EventEmitter<FloorPolygon>();
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

  // Pipette raster canvas.
  private rasterCanvas: HTMLCanvasElement | null = null;
  private rasterCtx: CanvasRenderingContext2D | null = null;
  private rasterLoaded = false;

  selectionSet = computed(() => new Set(this._selection()));
  isSelected(id: string): boolean { return this.selectionSet().has(id); }

  // wallObjectId → palette color mapping.
  private objectColorCache = new Map<string, string>();
  private colorIndex = 0;

  activeCursor = computed(() => {
    if (this.panning) return 'grabbing';
    const map: Record<ViewerTool, string> = {
      'pan': 'grab', 'select': 'crosshair', 'exclude': 'crosshair',
      'polygon': 'crosshair', 'pipette': 'crosshair',
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
      const pt = this.clientToPlan(ev.clientX, ev.clientY);
      this.polygonDraft.update((pts) => [...pts, [pt.x, pt.y]]);
      ev.stopPropagation(); return;
    }
    if (this.tool === 'pipette') {
      const pt = this.clientToPlan(ev.clientX, ev.clientY);
      const c = this.pickColorAt(pt.x, pt.y);
      if (c) this.colorPicked.emit(c);
      ev.stopPropagation(); return;
    }
    if (this.tool === 'select' || this.tool === 'exclude') {
      const pt = this.clientToPlan(ev.clientX, ev.clientY);
      this.marquee.set({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
      this.marqueeShift = ev.shiftKey;
      this.dragging = true;
      (ev.target as Element).setPointerCapture?.(ev.pointerId);
      return;
    }
  }

  onPointerMove(ev: PointerEvent) {
    if (this.panning) {
      const v = this.view();
      this.view.set({ scale: v.scale, tx: this.panStart.tx + (ev.clientX - this.panStart.x), ty: this.panStart.ty + (ev.clientY - this.panStart.y) });
      return;
    }
    if (this.dragging) {
      const pt = this.clientToPlan(ev.clientX, ev.clientY);
      this.marquee.update((m) => m ? { ...m, x2: pt.x, y2: pt.y } : null);
    }
  }

  onPointerUp(_ev?: PointerEvent) {
    if (this.panning) { this.panning = false; return; }
    if (this.dragging) {
      this.dragging = false;
      const m = this.marquee();
      this.marquee.set(null);
      if (!m) return;
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
