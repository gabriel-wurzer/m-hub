// Standbilder fuer das Poster: materieller Gebaeudepass und Aufbauten-Katalog.
//
// Beides gibt es als Clip, aber die Videostills sind gescrollt und angeschnitten.
// Hier in doppelter Aufloesung und auf den Ausschnitt beschnitten, der im Druck
// etwas hergibt.
//
// Lauf: node poster-screens.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, mkdirSync } from 'fs';

const BASE = process.env.DEMO_BASE || 'http://localhost:8910';
const VW = { width: 1440, height: 1100 };
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'video');
const TOKEN = process.env.DEMO_TOKEN || readFileSync(join(HERE, '.token'), 'utf8').trim();

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VW, deviceScaleFactor: 2 });
await context.addInitScript((t) => {
  try {
    sessionStorage.setItem('auth_token', t);
    localStorage.setItem('mhub-disclaimer-ack', '1');
  } catch { /* egal */ }
}, TOKEN);

const page = await context.newPage();
const warte = (ms) => page.waitForTimeout(ms);

/** Schneidet auf das Element zu, mit etwas Luft rundum. */
async function ausschnitt(locator, datei, luft = 24) {
  const b = await locator.boundingBox();
  if (!b) { console.log('kein Kasten fuer', datei); return; }
  await page.screenshot({
    path: join(OUT, datei),
    clip: {
      x: Math.max(0, b.x - luft), y: Math.max(0, b.y - luft),
      width: Math.min(VW.width - Math.max(0, b.x - luft), b.width + luft * 2),
      height: Math.min(VW.height - Math.max(0, b.y - luft), b.height + luft * 2),
    },
  });
  console.log('geschrieben:', datei);
}

// ── Materieller Gebaeudepass ──────────────────────────────────────────────
await page.goto(BASE + '/bestandsverwaltung', { waitUntil: 'networkidle', timeout: 30000 })
  .catch(() => {});
await warte(1600);
await page.locator('.building-card').first().click();
await warte(1200);
await page.locator('button[aria-label="Struktur anzeigen"]').first().click();
await warte(2600);

const knopf = page.locator('button:has-text("Materieller Gebäudepass")').first();
await knopf.scrollIntoViewIfNeeded().catch(() => {});
await warte(1800);
// Etwas hoeher stellen, damit Tortendiagramm UND Knopf im Bild sind.
await page.mouse.move(700, 500);
await page.mouse.wheel(0, -260);
await warte(1400);
await page.screenshot({ path: join(OUT, 'mgp-poster.png') });
console.log('geschrieben: mgp-poster.png');

// ── Aufbauten-Katalog ─────────────────────────────────────────────────────
await page.goto(BASE + '/katalog', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await page.getByText('Putz → Ziegel → Putz').first().waitFor({ timeout: 30000 }).catch(() => {});
await warte(1800);
await page.screenshot({ path: join(OUT, 'katalog-poster.png') });
console.log('geschrieben: katalog-poster.png');

await context.close();
await browser.close();
console.log('fertig');
