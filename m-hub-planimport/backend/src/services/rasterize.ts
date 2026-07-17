// Rasterizes a PDF page to a PNG (via @napi-rs/canvas) for two purposes:
//   1. Preview image shown behind the SVG in the frontend.
//   2. Input to the opencv-wasm vectorization pipeline when the PDF has no
//      extractable vectors (scanned plans).

import { createCanvas } from '@napi-rs/canvas';
import { pdfjsLib, NapiCanvasFactory } from './pdfjsSetup.js';

export interface RasterResult {
  png: Buffer;
  width: number;
  height: number;
  /** Scale factor used when rendering (pixels per PDF unit). */
  scale: number;
}

export async function rasterizePdfPage(
  pdfBuffer: Buffer,
  pageIndex = 0,
  targetMaxSide = 2000,
): Promise<RasterResult> {
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    disableFontFace: true,
    useSystemFonts: false,
    isEvalSupported: false,
    // canvasFactory is accepted at runtime (see pdf.mjs line ~7351) but isn't
    // in the public type definitions; the `as any` cast below covers it.
    canvasFactory: new NapiCanvasFactory(),
  } as any).promise;

  const page = await pdf.getPage(pageIndex + 1);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(
    targetMaxSide / baseViewport.width,
    targetMaxSide / baseViewport.height,
    4, // cap zoom so huge source pages don't explode memory
  );
  const viewport = page.getViewport({ scale });

  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  // White background — scanned plans are usually on white, and pdfjs expects
  // the canvas to start opaque for correct compositing.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    // @ts-expect-error — pdfjs-dist typings expect a browser CanvasRenderingContext2D,
    // but @napi-rs/canvas is API-compatible for the subset pdfjs uses.
    canvasContext: ctx,
    viewport,
  }).promise;

  const png = await canvas.encode('png');

  await pdf.cleanup();
  await pdf.destroy();

  return { png, width: canvas.width, height: canvas.height, scale };
}

