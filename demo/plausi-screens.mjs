// Standbilder der Plausibilitaetspruefung im Bauteil-Dialog.
//
// Im Clip "wand" ist das Banner nicht zu sehen: es sitzt ueber der
// Schichten-Darstellung, und die Aufnahme scrollt zu den Eingabefeldern
// darunter. Dieses Skript haelt beides fest, Stufe 3 und Stufe 2.
//
// Lauf: node plausi-screens.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, mkdirSync } from 'fs';

const BASE = process.env.DEMO_BASE || 'http://localhost:8910';
const VW = { width: 1440, height: 1000 };
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'video');
const TOKEN = process.env.DEMO_TOKEN || readFileSync(join(HERE, '.token'), 'utf8').trim();

// Aussenwand bis 1918. Der erste Aufbau steht so in den Vermessungen, der
// zweite nicht: Beton in einer Gruenderzeit-Aussenwand hat es nie gegeben.
const FAELLE = [
  { datei: 'plausi-stufe3.png', schichten: [['Putz', 20], ['Ziegel', 658], ['Putz', 22]] },
  { datei: 'plausi-stufe2.png', schichten: [['Putz', 20], ['Beton', 300], ['Putz', 22]] },
];

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

for (const fall of FAELLE) {
  await page.goto(BASE + '/bestandsverwaltung', { waitUntil: 'networkidle', timeout: 30000 })
    .catch(() => {});
  await warte(1600);
  await page.locator('.building-card').first().click();
  await warte(1200);
  await page.locator('button:has(mat-icon:text-is("edit"))').first().click();
  await warte(2000);
  await page.locator('button:has(mat-icon:text-is("add"))').first().click();
  await warte(1400);

  await page.locator('mat-dialog-container input').first().fill('Außenwand West');
  await warte(400);
  await page.locator('mat-dialog-container mat-select').nth(0).click();
  await warte(700);
  await page.locator('mat-option:has-text("Regelgeschoss 1")').click();
  await warte(500);
  await page.keyboard.press('Escape');
  await warte(600);
  await page.locator('mat-dialog-container mat-select').nth(1).click();
  await warte(700);
  await page.locator('mat-option:has-text("Außenwand")').click();
  await warte(800);
  await page.locator('mat-form-field:has(mat-label:text-is("Laufmeter (m)")) input').fill('17.3');
  await warte(600);

  for (let i = 0; i < fall.schichten.length; i += 1) {
    const [material, mm] = fall.schichten[i];
    if (i > 0) {
      await page.locator('button:has-text("Schicht hinzufügen")').first().click();
      await warte(900);
    }
    const zeile = page.locator('div.layer-row').nth(i);
    await zeile.locator('mat-select').click();
    await warte(700);
    await page.locator(`mat-option >> text="${material}"`).click();
    await warte(500);
    await zeile.locator('input[type=number]').fill(String(mm));
    await warte(700);
  }

  // Der Dienst antwortet entprellt, kurz Luft lassen.
  await warte(2500);

  const banner = page.locator('.plausibility-banner').first();
  const da = await banner.count();
  const text = da ? (await banner.innerText()).trim() : '(kein Banner)';
  console.log('%s  ->  %s', fall.datei, text.replace(/\s+/g, ' '));

  if (da) {
    await banner.scrollIntoViewIfNeeded().catch(() => {});
    await warte(700);
  }
  await page.screenshot({ path: join(OUT, fall.datei) });

  // Ausschnitt nur mit dem Banner, fuer Folie und Poster brauchbarer als
  // der ganze Dialog.
  if (da) {
    const b = await banner.boundingBox();
    if (b) {
      await page.screenshot({
        path: join(OUT, fall.datei.replace('.png', '-detail.png')),
        clip: { x: Math.max(0, b.x - 40), y: Math.max(0, b.y - 30),
                width: Math.min(VW.width - b.x + 40, b.width + 80), height: b.height + 60 },
      });
    }
  }

  await page.keyboard.press('Escape');
  await warte(800);
}

await context.close();
await browser.close();
console.log('fertig');
