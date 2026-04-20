// Shared pdfjs-dist bootstrap: worker URL + canvas factory.
//
// pdfjs v4 quirks we work around here:
//   1. GlobalWorkerOptions.workerSrc must be a file:// URL on Windows — raw
//      drive-letter paths are rejected by Node's default ESM loader.
//   2. In Node, pdfjs tries to dynamic-import the `canvas` npm package at
//      render time to spawn helper canvases for inline images, patterns,
//      masks, etc. We use @napi-rs/canvas instead, so we supply our own
//      CanvasFactory via getDocument({ canvasFactory }) (an undocumented but
//      supported field — see pdfjs pdf.mjs around line 7351).

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';

const require = createRequire(import.meta.url);
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pathToFileURL(
  require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs'),
).href;

export class NapiCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(Math.max(1, width), Math.max(1, height));
    return { canvas, context: canvas.getContext('2d') };
  }
  reset(canvasAndContext: { canvas: any }, width: number, height: number) {
    canvasAndContext.canvas.width = Math.max(1, width);
    canvasAndContext.canvas.height = Math.max(1, height);
  }
  destroy(canvasAndContext: { canvas: any; context: any }) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    (canvasAndContext as any).canvas = null;
    (canvasAndContext as any).context = null;
  }
}

export { pdfjsLib };
