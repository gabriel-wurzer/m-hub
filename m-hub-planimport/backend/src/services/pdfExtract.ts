// Vector-path extraction from a PDF page via pdfjs-dist.
//
// Strategy: walk the operator list for each page, accumulate a current path
// from moveTo/lineTo/curveTo/rectangle ops, and when a paint op (stroke/fill)
// is hit, flatten the path into straight line segments in device (page) space.
//
// Bezier curves are flattened with adaptive subdivision. This is sufficient
// for architectural CAD exports where walls are almost always straight lines,
// and where any curved elements (arcs, door swings) will anyway get filtered
// or manually excluded by the user later.

import { OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pdfjsLib, NapiCanvasFactory } from './pdfjsSetup.js';

export interface RawSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Stroke line width in PDF user units at the time of emission. */
  lineWidth?: number;
  /** What paint op emitted this segment: stroke / fill / both. */
  paint?: 'stroke' | 'fill' | 'fillStroke';
  /** Stroke color as [r, g, b] in 0–1 range. */
  strokeColor?: [number, number, number];
  /** Fill color as [r, g, b] in 0–1 range (for fill/fillStroke ops). */
  fillColor?: [number, number, number];
}

/**
 * A filled subpath extracted from the PDF — the outline of a fill or
 * fill+stroke paint op. Many CAD exports draw walls as filled rectangular
 * polygons, so these are the best raw material for wall detection.
 *
 * Points are in the same screen-space coordinate system as RawSegment
 * (viewport-transformed, top-left origin).
 */
export interface RawPolygon {
  points: Array<[number, number]>;
  paint: 'fill' | 'fillStroke';
  /** Fill color as [r, g, b] in 0–1 range, if known. */
  fillColor?: [number, number, number];
}

export interface PdfVectorResult {
  kind: 'vector';
  pageWidth: number;
  pageHeight: number;
  segments: RawSegment[];
  polygons: RawPolygon[];
}

export interface PdfEmptyResult {
  kind: 'empty';
  pageWidth: number;
  pageHeight: number;
}

