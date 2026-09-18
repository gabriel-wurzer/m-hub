// Clip "objekt-anlegen": ein Gebäude zu den eigenen Objekten nehmen und seine
// Struktur festlegen.
//
// Der Weg führt über die Karte: Gebäude suchen, auswählen, hinzufügen. Im
// selben Dialog wird die Gebäudestruktur definiert, Geschoss für Geschoss.
//
// Lauf: node objekt-clip.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync, renameSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

const BASE = process.env.DEMO_BASE || 'http://localhost:8910';
const VW = { width: 1440, height: 900 };
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'video');
const ROH = join(OUT, '_raw_objekt');
const TOKEN = process.env.DEMO_TOKEN || readFileSync(join(HERE, '.token'), 'utf8').trim();

const ADRESSE = process.env.DEMO_ADRESSE || 'Garnisongasse 7';
const NAME = 'Gründerzeithaus Garnisongasse 7';

// Geschosse von oben nach unten, so wie der Dialog sie anlegt.
const GESCHOSSE = [
  { anzahl: '5', hoehe: '340', flaeche: '390', bezeichnung: 'Regelgeschoss' },
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
}, TOKEN);

const page = await context.newPage();
const warte = (ms) => page.waitForTimeout(ms);
const gesprochen = [];
const sagen = (text) => gesprochen.push(text);
const t0 = Date.now();
const takt = (was) => console.log('   %ds  %s', Math.round((Date.now() - t0) / 1000), was);

async function zeigenUndKlicken(locator, ruhe = 700) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  // Das Schweben ist nur fuer den sichtbaren Zeiger; im Dialog kann die
  // Stabilitaetspruefung fehlschlagen, ohne dass der Klick ein Problem waere.
  await locator.hover({ timeout: 4000 }).catch(() => {});
  await warte(ruhe);
  await locator.click({ timeout: 10000, force: true });
}

async function tippen(locator, text, verzoegerung = 45) {
  await zeigenUndKlicken(locator, 400);
  await locator.fill('');
  await locator.type(text, { delay: verzoegerung });
}

const feld = (label) =>
  page.locator(`mat-dialog-container mat-form-field:has(mat-label:text-is("${label}")) input`).first();

try {
  await page.goto(BASE + '/karte', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await warte(1500);
  sagen('Ein Gebäude wird zum eigenen Objekt, sobald man es übernimmt');
  await warte(2200);

  sagen('Adresse suchen');
  await zeigenUndKlicken(page.locator('.leaflet-control-geocoder-icon').first(), 700);
  await warte(600);
  const suche = page.locator('input[placeholder="Suchen.."]').first();
  await suche.click();
  await suche.type(ADRESSE, { delay: 70 });
  await warte(800);
  await page.keyboard.press('Enter');
  await warte(2400);

  const treffer = page.locator('.leaflet-control-geocoder-alternatives li').first();
  if (await treffer.count()) {
    await zeigenUndKlicken(treffer, 800);
    await warte(4000);
  }
  await warte(2200);
  takt('gebaeude gewaehlt');

  sagen('Die Stadtdaten sind da, jetzt kommt das eigene Wissen dazu');
  await warte(2400);
  await zeigenUndKlicken(page.getByRole('button', { name: 'Gebäude hinzufügen' }).first(), 900);
  await warte(2000);
  takt('dialog offen');

  sagen('Name und Adresse');
  await tippen(feld('Name'), NAME);
  await warte(700);
  const adresse = feld('Adresse');
  if (!(await adresse.inputValue().catch(() => ''))) {
    await tippen(adresse, 'Garnisongasse 7, 1090 Wien', 30);
  }
  await warte(900);

  sagen('Und die Gebäudestruktur, Geschoss für Geschoss');
  const dachtyp = page.locator(
    'mat-dialog-container mat-form-field:has(mat-label:text-is("Dachtyp")) mat-select').first();
  if (await dachtyp.count().catch(() => 0)) {
    await zeigenUndKlicken(dachtyp, 600);
    await warte(900);
    await page.locator('mat-option').first().click({ timeout: 6000 }).catch(() => {});
    await warte(900);
  }

  for (const g of GESCHOSSE) {
    for (const [label, wert] of [
      ['Anzahl der Geschosse', g.anzahl],
      ['Geschosshöhe (cm)', g.hoehe],
      ['Geschossfläche (m²)', g.flaeche],
    ]) {
      const f = feld(label);
      if (await f.count().catch(() => 0)) await tippen(f, wert, 80);
      await warte(600);
    }
  }
  takt('struktur gesetzt');

  sagen('Fünf Regelgeschosse mit 3,40 Meter Raumhöhe, typisch Gründerzeit');
  await warte(2600);

  const anlegen = page.locator('mat-dialog-container button:has-text("Hinzufügen")').last();
  sagen('Übernehmen');
  await zeigenUndKlicken(anlegen, 900);
  await warte(3000);
  takt('angelegt');

  sagen('Das Gebäude steht jetzt in der eigenen Objektliste');
  await page.goto(BASE + '/bestandsverwaltung', { waitUntil: 'networkidle', timeout: 30000 })
    .catch(() => {});
  await warte(3200);
  const angelegt = await page.getByText(NAME).count().catch(() => 0);
  console.log('   in der Liste gefunden:', angelegt > 0);
  takt('ende');
} catch (e) {
  console.log('  abgebrochen:', String(e).slice(0, 140));
}

await page.screenshot({ path: join(OUT, 'objekt-anlegen.png') }).catch(() => {});
await context.close();
await browser.close();

const NL = String.fromCharCode(10);
writeFileSync(join(OUT, 'objekt-anlegen.txt'),
  ['Objekt anlegen und Gebäudestruktur definieren', '']
    .concat(gesprochen.map((z) => '· ' + z)).join(NL) + NL, 'utf8');

const webm = readdirSync(ROH).filter((f) => f.endsWith('.webm')).sort();
if (webm.length) {
  renameSync(join(ROH, webm[webm.length - 1]), join(OUT, 'objekt-anlegen.webm'));
  console.log('objekt-anlegen aufgenommen');
}
