// Drei Clips zum Marktplatz:
//
//   markt-abfrage    Markt durchsuchen, Inserat oeffnen, Splat drehen
//   markt-einbringen vom Bauteil aus inserieren, Medien mitnehmen
//   markt-api        derselbe Markt ueber die Schnittstelle
//
// Der API-Clip laeuft ohne Browser: er schreibt die Aufrufe und Antworten in
// eine Textdatei, aus der ein Terminal-Standbild entsteht. Ein echtes Terminal
// aufzunehmen waere aufwendiger, ohne mehr zu zeigen.
//
// Lauf: node markt-clips.mjs [abfrage] [einbringen]

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync, renameSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

const BASE = process.env.DEMO_BASE || 'http://localhost:8910';
const VW = { width: 1440, height: 900 };
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'video');
const TOKEN = process.env.DEMO_TOKEN || readFileSync(join(HERE, '.token'), 'utf8').trim();

const INSERAT = process.env.DEMO_LISTING || 'Ziegelmauerwerk Außenwand West';

mkdirSync(OUT, { recursive: true });

async function aufnehmen(id, ablauf) {
  const roh = join(OUT, '_raw_' + id);
  mkdirSync(roh, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VW, recordVideo: { dir: roh, size: VW }, deviceScaleFactor: 1,
  });
  await context.addInitScript((t) => {
    try {
      sessionStorage.setItem('auth_token', t);
      localStorage.setItem('mhub-disclaimer-ack', '1');
    } catch { /* egal */ }
  }, TOKEN);
  const page = await context.newPage();
  const gesprochen = [];
  try {
    await ablauf(page, (z) => gesprochen.push(z));
  } catch (e) {
    console.log(`  [${id}] abgebrochen:`, String(e).slice(0, 110));
  }
  await page.screenshot({ path: join(OUT, `${id}.png`) }).catch(() => {});
  await context.close();
  await browser.close();

  const NL = String.fromCharCode(10);
  writeFileSync(join(OUT, `${id}.txt`),
    [id, ''].concat(gesprochen.map((z) => '· ' + z)).join(NL) + NL, 'utf8');
  const webm = readdirSync(roh).filter((f) => f.endsWith('.webm')).sort();
  if (webm.length) {
    renameSync(join(roh, webm[webm.length - 1]), join(OUT, `${id}.webm`));
    console.log(id, 'aufgenommen');
  } else {
    console.log(id, 'KEIN VIDEO');
  }
}

// ---------------------------------------------------------------- Abfrage
async function abfrage(page, sagen) {
  const warte = (ms) => page.waitForTimeout(ms);
  await page.goto(BASE + '/markt', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await warte(2200);
  sagen('Der Marktplatz: wiederverwendbare Bauteile, nach Materialgruppen sortiert');
  await warte(2800);

  sagen('Mineralik: Ziegel, Beton, Estrich');
  await page.getByText('Mineralik').first().click();
  await warte(2600);

  sagen('Ein Inserat aus dem Rückbau Schwarzspanierstraße 18');
  await page.getByText(INSERAT).first().click();
  await warte(3000);

  sagen('Am Inserat hängen Medien aus dem Gebäude, nicht nur Fotos');
  await page.locator('.listing-media').first().scrollIntoViewIfNeeded().catch(() => {});
  await warte(3000);

  // Dem 3D-Link im selben Fenster folgen, damit der Clip nicht zerreisst.
  const link = page.locator('.listing-media a:has-text("3D ansehen")').first();
  const href = await link.getAttribute('href', { timeout: 6000 });
  if (href) {
    sagen('Der Gaussian Splat des Waschbeckens, direkt im Browser');
    await page.goto(new URL(href, page.url()).toString(), { timeout: 60000 }).catch(() => {});
    await warte(12000);
    sagen('Wer kauft, sieht das Bauteil vorher von allen Seiten');
    await warte(4000);
  }
}

// ------------------------------------------------------------- Einbringen
async function einbringen(page, sagen) {
  const warte = (ms) => page.waitForTimeout(ms);
  await page.goto(BASE + '/bestandsverwaltung', { waitUntil: 'networkidle', timeout: 30000 })
    .catch(() => {});
  await warte(1600);
  sagen('Angemeldet, eigenes Objekt Schwarzspanierstraße 18');
  await page.locator('.building-card').first().click();
  await warte(1400);
  await page.locator('button:has(mat-icon:text-is("edit"))').first().click();
  await warte(2400);

  sagen('Ein erfasstes Bauteil lässt sich direkt inserieren');
  await warte(1800);
  await page.locator('button[aria-label="Im Markt inserieren"]').first().click();
  await warte(2200);

  sagen('Name, Menge und Preis kommen aus dem Bauteil');
  await page.locator('mat-dialog-container input').first().fill('Ziegelmauerwerk aus dem Rückbau');
  await warte(1400);

  sagen('Und jetzt das Neue: Medien aus dem Gebäude mitgeben');
  const abschnitt = page.locator('mat-dialog-container mat-checkbox');
  await abschnitt.first().scrollIntoViewIfNeeded().catch(() => {});
  await warte(2000);

  // Splat und Schadstoffbericht mitnehmen, die Punktwolken-Rohdatei nicht.
  for (const name of ['Handwaschbecken', 'Schad- und Störstofferkundung']) {
    const box = page.locator(`mat-checkbox:has-text("${name}") label`).first();
    await box.scrollIntoViewIfNeeded();
    await box.click();
    await warte(1100);
  }
  sagen('Pläne bleiben bewusst draußen, ausgewählt wird bewusst');
  await warte(2600);
}

const gewuenscht = process.argv.slice(2);
const laeuft = (id) => gewuenscht.length === 0 || gewuenscht.includes(id);

if (laeuft('abfrage')) await aufnehmen('markt-abfrage', abfrage);
if (laeuft('einbringen')) await aufnehmen('markt-einbringen', einbringen);
console.log('fertig');
