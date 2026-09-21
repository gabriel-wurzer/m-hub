// Clip "plan2d": vom PDF am Gebäude bis zum Bauteil in m-hub.
//
// Der Absprung öffnet das Plan-Tool normalerweise in einem neuen Tab, und
// Playwright nimmt je Tab eine eigene Datei auf. Deshalb wird window.open hier
// auf einen Wechsel im selben Tab umgebogen: ein durchgehender Clip statt zwei
// Schnipseln. Fachlich ändert das nichts, die Adresse ist dieselbe.
//
// Der Lauf ist zugleich der Test: wenn am Ende das Bauteil in m-hub steht, ist
// das Datenpaket angekommen.
//
// Lauf: node plan2d-clip.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync, renameSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

const BASE = process.env.DEMO_BASE || 'http://localhost:8910';
const VW = { width: 1600, height: 1000 };
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'video');
const ROH = join(OUT, '_raw_plan2d');
const TOKEN = process.env.DEMO_TOKEN || readFileSync(join(HERE, '.token'), 'utf8').trim();

const GEBAEUDE = process.env.DEMO_GEBAEUDE || 'ÖBB Zentrale';
const DOKUMENT = process.env.DEMO_DOKUMENT || 'Plantest Grundriss 2025';
const AUFBAU = 'Putz 15 Ziegel _ Putz 15';

mkdirSync(ROH, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: VW, recordVideo: { dir: ROH, size: VW }, deviceScaleFactor: 1,
});

await context.addInitScript((t) => {
  try {
    sessionStorage.setItem('auth_token', t);
    localStorage.setItem('mhub-disclaimer-ack', '1');
  } catch { /* egal */ }

  // Absprung im selben Tab, sonst zerfaellt die Aufnahme in zwei Dateien.
  window.open = (url) => { window.location.href = url; return null; };

  const zeichnen = () => {
    if (document.getElementById('__demo_cursor')) return;
    const punkt = document.createElement('div');
    punkt.id = '__demo_cursor';
    punkt.style.cssText =
      'position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;' +
      'border:2px solid #046329;border-radius:50%;background:rgba(4,99,41,.22);' +
      'z-index:2147483647;pointer-events:none;transition:transform .08s ease-out';
    document.body.appendChild(punkt);
    document.addEventListener('mousemove', (e) => {
      punkt.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    }, true);
    document.addEventListener('mousedown', () => {
      punkt.style.background = 'rgba(4,99,41,.55)';
    }, true);
    document.addEventListener('mouseup', () => {
      punkt.style.background = 'rgba(4,99,41,.22)';
    }, true);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', zeichnen);
  } else {
    zeichnen();
  }
}, TOKEN);

const page = await context.newPage();
const warte = (ms) => page.waitForTimeout(ms);
const gesprochen = [];
const sagen = (t) => gesprochen.push(t);
const t0 = Date.now();
const takt = (was) => console.log('   %ds  %s', Math.round((Date.now() - t0) / 1000), was);

async function zeigenUndKlicken(locator, ruhe = 600) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.hover({ timeout: 5000 }).catch(() => {});
  await warte(ruhe);
  await locator.click({ timeout: 10000, force: true });
}

