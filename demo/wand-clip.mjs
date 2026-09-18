// Clip "Einloggen und eine Wand eintippen".
//
// Eigenes Skript statt Kapitel in flugstrecke.mjs: der Schichteditor reagiert
// empfindlich auf die Reihenfolge der Eingaben, das laesst sich mit dem
// allgemeinen Aktions-Vokabular nicht sauber abbilden.
//
// Zahlen aus der Beprobung (2_Schwarzspanierstraße.xlsx, Blatt "1 Wände_f",
// Zeile "Aussenwand West"): 17,30 lfm, 0,70 m stark, 6 % Putz / 79 % Ziegel.
//
// Lauf: node wand-clip.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync, renameSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

const BASE = process.env.DEMO_BASE || 'http://localhost:8910';
const VW = { width: 1440, height: 900 };
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'video');
const ROH = join(OUT, '_raw_wand');
const TOKEN = process.env.DEMO_TOKEN || readFileSync(join(HERE, '.token'), 'utf8').trim();

const SCHICHTEN = [
  ['Putz', 20],
  ['Ziegel', 658],
  ['Putz', 22],
];

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
}, TOKEN);

const page = await context.newPage();
const wait = (ms) => page.waitForTimeout(ms);
const gesprochen = [];
const sagen = (text) => { gesprochen.push(text); };

await page.goto(BASE + '/bestandsverwaltung', { waitUntil: 'networkidle', timeout: 30000 })
  .catch(() => {});
await wait(1600);

sagen('Angemeldet als Demo, eigenes Objekt Schwarzspanierstraße 18');
await page.locator('.building-card').first().click();
await wait(1400);
await page.locator('button:has(mat-icon:text-is("edit"))').first().click();
await wait(2200);

sagen('Bauteile: noch keine erfasst');
await wait(1800);
await page.locator('button:has(mat-icon:text-is("add"))').first().click();
await wait(1600);

sagen('Aus der Beprobung: Außenwand West');
await page.locator('mat-dialog-container input').first().type('Außenwand West', { delay: 70 });
await wait(900);
await page.locator('mat-dialog-container mat-select').nth(0).click();
await wait(900);
await page.locator('mat-option:has-text("Regelgeschoss 1")').click();
await wait(700);
await page.keyboard.press('Escape');
await wait(800);
await page.locator('mat-dialog-container mat-select').nth(1).click();
await wait(1000);
await page.locator('mat-option:has-text("Außenwand")').click();
await wait(1600);

sagen('Laufmeter aus dem Aufmaß: 17,30');
await page.locator('mat-form-field:has(mat-label:text-is("Laufmeter (m)")) input').fill('17.3');
await wait(1500);

sagen('Schichtaufbau tippen: Putz, Ziegel, Putz');
for (let i = 0; i < SCHICHTEN.length; i += 1) {
  const [material, mm] = SCHICHTEN[i];
  if (i > 0) {
    await page.locator('button:has-text("Schicht hinzufügen")').first().click();
    await wait(1200);
  }
  const zeile = page.locator('div.layer-row').nth(i);
  await zeile.locator('mat-select').click();
  await wait(1100);
  await page.locator(`mat-option >> text="${material}"`).click();
  await wait(800);
  await zeile.locator('input[type=number]').fill(String(mm));
  await wait(1100);
}

sagen('Die Plausibilitätsprüfung schaut beim Tippen mit');
await wait(2600);

const anlegen = page.locator('mat-dialog-container button:has-text("Hinzufügen")').last();
console.log('Hinzufügen aktiv:', await anlegen.isEnabled().catch(() => false));
await anlegen.click().catch((e) => console.log('Klick:', String(e).slice(0, 80)));
await wait(3000);

sagen('Die Wand hängt jetzt am Gebäude');
await wait(3200);

await page.screenshot({ path: join(OUT, 'wand.png') }).catch(() => {});
await context.close();
await browser.close();

const NL = String.fromCharCode(10);
writeFileSync(join(OUT, 'wand.txt'),
  ['Einloggen und eine Wand eintippen', ''].concat(gesprochen.map((z) => '· ' + z)).join(NL) + NL,
  'utf8');

const webm = readdirSync(ROH).filter((f) => f.endsWith('.webm')).sort();
if (webm.length) {
  renameSync(join(ROH, webm[webm.length - 1]), join(OUT, 'wand.webm'));
  console.log('wand.webm geschrieben');
}
