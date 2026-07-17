// Wall segmentation pipeline: color mask → distance transform → local maxima
// → watershed → polygon extraction.
//
// Produces over-segmented WallSegment polygons. The user merges them
// downstream by assigning shared wallObjectIds.

import { nanoid } from 'nanoid';
import { createRequire } from 'node:module';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const require = createRequire(import.meta.url);
const { cv } = require('opencv-wasm');

// Verify critical functions exist at import time.
for (const fn of [
  'inRange', 'morphologyEx', 'distanceTransform', 'dilate',
  'connectedComponents', 'watershed', 'findContours', 'minAreaRect',
  'getStructuringElement', 'threshold', 'cvtColor', 'bitwise_or',
  'bitwise_and', 'compare',
]) {
  if (typeof cv[fn] !== 'function') {
    throw new Error(`opencv-wasm missing required function: cv.${fn}`);
  }
}

export interface RasterWallSegment {
  id: string;
  polygon: Array<{ x: number; y: number }>;
  measuredThickness: number;
}

export interface DetectOptions {
  wallColors: Array<[number, number, number]>;
  tolerance: number;
  rasterScale: number;
  mmPerUnit: number;
  /** Min segment area in mm². Segments smaller than this are discarded. */
  minAreaMm2: number;
  /** Max plausible wall thickness in mm. Anything thicker is not a wall. Default: 800. */
  maxThicknessMm: number;
  /**
   * Optional detection regions-of-interest, in plan units. When present,
   * everything outside their union is masked out before segmentation — cuts
   * false positives from dimension lines / title blocks and speeds up the
   * heavy watershed + contour passes. Empty/absent = whole page.
   */
  regions?: Array<{ x: number; y: number; w: number; h: number }>;
}

