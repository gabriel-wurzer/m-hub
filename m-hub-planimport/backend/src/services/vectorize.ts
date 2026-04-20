// Raster → vector fallback for scanned PDFs.
//
// Pipeline:
//   1. Decode PNG to a grayscale opencv-wasm Mat.
//   2. Adaptive threshold → binary image where foreground = lines.
//   3. Morphological thinning to reduce stroke width.
//   4. Canny edge detection + probabilistic Hough line transform.
//   5. Merge near-duplicate / collinear segments.
//
// Coordinates are returned in the rasterized pixel space. The caller must
// divide by the raster `scale` to convert back to PDF user units so they are
// consistent with vector-path output from pdfExtract.ts.

import { cv as cvLib } from 'opencv-wasm';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import type { RawSegment } from './pdfExtract.js';

// opencv-wasm exposes its cv namespace via a promise on first require in some
// builds; normalize that here.
const cv: any = (cvLib as any).then ? null : cvLib;
async function getCv(): Promise<any> {
  if (cv) return cv;
  return await (cvLib as any);
}

export interface VectorizeResult {
  segments: RawSegment[];
  width: number;
  height: number;
}

export async function vectorizeRaster(pngBuffer: Buffer): Promise<VectorizeResult> {
  const cv = await getCv();

  // Decode PNG into an ImageData-compatible buffer via @napi-rs/canvas.
  const img = await loadImage(pngBuffer);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);

  const src = cv.matFromImageData({
    data: imageData.data,
    width: imageData.width,
    height: imageData.height,
  });

  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  // Adaptive threshold handles non-uniform scan lighting better than Otsu.
  const bin = new cv.Mat();
  cv.adaptiveThreshold(
    gray, bin, 255,
    cv.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv.THRESH_BINARY_INV,
    25, 10,
  );

  // Light morphological close to bridge tiny gaps in hand-drawn strokes.
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
  cv.morphologyEx(bin, bin, cv.MORPH_CLOSE, kernel);

  // Canny → Hough. opencv-wasm exposes HoughLinesP.
  const edges = new cv.Mat();
  cv.Canny(bin, edges, 50, 150, 3, false);

  const lines = new cv.Mat();
  cv.HoughLinesP(
    edges, lines,
    1,              // rho
    Math.PI / 180,  // theta
    60,             // threshold (min votes)
    30,             // minLineLength (px)
    10,             // maxLineGap (px)
  );

  const rawSegs: RawSegment[] = [];
  for (let i = 0; i < lines.rows; i++) {
    const x1 = lines.data32S[i * 4];
    const y1 = lines.data32S[i * 4 + 1];
    const x2 = lines.data32S[i * 4 + 2];
    const y2 = lines.data32S[i * 4 + 3];
    rawSegs.push({ x1, y1, x2, y2 });
  }

  src.delete();
  gray.delete();
  bin.delete();
  kernel.delete();
  edges.delete();
  lines.delete();

  return {
    segments: mergeCollinear(rawSegs, 3, (2 * Math.PI) / 180),
    width: img.width,
    height: img.height,
  };
}

/**
 * Merges segments that are (a) nearly collinear and (b) overlap or are close
 * along their common direction. Uses a simple O(n^2) sweep — fine for a few
 * thousand Hough lines per page.
 */
function mergeCollinear(
  segs: RawSegment[],
  distTol: number,
  angleTol: number,
): RawSegment[] {
  const merged: RawSegment[] = [];
  const used = new Array<boolean>(segs.length).fill(false);

  const angle = (s: RawSegment) => Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
  const lineDist = (s: RawSegment, px: number, py: number) => {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    const len = Math.hypot(dx, dy) || 1;
    return Math.abs((py - s.y1) * dx - (px - s.x1) * dy) / len;
  };

  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    let acc = { ...segs[i] };
    used[i] = true;
    const ai = angle(acc);

    for (let j = i + 1; j < segs.length; j++) {
      if (used[j]) continue;
      const aj = angle(segs[j]);
      let da = Math.abs(ai - aj);
      if (da > Math.PI / 2) da = Math.PI - da;
      if (da > angleTol) continue;
      if (
        lineDist(acc, segs[j].x1, segs[j].y1) > distTol ||
        lineDist(acc, segs[j].x2, segs[j].y2) > distTol
      ) continue;

      // Project all four endpoints onto the direction of `acc` and keep the
      // extremes. This grows the merged segment along its own axis.
      const dx = acc.x2 - acc.x1, dy = acc.y2 - acc.y1;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const project = (x: number, y: number) =>
        (x - acc.x1) * ux + (y - acc.y1) * uy;
      const candidates = [
        { t: 0, x: acc.x1, y: acc.y1 },
        { t: project(acc.x2, acc.y2), x: acc.x2, y: acc.y2 },
        { t: project(segs[j].x1, segs[j].y1), x: segs[j].x1, y: segs[j].y1 },
        { t: project(segs[j].x2, segs[j].y2), x: segs[j].x2, y: segs[j].y2 },
      ];
      candidates.sort((a, b) => a.t - b.t);
      acc = {
        x1: candidates[0].x,
        y1: candidates[0].y,
        x2: candidates[candidates.length - 1].x,
        y2: candidates[candidates.length - 1].y,
      };
      used[j] = true;
    }
    merged.push(acc);
  }
  return merged;
}
