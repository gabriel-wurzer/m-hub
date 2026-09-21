// Rendert docs/poster-ki/poster.html nach A0 (841 x 1189 mm) und prueft, ob der
// Inhalt noch auf eine Seite passt.
//
// Liegt hier und nicht beim Poster, weil playwright in diesem Ordner installiert
// ist. Lauf: cd demo && node poster-rendern.mjs

import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 3179, height: 4493 }, deviceScaleFactor: 1 })).newPage();
await p.goto('file:///C:/temp/m-hub/app/docs/poster-ki/poster.html', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);

const hoehe = await p.evaluate(() => document.body.scrollHeight);
const seite = await p.evaluate(() => Math.round(document.querySelector('.blatt').getBoundingClientRect().height));
console.log('Inhalt %d px von %d px verfuegbar%s', hoehe, seite,
  hoehe > seite ? '  ---> ZU LANG, das kippt auf Seite 2' : '  (passt)');

await p.pdf({ path: 'C:/temp/m-hub/app/docs/poster-ki/KI-in-m-hub_A0.pdf',
  width: '33.11in', height: '46.81in', printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 }, pageRanges: '1' });
await b.close();