export async function extractVectorsFromPdf(
  pdfBuffer: Buffer,
  pageIndex = 0,
): Promise<PdfVectorResult | PdfEmptyResult> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    // Disable font fetching — we don't render text, only geometry.
    disableFontFace: true,
    useSystemFonts: false,
    isEvalSupported: false,
    canvasFactory: new NapiCanvasFactory(),
  } as any);
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: 1 });

  const opList = await page.getOperatorList();
  const segments: RawSegment[] = [];
  const polygons: RawPolygon[] = [];

  // --- Coordinate-transform handling --------------------------------------
  // PDFs maintain a current transformation matrix (CTM) manipulated by
  // `q` (save) / `Q` (restore) / `cm` (concat). We must track it ourselves
  // because path ops emit raw user-space coordinates — the CTM is what
  // translates them into device space where the raster also ends up.
  //
  // At the end we additionally apply pdfjs's viewport transform which maps
  // PDF bottom-left origin → screen top-left, giving us coordinates that
  // align with the rasterized PNG (which was rendered through the same
  // viewport).
  //
  // PDF matrices are [a b c d e f], representing
  //   | a  b  0 |
  //   | c  d  0 |
  //   | e  f  1 |
  // Point transform: x' = a*x + c*y + e,  y' = b*x + d*y + f
  type Mat = [number, number, number, number, number, number];
  const IDENT: Mat = [1, 0, 0, 1, 0, 0];
  const stack: Mat[] = [];
  let ctm: Mat = [...IDENT];
  const multiply = (m1: Mat, m2: Mat): Mat => [
    m1[0] * m2[0] + m1[1] * m2[2],
    m1[0] * m2[1] + m1[1] * m2[3],
    m1[2] * m2[0] + m1[3] * m2[2],
    m1[2] * m2[1] + m1[3] * m2[3],
    m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
    m1[4] * m2[1] + m1[5] * m2[3] + m2[5],
  ];
  // The viewport transform is already a flat 6-number matrix compatible
  // with the above representation — pdfjs applies it as the outermost
  // transform when rendering. Apply the same here so coordinates end up in
  // the same space as the rendered raster.
  const vpTransform: Mat = viewport.transform as unknown as Mat;
  console.log('[pdfExtract] viewport.transform =', vpTransform, 'page size =', viewport.width, viewport.height);

  const apply = (m: Mat, x: number, y: number): [number, number] => [
    m[0] * x + m[2] * y + m[4],
    m[1] * x + m[3] * y + m[5],
  ];

  // Current path accumulator. Points are stored in *user space* (pre-CTM);
  // we apply the CTM and the viewport transform at flush time, which matches
  // how PDFs are supposed to be interpreted: the path is defined in the CTM
  // that was active when each path op was emitted. Because pdfjs batches
  // path ops inside constructPath with a CTM that doesn't change mid-path,
  // capturing the CTM at flush time is equivalent.
  let subpaths: Array<Array<[number, number]>> = [];
  let current: Array<[number, number]> = [];
  // Snapshot of the CTM when the current path began (set on first move/op).
  let pathCtm: Mat = [...IDENT];
  let pathStarted = false;

  const ensurePathCtm = () => {
    if (!pathStarted) {
      pathCtm = [...ctm];
      pathStarted = true;
    }
  };

  // Track graphics state.
  let lineWidth = 1;
  const lwStack: number[] = [];
  let fillColor: [number, number, number] = [0, 0, 0];
  const fillColorStack: Array<[number, number, number]> = [];
  let strokeColor: [number, number, number] = [0, 0, 0];
  const strokeColorStack: Array<[number, number, number]> = [];

  const flushPathAsSegments = (paint: 'stroke' | 'fill' | 'fillStroke') => {
    const full = multiply(pathCtm, vpTransform);
    // Effective stroke width after CTM + viewport scale.
    const scaleX = Math.hypot(full[0], full[1]);
    const scaleY = Math.hypot(full[2], full[3]);
    const effLw = lineWidth * (scaleX + scaleY) / 2;

    // For filled subpaths, also emit each closed subpath as a RawPolygon.
    // These are the best candidates for wall detection because most CAD
    // exports draw walls as filled rectangular polygons.
    const isFilled = paint === 'fill' || paint === 'fillStroke';

    for (const sp of subpaths) {
      // Emit segments (for the viewer and for stroke-based pipelines).
      for (let i = 1; i < sp.length; i++) {
        const [ux1, uy1] = sp[i - 1];
        const [ux2, uy2] = sp[i];
        const [x1, y1] = apply(full, ux1, uy1);
        const [x2, y2] = apply(full, ux2, uy2);
        if (Math.abs(x1 - x2) < 1e-6 && Math.abs(y1 - y2) < 1e-6) continue;
        segments.push({
          x1, y1, x2, y2, lineWidth: effLw, paint,
          strokeColor: [...strokeColor],
          fillColor: isFilled ? [...fillColor] : undefined,
        });
      }
      // Emit filled subpaths as polygons (transformed).
      if (isFilled && sp.length >= 3) {
        const pts: Array<[number, number]> = sp.map(([ux, uy]) => apply(full, ux, uy));
        polygons.push({
          points: pts,
          paint: paint as 'fill' | 'fillStroke',
          fillColor: [...fillColor],
        });
      }
    }
    subpaths = [];
    current = [];
    pathStarted = false;
  };

  const startSubpath = (x: number, y: number) => {
    ensurePathCtm();
    if (current.length) subpaths.push(current);
    current = [[x, y]];
  };

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];

    switch (fn) {
      case OPS.constructPath: {
        // pdfjs batches path construction: args = [opsArray, pointsArray, ...]
        // See: pdfjs-dist/src/display/canvas.js constructPath handling.
        ensurePathCtm();
        const ops: number[] = args[0];
        const pts: number[] = args[1];
        let p = 0;
        for (const pop of ops) {
          switch (pop) {
            case OPS.moveTo: {
              const x = pts[p++];
              const y = pts[p++];
              startSubpath(x, y);
              break;
            }
            case OPS.lineTo: {
              const x = pts[p++];
              const y = pts[p++];
              if (!current.length) current.push([x, y]);
              else current.push([x, y]);
              break;
            }
            case OPS.curveTo: {
              // Cubic Bezier: c1, c2, end
              const c1x = pts[p++], c1y = pts[p++];
              const c2x = pts[p++], c2y = pts[p++];
              const ex = pts[p++], ey = pts[p++];
              const start = current[current.length - 1] ?? [ex, ey];
              flattenCubic(start[0], start[1], c1x, c1y, c2x, c2y, ex, ey, current);
              break;
            }
            case OPS.curveTo2: {
              // Quadratic-ish shortcut; treat as cubic with duplicated control.
              const c2x = pts[p++], c2y = pts[p++];
              const ex = pts[p++], ey = pts[p++];
              const start = current[current.length - 1] ?? [ex, ey];
              flattenCubic(start[0], start[1], start[0], start[1], c2x, c2y, ex, ey, current);
              break;
            }
            case OPS.curveTo3: {
              const c1x = pts[p++], c1y = pts[p++];
              const ex = pts[p++], ey = pts[p++];
              const start = current[current.length - 1] ?? [ex, ey];
              flattenCubic(start[0], start[1], c1x, c1y, ex, ey, ex, ey, current);
              break;
            }
            case OPS.closePath: {
              if (current.length > 1) current.push([current[0][0], current[0][1]]);
              break;
            }
            case OPS.rectangle: {
              const x = pts[p++];
              const y = pts[p++];
              const w = pts[p++];
              const h = pts[p++];
              if (current.length) subpaths.push(current);
              current = [
                [x, y],
                [x + w, y],
                [x + w, y + h],
                [x, y + h],
                [x, y],
              ];
              subpaths.push(current);
              current = [];
              break;
            }
          }
        }
        break;
      }

      case OPS.moveTo: {
        startSubpath(args[0], args[1]);
        break;
      }
      case OPS.lineTo: {
        ensurePathCtm();
        current.push([args[0], args[1]]);
        break;
      }
      case OPS.rectangle: {
        ensurePathCtm();
        const [x, y, w, h] = args;
        if (current.length) subpaths.push(current);
        subpaths.push([
          [x, y],
          [x + w, y],
          [x + w, y + h],
          [x, y + h],
          [x, y],
        ]);
        current = [];
        break;
      }
      case OPS.closePath: {
        if (current.length > 1) current.push([current[0][0], current[0][1]]);
        break;
      }

      // --- CTM ops ---------------------------------------------------------
      case OPS.save: {
        stack.push([...ctm]);
        lwStack.push(lineWidth);
        fillColorStack.push([...fillColor]);
        strokeColorStack.push([...strokeColor]);
        break;
      }
      case OPS.restore: {
        const popped = stack.pop();
        if (popped) ctm = popped;
        const lwp = lwStack.pop();
        if (lwp !== undefined) lineWidth = lwp;
        const fcp = fillColorStack.pop();
        if (fcp) fillColor = fcp;
        const scp = strokeColorStack.pop();
        if (scp) strokeColor = scp;
        break;
      }
      case OPS.transform: {
        const m: Mat = [args[0], args[1], args[2], args[3], args[4], args[5]];
        ctm = multiply(m, ctm);
        break;
      }
      case OPS.setLineWidth: {
        lineWidth = args[0];
        break;
      }
      // --- Fill color tracking -----------------------------------------------
      // --- Stroke color tracking -----------------------------------------------
      case OPS.setStrokeRGBColor: {
        const r = args[0], g = args[1], b = args[2];
        strokeColor = r > 1 || g > 1 || b > 1
          ? [r / 255, g / 255, b / 255]
          : [r, g, b];
        break;
      }
      case OPS.setStrokeGray: {
        let g = args[0];
        if (g > 1) g /= 255;
        strokeColor = [g, g, g];
        break;
      }
      case OPS.setStrokeCMYKColor: {
        const [c, m, y, k] = args;
        strokeColor = [
          (1 - c) * (1 - k),
          (1 - m) * (1 - k),
          (1 - y) * (1 - k),
        ];
        break;
      }
      // --- Fill color tracking -----------------------------------------------
      case OPS.setFillRGBColor: {
        // pdfjs may pass 0–1 or 0–255 depending on the color space.
        // Normalize to 0–1.
        const r = args[0], g = args[1], b = args[2];
        fillColor = r > 1 || g > 1 || b > 1
          ? [r / 255, g / 255, b / 255]
          : [r, g, b];
        break;
      }
      case OPS.setFillGray: {
        let g = args[0];
        if (g > 1) g /= 255;
        fillColor = [g, g, g];
        break;
      }
      case OPS.setFillCMYKColor: {
        const [c, m, y, k] = args;
        fillColor = [
          (1 - c) * (1 - k),
          (1 - m) * (1 - k),
          (1 - y) * (1 - k),
        ];
        break;
      }

      case OPS.stroke:
      case OPS.closeStroke: {
        if (current.length) subpaths.push(current);
        flushPathAsSegments('stroke');
        break;
      }
      case OPS.fillStroke:
      case OPS.eoFillStroke:
      case OPS.closeFillStroke:
      case OPS.closeEOFillStroke: {
        if (current.length) subpaths.push(current);
        flushPathAsSegments('fillStroke');
        break;
      }
      case OPS.fill:
      case OPS.eoFill: {
        // Keep filled outlines too — they often describe wall hatching / rooms.
        if (current.length) subpaths.push(current);
        flushPathAsSegments('fill');
        break;
      }
      case OPS.endPath: {
        subpaths = [];
        current = [];
        break;
      }
    }
  }

  await pdf.cleanup();
  await pdf.destroy();

  // Debug summary: distribution of line widths and paint ops. This lets us
  // diagnose which drawing style the plan uses (thin double-lines vs thick
  // single lines vs filled polygons).
  const lwHist = new Map<string, number>();
  const paintHist = new Map<string, number>();
  for (const s of segments) {
    const lwKey = (s.lineWidth ?? 0).toFixed(2);
    lwHist.set(lwKey, (lwHist.get(lwKey) ?? 0) + 1);
    const pk = s.paint ?? '?';
    paintHist.set(pk, (paintHist.get(pk) ?? 0) + 1);
  }
  const topLw = [...lwHist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  // Stroke color histogram (only for stroked segments).
  const strokeColorHist = new Map<string, number>();
  for (const s of segments) {
    if (s.paint === 'stroke' && s.strokeColor) {
      const k = s.strokeColor.map((c) => c.toFixed(2)).join(',');
      strokeColorHist.set(k, (strokeColorHist.get(k) ?? 0) + 1);
    }
  }
  const topStrokeColors = [...strokeColorHist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log('[pdfExtract] total segments =', segments.length);
  console.log('[pdfExtract] paint op histogram =', Object.fromEntries(paintHist));
  console.log('[pdfExtract] top-10 line widths =', topLw);
  console.log('[pdfExtract] top stroke colors =', topStrokeColors);

  // Fill color histogram on polygons.
  const colorHist = new Map<string, number>();
  for (const p of polygons) {
    const k = p.fillColor ? p.fillColor.map((c) => c.toFixed(2)).join(',') : '?';
    colorHist.set(k, (colorHist.get(k) ?? 0) + 1);
  }
  const topColors = [...colorHist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log('[pdfExtract] filled polygons =', polygons.length);
  console.log('[pdfExtract] top polygon fill colors =', topColors);

  if (segments.length === 0) {
    return { kind: 'empty', pageWidth: viewport.width, pageHeight: viewport.height };
  }

  return {
    kind: 'vector',
    pageWidth: viewport.width,
    pageHeight: viewport.height,
    segments: dedupeSegments(segments),
    polygons,
  };
}

// Adaptive flattening of a cubic Bezier into polyline points.
// Pushes points onto `out` (including the end point, not the start).
function flattenCubic(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  out: Array<[number, number]>,
  tol = 0.5,
) {
  // Flatness test: max distance from control points to the chord.
  const dx = x3 - x0;
  const dy = y3 - y0;
  const len2 = dx * dx + dy * dy || 1;
  const d1 = Math.abs((x1 - x0) * dy - (y1 - y0) * dx) / Math.sqrt(len2);
  const d2 = Math.abs((x2 - x0) * dy - (y2 - y0) * dx) / Math.sqrt(len2);
  if (Math.max(d1, d2) <= tol) {
    out.push([x3, y3]);
    return;
  }
  // Subdivide (de Casteljau).
  const mx01 = (x0 + x1) / 2, my01 = (y0 + y1) / 2;
  const mx12 = (x1 + x2) / 2, my12 = (y1 + y2) / 2;
  const mx23 = (x2 + x3) / 2, my23 = (y2 + y3) / 2;
  const mx012 = (mx01 + mx12) / 2, my012 = (my01 + my12) / 2;
  const mx123 = (mx12 + mx23) / 2, my123 = (my12 + my23) / 2;
  const mx0123 = (mx012 + mx123) / 2, my0123 = (my012 + my123) / 2;
  flattenCubic(x0, y0, mx01, my01, mx012, my012, mx0123, my0123, out, tol);
  flattenCubic(mx0123, my0123, mx123, my123, mx23, my23, x3, y3, out, tol);
}

// Drops exact-duplicate segments (common in CAD exports where hatching layers
// re-emit the same wall outline). Cheap O(n) via string key.
function dedupeSegments(segs: RawSegment[]): RawSegment[] {
  const seen = new Set<string>();
  const out: RawSegment[] = [];
  for (const s of segs) {
    const k1 = `${s.x1.toFixed(3)},${s.y1.toFixed(3)}|${s.x2.toFixed(3)},${s.y2.toFixed(3)}`;
    const k2 = `${s.x2.toFixed(3)},${s.y2.toFixed(3)}|${s.x1.toFixed(3)},${s.y1.toFixed(3)}`;
    if (seen.has(k1) || seen.has(k2)) continue;
    seen.add(k1);
    out.push(s);
  }
  return out;
}
