// Rendert ein Poster-HTML nach A0 (841 x 1189 mm) und prueft, ob der Inhalt noch
// auf eine Seite passt.
//
// Das Poster selbst liegt ausserhalb des Repos bei den uebrigen
// Dissemination-Unterlagen, das Skript hier, weil playwright in diesem Ordner
// installiert ist.
//
//   cd demo && node poster-rendern.mjs
//   cd demo && node poster-rendern.mjs "C:/anderer/pfad/poster.html"

import { chromium } from 'playwright';
import { dirname, join } from 'path';
import { pathToFileURL } from 'url';

const QUELLE = process.argv[2] || 'C:/temp/m-hub/AP6-DISSEMINATION/poster-ki/poster.html';
const ZIEL = join(dirname(QUELLE), 'KI-in-m-hub_A0.pdf');

const b = await chromium.launch();
const p = await (await b.newContext({
  viewport: { width: 3179, height: 4493 }, deviceScaleFactor: 1,
})).newPage();
await p.goto(pathToFileURL(QUELLE).href, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);

const hoehe = await p.evaluate(() => document.body.scrollHeight);
const seite = await p.evaluate(() => Math.round(document.querySelector('.blatt').getBoundingClientRect().height));
console.log('Inhalt %d px von %d px verfuegbar%s', hoehe, seite,
  hoehe > seite ? '  ---> ZU LANG, das kippt auf Seite 2' : '  (passt)');

await p.pdf({
  path: ZIEL, width: '33.11in', height: '46.81in', printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 }, pageRanges: '1',
});
console.log('geschrieben:', ZIEL);
await b.close();
