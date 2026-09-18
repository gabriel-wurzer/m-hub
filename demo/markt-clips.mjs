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
  const t0 = Date.now();
  const takt = (was) => console.log('   %ds  %s', Math.round((Date.now() - t0) / 1000), was);

  async function zumInserat() {
    await page.goto(BASE + '/markt', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await warte(1000);
    await page.getByText('Mineralik').first().click({ timeout: 8000 });
    await warte(1000);
    await page.getByText(INSERAT).first().click({ timeout: 8000 });
    await warte(1800);
    await page.locator('.listing-media').first()
      .scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
  }

  await page.goto(BASE + '/markt', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await warte(1300);
  sagen('Der Marktplatz: wiederverwendbare Bauteile, nach Materialgruppen');
  await warte(2300);
  takt('markt gezeigt');

  sagen('Mineralik: Ziegel, Beton, Estrich');
  await page.getByText('Mineralik').first().click({ timeout: 8000 });
  await warte(1400);
  await page.getByText(INSERAT).first().click({ timeout: 8000 });
  await warte(2400);
  sagen('Am Inserat hängen Medien aus dem Gebäude, nicht nur Fotos');
  await page.locator('.listing-media').first()
    .scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
  await warte(2600);
  takt('inserat offen');

  const splatHref = await page.locator('.listing-media a:has-text("3D ansehen")').first()
    .getAttribute('href', { timeout: 5000 }).catch(() => null);
  if (splatHref) {
    sagen('Der Gaussian Splat des Waschbeckens, direkt im Browser');
    await page.goto(new URL(splatHref, BASE).toString(), { timeout: 90000 }).catch(() => {});
    takt('viewer geladen (goto)');
    await page.waitForFunction(
      () => (document.body.innerText || '').includes('Loaded'), { timeout: 60000 }).catch(() => {});
    takt('splat fertig');
    await warte(800);

    // Drehen laesst der Viewer selbst: das kostet keine Interaktion und laeuft
    // fluessig, waehrend ein gezogener Orbit ueber 800.000 Splats sehr teuer ist.
    sagen('Einmal rundherum: das Bauteil von allen Seiten');
    await page.getByRole('button', { name: 'Spin off' }).click({ timeout: 5000 }).catch(() => {});
    await warte(13000);
    takt('rotation fertig');
    sagen('Wer kauft, sieht das Bauteil vorher, nicht erst beim Abholen');
    await warte(2500);
  }

  sagen('Zurück zum Inserat');
  await zumInserat();
  await warte(1600);
  takt('zurueck im inserat');

  const pdfHref = await page
    .locator('.listing-media-item:has-text("Störstoff") a:has-text("Herunterladen")').first()
    .getAttribute('href', { timeout: 5000 }).catch(() => null);
  if (pdfHref) {
    sagen('Das zweite Medium: der signierte Schad- und Störstoffbericht');
    await page.goto(new URL(pdfHref, BASE).toString(), { timeout: 30000 }).catch(() => {});
    await warte(4500);
    takt('pdf gezeigt');
    sagen('Er hängt am Inserat, nicht in einer Mail');
    await warte(2200);
  }
  takt('ende');
}

// ------------------------------------------------------------- Einbringen
async function einbringen(page, sagen) {
  const warte = (ms) => page.waitForTimeout(ms);
  const feld = (label) =>
    page.locator(`mat-dialog-container mat-form-field:has(mat-label:text-is("${label}")) input`).first();

  await page.goto(BASE + '/bestandsverwaltung', { waitUntil: 'networkidle', timeout: 30000 })
    .catch(() => {});
  await warte(1500);
  sagen('Angemeldet, eigenes Objekt Schwarzspanierstraße 18');
  await page.locator('.building-card').first().click();
  await warte(1300);
  await page.locator('button:has(mat-icon:text-is("edit"))').first().click();
  await warte(2200);

  sagen('Ein erfasstes Bauteil lässt sich direkt inserieren');
  await warte(1600);
  await page.locator('button[aria-label="Im Markt inserieren"]').first().click();
  await warte(2000);

  // Das Formular Feld fuer Feld, sichtbar getippt. Wer zusieht, soll mitlesen
  // koennen, was aus dem Bauteil kommt und was man selbst eintraegt.
  sagen('Der Name kommt aus dem Bauteil und lässt sich anpassen');
  const name = page.locator('mat-dialog-container input').first();
  await name.click();
  await name.fill('');
  await name.type('Ziegelmauerwerk aus dem Rückbau', { delay: 55 });
  await warte(1800);

  sagen('Menge und Einheit: 17,30 Laufmeter aus dem Aufmaß');
  for (const [label, wert] of [['Anzahl/Menge', '17.3'], ['Preis (€)', '0']]) {
    const f = feld(label);
    if (await f.count().catch(() => 0)) {
      await f.scrollIntoViewIfNeeded().catch(() => {});
      await f.click().catch(() => {});
      await f.fill(String(wert)).catch(() => {});
      await warte(1400);
    }
  }
  await warte(1200);

  sagen('Und jetzt das Neue: Medien aus dem Gebäude mitgeben');
  const erste = page.locator('mat-dialog-container mat-checkbox').first();
  await erste.scrollIntoViewIfNeeded().catch(() => {});
  await warte(2400);

  // Splat und Schadstoffbericht mitnehmen, Plaene und Rohdaten nicht.
  for (const name2 of ['Handwaschbecken', 'Schad- und Störstofferkundung']) {
    const box = page.locator(`mat-checkbox:has-text("${name2}") label`).first();
    await box.scrollIntoViewIfNeeded();
    await box.click();
    await warte(1600);
  }
  sagen('Die Punktwolken-Rohdatei und das Modell bleiben bewusst draußen');
  await warte(3000);
  sagen('Ausgewählt wird bewusst, kopiert wird erst beim Anlegen');
  await warte(2800);
}

const gewuenscht = process.argv.slice(2);
const laeuft = (id) => gewuenscht.length === 0 || gewuenscht.includes(id);

if (laeuft('abfrage')) await aufnehmen('markt-abfrage', abfrage);
if (laeuft('einbringen')) await aufnehmen('markt-einbringen', einbringen);
console.log('fertig');
