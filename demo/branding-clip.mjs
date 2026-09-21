// Clip "harvestmap-branding": wie m-hub im HarvestMAP-Branding aussieht.
//
// Laeuft gegen PROD, nicht gegen den lokalen Stack: das Branding ist ein
// Build-Argument, und nur prod ist mit FRONTEND_BRANDING=materialnomaden
// gebaut. Nur oeffentliche Routen, kein Login, es wird nichts geschrieben.
//
// Lauf: node branding-clip.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync, renameSync, writeFileSync, mkdirSync } from 'fs';

const BASE = process.env.DEMO_BASE || 'https://m-hub.dap.tuwien.ac.at';
const VW = { width: 1440, height: 900 };
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'video');
const ROH = join(OUT, '_raw_branding');

mkdirSync(ROH, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: VW, recordVideo: { dir: ROH, size: VW }, deviceScaleFactor: 1,
});
await context.addInitScript(() => {
  try { localStorage.setItem('mhub-disclaimer-ack', '1'); } catch { /* egal */ }

  // Sichtbarer Mauszeiger, sonst sieht man im Video nicht, worauf geklickt wird.
  const zeichnen = () => {
    if (document.getElementById('__demo_cursor')) return;
    const punkt = document.createElement('div');
    punkt.id = '__demo_cursor';
    punkt.style.cssText =
      'position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;' +
      'border:2px solid #0d612e;border-radius:50%;background:rgba(13,97,46,.22);' +
      'z-index:2147483647;pointer-events:none;transition:transform .08s ease-out';
    document.body.appendChild(punkt);
    document.addEventListener('mousemove', (e) => {
      punkt.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    }, true);
    document.addEventListener('mousedown', () => {
      punkt.style.background = 'rgba(13,97,46,.55)';
    }, true);
    document.addEventListener('mouseup', () => {
      punkt.style.background = 'rgba(13,97,46,.22)';
    }, true);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', zeichnen);
  } else {
    zeichnen();
  }
});

const page = await context.newPage();
const warte = (ms) => page.waitForTimeout(ms);
const gesprochen = [];
const sagen = (t) => gesprochen.push(t);
const t0 = Date.now();
const takt = (was) => console.log('   %ds  %s', Math.round((Date.now() - t0) / 1000), was);

async function zeigenUndKlicken(locator, ruhe = 600) {
  await locator.hover({ timeout: 4000 }).catch(() => {});
  await warte(ruhe);
  await locator.click({ timeout: 8000, force: true });
}

try {
  // --- Karte -------------------------------------------------------------
  sagen('Die Plattform im HarvestMAP-Branding');
  await page.goto(BASE + '/karte', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await warte(6000);
  takt('karte geladen');

  sagen('Suche nach einer Adresse');
  const lupe = page.locator('.leaflet-control-geocoder-icon').first();
  if (await lupe.count()) {
    await zeigenUndKlicken(lupe, 500);
    await warte(400);
    const feld = page.locator('input[placeholder="Suchen.."]').first();
    await feld.click();
    await feld.type('Praterstern, Wien', { delay: 45 });
    await warte(600);
    await page.keyboard.press('Enter');
    await warte(2200);
    const treffer = page.locator('.leaflet-control-geocoder-alternatives li').first();
    if (await treffer.count()) {
      await zeigenUndKlicken(treffer, 500);
      await warte(4000);
    }
  }
  takt('adresse gefunden');

  // Ruhiger Zoom ueber die Leaflet-Knoepfe, das Mausrad ruckelt in der Aufnahme.
  sagen('Naeher heran, bis die einzelnen Gebaeude stehen');
  // Zwei Stufen. Bei der dritten verliert der Kartenstil die Zeichnung und
  // es steht nur noch blasses Grau im Bild.
  const plus = page.locator('.leaflet-control-zoom-in').first();
  for (let i = 0; i < 2; i++) {
    if (await plus.count()) await zeigenUndKlicken(plus, 900);
    await warte(1800);
  }
  await warte(3000);
  await page.screenshot({ path: join(OUT, '_branding_karte.png') }).catch(() => {});
  takt('gezoomt');

  // --- Markt -------------------------------------------------------------
  sagen('Und der Markt mit den verfuegbaren Bauteilen');
  await page.goto(BASE + '/markt', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await warte(5000);
  takt('markt geladen');

  await page.mouse.move(700, 500);
  await page.mouse.wheel(0, 320);
  await warte(1800);
  await page.mouse.wheel(0, 320);
  await warte(2200);
  await page.mouse.wheel(0, -640);
  await warte(1500);
  await page.screenshot({ path: join(OUT, '_branding_markt.png') }).catch(() => {});

  sagen('Eine Materialgruppe, dann das Inserat im Detail');
  const gruppe = page.locator('mat-card, .listing-card, .market-card').first();
  if (await gruppe.count()) {
    await zeigenUndKlicken(gruppe, 900);
    await warte(3500);
  }
  await page.screenshot({ path: join(OUT, '_branding_kategorie.png') }).catch(() => {});

  // Aus der Kategorie ins einzelne Inserat.
  const inserat = page.getByText('Ziegel Kaminwand').first();
  if (await inserat.count()) {
    await zeigenUndKlicken(inserat, 1100);
    await warte(5500);
  }
  await page.screenshot({ path: join(OUT, '_branding_inserat.png') }).catch(() => {});
  await warte(2500);
  takt('ende');
} catch (e) {
  console.log('  abgebrochen:', String(e).slice(0, 160));
}

await context.close();
await browser.close();

const NL = String.fromCharCode(10);
writeFileSync(join(OUT, 'harvestmap-branding.txt'),
  ['m-hub im HarvestMAP-Branding (Aufnahme gegen prod)', '']
    .concat(gesprochen.map((z) => '· ' + z)).join(NL) + NL, 'utf8');

const webm = readdirSync(ROH).filter((f) => f.endsWith('.webm')).sort();
if (webm.length) {
  renameSync(join(ROH, webm[webm.length - 1]), join(OUT, 'harvestmap-branding.webm'));
  console.log('harvestmap-branding aufgenommen');
}