try {
  // ── 1. Das PDF am Gebäude ───────────────────────────────────────────────
  sagen('Am Gebäude hängt ein Wohnungsbestandsplan als PDF');
  await page.goto(BASE + '/bestandsverwaltung', { waitUntil: 'networkidle', timeout: 30000 })
    .catch(() => {});
  await warte(2200);
  await zeigenUndKlicken(page.getByText(GEBAEUDE).first(), 700);
  await warte(1400);
  await zeigenUndKlicken(page.locator('button:has(mat-icon:text-is("edit"))').first(), 600);
  await warte(3000);

  const zeile = page.locator('.list-row.grid-document').filter({ hasText: DOKUMENT });
  await zeile.scrollIntoViewIfNeeded().catch(() => {});
  await warte(1600);
  takt('dokument im bild');

  // ── 2. Absprung ins Plan-Tool ───────────────────────────────────────────
  sagen('Plan auswerten öffnet das Plan-Werkzeug mit diesem Plan');
  await zeigenUndKlicken(zeile.locator('button:has(mat-icon:text-is("architecture"))').first(), 900);
  await page.waitForSelector('.setup-dialog', { timeout: 90000 });
  await warte(4000);
  takt('setup-dialog offen');

  // ── 3. Wandfarbe und Erkennung ──────────────────────────────────────────
  sagen('Wandfarbe aufnehmen, Maßstab steht auf 1:100');
  const treffer = await page.evaluate(async () => {
    const s = document.querySelector('.setup-dialog svg.viewer');
    const im = s.querySelector('image');
    const href = im.getAttribute('href') || im.getAttribute('xlink:href');
    const pw = parseFloat(im.getAttribute('width')), ph = parseFloat(im.getAttribute('height'));
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = href; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const w = c.width, h = c.height;
    const d = g.getImageData(0, 0, w, h).data;
    const at = (x, y) => { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };
    // Wandfleisch ist RGB(223,223,223), nicht die schwarze Kontur.
    const nah = (p) => p[3] > 200 && Math.abs(p[0] - 223) < 8
      && Math.abs(p[1] - 223) < 8 && Math.abs(p[2] - 223) < 8;
    for (const r of [4, 3, 2]) {
      for (let y = r; y < h - r; y += 2) {
        for (let x = r; x < w - r; x += 2) {
          if (!nah(at(x, y))) continue;
          let ok = true;
          for (let dy = -r; dy <= r && ok; dy++) for (let dx = -r; dx <= r && ok; dx++)
            if (!nah(at(x + dx, y + dy))) ok = false;
          if (!ok) continue;
          const pt = s.createSVGPoint();
          pt.x = x / w * pw; pt.y = y / h * ph;
          const sp = pt.matrixTransform(s.querySelector('g').getScreenCTM());
          return { cx: sp.x, cy: sp.y };
        }
      }
    }
    return null;
  });
  if (!treffer) throw new Error('keine Wandfarbe gefunden');
  await page.mouse.move(treffer.cx - 90, treffer.cy - 60);
  await warte(500);
  await page.mouse.move(treffer.cx, treffer.cy, { steps: 12 });
  await warte(600);
  await page.mouse.click(treffer.cx, treffer.cy);
  await warte(1800);
  takt('farbe aufgenommen');

  sagen('Die Erkennung findet die Wände im Plan');
  await zeigenUndKlicken(page.locator('button:has-text("Analysieren")'), 900);
  await page.waitForSelector('.setup-dialog', { state: 'detached', timeout: 180000 });
  await warte(3500);
  const kopf = (await page.locator('body').innerText()).slice(0, 90).replace(/\s+/g, ' ');
  console.log('   erkannt:', kopf);
  takt('erkennung fertig');

  // ── 4. Eine Wand greifen und ihr den Aufbau geben ───────────────────────
  //
  // Nicht per Rechteck: die Auswahl markiert zwar viele Segmente, der
  // Schichtaufbau gilt aber immer der Wandgruppe des zuletzt angeklickten
  // Segments. Also gezielt die laengste Wand anklicken, sonst uebergibt der
  // Clip eine 9 cm lange Wand.
  sagen('Eine Wand anklicken und ihr einen Schichtaufbau geben');
  const ziel = await page.evaluate(() => {
    const s = document.querySelector('svg.viewer');
    const g = s.querySelector('g');
    const wege = [...s.querySelectorAll('polygon[data-seg-id], polygon')];
    // Laengstes Segment ueber die Bounding-Box der gezeichneten Polygone.
    let best = null;
    for (const el of wege) {
      const b = el.getBBox();
      const lang = Math.max(b.width, b.height);
      if (lang < 8) continue;
      if (!best || lang > best.lang) best = { el, lang, b };
    }
    if (!best) return null;
    const pt = s.createSVGPoint();
    pt.x = best.b.x + best.b.width / 2;
    pt.y = best.b.y + best.b.height / 2;
    const sp = pt.matrixTransform(g.getScreenCTM());
    return { cx: sp.x, cy: sp.y, lang: Math.round(best.lang) };
  });
  console.log('   groesste wand:', JSON.stringify(ziel));
  if (ziel) {
    await page.mouse.move(ziel.cx - 120, ziel.cy - 80);
    await warte(500);
    await page.mouse.move(ziel.cx, ziel.cy, { steps: 14 });
    await warte(700);
    await page.mouse.click(ziel.cx, ziel.cy);
    await warte(1800);
  }
  const panel = await page.locator('.panel').first().innerText().catch(() => '');
  console.log('   panel:', panel.slice(0, 90).replace(/\s+/g, ' '));
  takt('wand gewaehlt');

  const dsl = page.locator('input[placeholder*="Ziegel"]').first();
  await dsl.click({ force: true });
  await warte(500);
  await dsl.type(AUFBAU, { delay: 55 });
  await warte(900);
  await page.keyboard.press('Enter');
  await warte(2400);
  takt('aufbau zugewiesen');

  // ── 5. Übergabe ─────────────────────────────────────────────────────────
  sagen('Übergeben schickt das Paket zurück an m-hub');
  await zeigenUndKlicken(page.locator('button:has-text("Übergeben")').first(), 900);
  await warte(1600);
  const dlg = page.locator('mat-dialog-container');
  await warte(1200);
  const geschoss = dlg.locator('mat-checkbox:has-text("Regelgeschoss 1") input').first();
  await (await geschoss.count() ? geschoss : dlg.locator('mat-checkbox input').first()).click();
  await warte(1200);
  await zeigenUndKlicken(dlg.locator('button:has-text("Übergeben")').last(), 900);
  await warte(3500);
  const snack = await page.locator('.mat-mdc-snack-bar-container').innerText().catch(() => '');
  console.log('   snackbar:', snack.replace(/\s+/g, ' '));
  await warte(2500);
  takt('uebergeben');

  // ── 6. Der Beweis in m-hub ──────────────────────────────────────────────
  sagen('Das Bauteil steht jetzt am Gebäude in m-hub');
  await page.goto(BASE + '/bestandsverwaltung', { waitUntil: 'networkidle', timeout: 30000 })
    .catch(() => {});
  await warte(2000);
  await zeigenUndKlicken(page.getByText(GEBAEUDE).first(), 600);
  await warte(1200);
  await zeigenUndKlicken(page.locator('button:has(mat-icon:text-is("edit"))').first(), 600);
  await warte(3500);
  const bauteile = await page.locator('.list-row.grid-part, .list-row').allInnerTexts()
    .catch(() => []);
  const gefunden = bauteile.filter((z) => /Wand /.test(z)).length;
  console.log('   Bauteile mit "Wand" in der Liste:', gefunden);
  await warte(3500);
  takt('ende');
} catch (e) {
  console.log('  abgebrochen:', String(e).slice(0, 200));
}

await page.screenshot({ path: join(OUT, 'plan2d.png') }).catch(() => {});
await context.close();
await browser.close();

const NL = String.fromCharCode(10);
writeFileSync(join(OUT, 'plan2d.txt'),
  ['Plan auswerten: vom PDF zum Bauteil', '']
    .concat(gesprochen.map((z) => '· ' + z)).join(NL) + NL, 'utf8');

const webm = readdirSync(ROH).filter((f) => f.endsWith('.webm')).sort();
if (webm.length) {
  renameSync(join(ROH, webm[webm.length - 1]), join(OUT, 'plan2d.webm'));
  console.log('plan2d aufgenommen');
}