export async function detectWallSegments(
  pngBuffer: Buffer,
  opts: DetectOptions,
): Promise<RasterWallSegment[]> {
  const t0 = Date.now();
  const pxPerMm = opts.rasterScale / opts.mmPerUnit;

  // ===== 1. Decode PNG =====================================================
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
  const rgb = new cv.Mat();
  cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
  src.delete();
  console.log(`[walls] 1-decode ${Date.now() - t0}ms ${img.width}x${img.height} pxPerMm=${pxPerMm.toFixed(3)}`);

  // ===== 2. Color mask =====================================================
  const t1 = Date.now();
  let mask = cv.Mat.zeros(rgb.rows, rgb.cols, cv.CV_8UC1);
  for (const [r, g, b] of opts.wallColors) {
    const tol = opts.tolerance;
    const lower = new cv.Mat(rgb.rows, rgb.cols, rgb.type(), [
      Math.max(0, r - tol), Math.max(0, g - tol), Math.max(0, b - tol), 0,
    ]);
    const upper = new cv.Mat(rgb.rows, rgb.cols, rgb.type(), [
      Math.min(255, r + tol), Math.min(255, g + tol), Math.min(255, b + tol), 255,
    ]);
    const m = new cv.Mat();
    cv.inRange(rgb, lower, upper, m);
    cv.bitwise_or(mask, m, mask);
    lower.delete(); upper.delete(); m.delete();
  }
  rgb.delete();
  console.log(`[walls] 2-mask ${Date.now() - t1}ms`);

  // ===== 2b. Restrict to detection regions (ROI) ==========================
  // Zero out everything outside the union of user-drawn rectangles. Region
  // coords are in plan units; raster px = plan * rasterScale.
  if (opts.regions && opts.regions.length > 0) {
    const roi = cv.Mat.zeros(mask.rows, mask.cols, cv.CV_8UC1);
    for (const rg of opts.regions) {
      const x1 = Math.max(0, Math.round(rg.x * opts.rasterScale));
      const y1 = Math.max(0, Math.round(rg.y * opts.rasterScale));
      const x2 = Math.min(mask.cols, Math.round((rg.x + rg.w) * opts.rasterScale));
      const y2 = Math.min(mask.rows, Math.round((rg.y + rg.h) * opts.rasterScale));
      if (x2 <= x1 || y2 <= y1) continue;
      const sub = roi.roi(new cv.Rect(x1, y1, x2 - x1, y2 - y1));
      sub.setTo(new cv.Scalar(255));
      sub.delete();
    }
    cv.bitwise_and(mask, roi, mask);
    roi.delete();
    console.log(`[walls] 2b-roi ${opts.regions.length} region(s)`);
  }

  // ===== 3. Morphological close (fill small gaps in wall outlines) =========
  const t2 = Date.now();
  const closeK = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
  cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, closeK);
  closeK.delete();
  console.log(`[walls] 3-close ${Date.now() - t2}ms`);

  // ===== 4. Distance transform =============================================
  const t3 = Date.now();
  const dist = new cv.Mat();
  cv.distanceTransform(mask, dist, cv.DIST_L2, 5);
  console.log(`[walls] 4-dist ${Date.now() - t3}ms`);

  // ===== 5. Local maxima via dilate+compare ================================
  // dilated = dilate(dist, kernel)
  // peaks = (dist == dilated) AND (dist > threshold)
  // This finds ridge pixels — the medial axis of each wall — without any
  // JS pixel loops. Pure opencv-wasm operations.
  const t4 = Date.now();
  const dilateK = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(7, 7));
  const dilated = new cv.Mat();
  cv.dilate(dist, dilated, dilateK);
  dilateK.delete();

  // compare: dist == dilated → peaks where the pixel is a local max.
  const peaksMask = new cv.Mat();
  cv.compare(dist, dilated, peaksMask, cv.CMP_GE);
  dilated.delete();

  // Also require dist > minThreshold (eliminate noise in flat regions).
  // Threshold at 1px = thinnest detectable feature.
  const distThresh = new cv.Mat();
  cv.threshold(dist, distThresh, 1.0, 255, cv.THRESH_BINARY);
  const distThresh8 = new cv.Mat();
  distThresh.convertTo(distThresh8, cv.CV_8UC1);
  distThresh.delete();

  cv.bitwise_and(peaksMask, distThresh8, peaksMask);
  distThresh8.delete();
  console.log(`[walls] 5-peaks ${Date.now() - t4}ms`);

  // ===== 6. Connected components on peaks → markers for watershed ==========
  const t5 = Date.now();
  const markers32 = new cv.Mat();
  const numLabels = cv.connectedComponents(peaksMask, markers32);
  peaksMask.delete();
  console.log(`[walls] 6-components ${numLabels - 1} markers, ${Date.now() - t5}ms`);

  // ===== 7. Watershed ======================================================
  const t6 = Date.now();
  // watershed requires: 8UC3 input image, 32SC1 markers.
  // We use the mask as a synthetic "image" — convert to 3-channel.
  const mask3ch = new cv.Mat();
  cv.cvtColor(mask, mask3ch, cv.COLOR_GRAY2RGB);
  mask.delete();

  // markers32 is already CV_32SC1 from connectedComponents.
  cv.watershed(mask3ch, markers32);
  mask3ch.delete();
  console.log(`[walls] 7-watershed ${Date.now() - t6}ms`);

  // ===== 8. Extract contours per watershed label ===========================
  // Instead of creating per-label full-image Mats (slow for 355 labels),
  // scan the markers image ONCE to build a bounding box per label, then
  // process only the ROI.
  const t7 = Date.now();
  const minAreaPx = opts.minAreaMm2 * (pxPerMm * pxPerMm);
  const segments: RasterWallSegment[] = [];
  let discarded = 0;

  // Pass 1: compute bounding box per label via markers data.
  const rows = markers32.rows, cols = markers32.cols;
  const bboxes = new Map<number, { x1: number; y1: number; x2: number; y2: number }>();
  const data32 = markers32.data32S;
  for (let r = 0; r < rows; r++) {
    const rowOff = r * cols;
    for (let c = 0; c < cols; c++) {
      const label = data32[rowOff + c];
      if (label <= 0) continue; // 0=bg, -1=boundary
      const bb = bboxes.get(label);
      if (bb) {
        if (c < bb.x1) bb.x1 = c;
        if (c > bb.x2) bb.x2 = c;
        if (r < bb.y1) bb.y1 = r;
        if (r > bb.y2) bb.y2 = r;
      } else {
        bboxes.set(label, { x1: c, y1: r, x2: c, y2: r });
      }
    }
  }
  console.log(`[walls] 8a-bbox scan ${bboxes.size} labels, ${Date.now() - t7}ms`);

  // Pass 2: for each label, extract a small ROI mask and find contours.
  const t7b = Date.now();
  for (const [label, bb] of bboxes) {
    const w = bb.x2 - bb.x1 + 1;
    const h = bb.y2 - bb.y1 + 1;
    if (w * h < minAreaPx) { discarded++; continue; }

    // Build a small mask for this label's ROI.
    const roiMask = new cv.Mat(h, w, cv.CV_8UC1);
    const roiData = roiMask.data;
    for (let r = 0; r < h; r++) {
      const srcRow = (bb.y1 + r) * cols;
      const dstRow = r * w;
      for (let c = 0; c < w; c++) {
        roiData[dstRow + c] = data32[srcRow + bb.x1 + c] === label ? 255 : 0;
      }
    }

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(roiMask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    roiMask.delete();

    if (contours.size() === 0) { contours.delete(); hierarchy.delete(); continue; }

    let maxIdx = 0, maxArea = 0;
    for (let ci = 0; ci < contours.size(); ci++) {
      const a = cv.contourArea(contours.get(ci));
      if (a > maxArea) { maxArea = a; maxIdx = ci; }
    }
    if (maxArea < minAreaPx) { discarded++; contours.delete(); hierarchy.delete(); continue; }

    const contour = contours.get(maxIdx);
    const cdata = contour.data32S;

    // Extract polygon, offsetting from ROI back to full image coords, then to PDF.
    const points: Array<{ x: number; y: number }> = [];
    for (let p = 0; p < cdata.length; p += 2) {
      points.push({
        x: (cdata[p] + bb.x1) / opts.rasterScale,
        y: (cdata[p + 1] + bb.y1) / opts.rasterScale,
      });
    }

    // Thickness: sample distance transform at the center of the ROI.
    const cx = Math.round(bb.x1 + w / 2);
    const cy = Math.round(bb.y1 + h / 2);
    let thicknessPx = Math.min(w, h); // fallback
    if (cx >= 0 && cx < dist.cols && cy >= 0 && cy < dist.rows) {
      const dv = dist.floatAt(cy, cx);
      if (dv > 0) thicknessPx = dv * 2;
    }

    // Filter by max plausible wall thickness.
    const thicknessMm = (thicknessPx / opts.rasterScale) * opts.mmPerUnit;
    if (thicknessMm > opts.maxThicknessMm) {
      discarded++;
      contours.delete(); hierarchy.delete();
      continue;
    }

    segments.push({
      id: nanoid(10),
      polygon: points,
      measuredThickness: thicknessPx / opts.rasterScale,
    });

    contours.delete(); hierarchy.delete();
  }

  markers32.delete();
  dist.delete();

  console.log(`[walls] 8b-extract ${segments.length} segments, ${discarded} discarded, ${Date.now() - t7b}ms`);
  console.log(`[walls] total ${Date.now() - t0}ms`);

  return segments;
}
