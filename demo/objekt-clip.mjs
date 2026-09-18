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
  { anzahl: '5', hoehe: '340', flaeche: '390', bezeichnung: 'Wohngeschosse mit Mittelmauer' },
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

/** Tippt, ohne das Formular erneut zu verschieben. Fuer Felder, die schon im
 *  Bild stehen: sonst springt der Dialog bei jedem Feldwechsel. */
async function tippenRuhig(locator, text, verzoegerung = 30) {
  await locator.click({ timeout: 8000, force: true });
  await warte(180);
  await locator.fill('');
  await locator.type(text, { delay: verzoegerung });
}

async function tippen(locator, text, verzoegerung = 30) {
  await zeigenUndKlicken(locator, 220);
  await locator.fill('');
  await locator.type(text, { delay: verzoegerung });
}

const feld = (label) =>
  page.locator(`mat-dialog-container mat-form-field:has(mat-label:text-is("${label}")) input`).first();

try {
  await page.goto(BASE + '/karte', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await warte(700);
  sagen('Ein Gebäude wird zum eigenen Objekt, sobald man es übernimmt');
  await warte(1200);

  sagen('Adresse suchen');
  await zeigenUndKlicken(page.locator('.leaflet-control-geocoder-icon').first(), 300);
  await warte(300);
  const suche = page.locator('input[placeholder="Suchen.."]').first();
  await suche.click();
  await suche.type(ADRESSE, { delay: 35 });
  await warte(400);
  await page.keyboard.press('Enter');
  await warte(1600);

  const treffer = page.locator('.leaflet-control-geocoder-alternatives li').first();
  if (await treffer.count()) {
    await zeigenUndKlicken(treffer, 400);
    await warte(3000);
  }
  await warte(1200);
  takt('gebaeude gewaehlt');

  sagen('Die Stadtdaten sind da, jetzt kommt das eigene Wissen dazu');
  await warte(1400);
  await zeigenUndKlicken(page.getByRole('button', { name: 'Gebäude hinzufügen' }).first(), 500);
  await warte(1200);
  takt('dialog offen');

  sagen('Name und Adresse');
  await tippenRuhig(feld('Name'), NAME, 22);
  await warte(350);
  const adresse = feld('Adresse');
  if (!(await adresse.inputValue().catch(() => ''))) {
    await tippenRuhig(adresse, 'Garnisongasse 7, 1090 Wien', 18);
  }
  await warte(500);

  sagen('Und die Gebäudestruktur, Geschoss für Geschoss');
  const dachtyp = page.locator(
    'mat-dialog-container mat-form-field:has(mat-label:text-is("Dachtyp")) mat-select').first();
  if (await dachtyp.count().catch(() => 0)) {
    await zeigenUndKlicken(dachtyp, 300);
    await warte(500);
    // Gezielt greifen statt die erste Zeile nehmen, das ist der Platzhalter.
    const wahl = page.locator('mat-option >> text="Steildach"').first();
    await (await wahl.count() ? wahl : page.locator('mat-option').nth(1))
      .click({ timeout: 6000 }).catch(() => {});
    await warte(500);
  }

  // Einmal zum Geschoss scrollen, danach nur noch tippen.
  await feld('Anzahl der Geschosse').scrollIntoViewIfNeeded().catch(() => {});
  await warte(500);
  for (const g of GESCHOSSE) {
    for (const [label, wert] of [
      ['Anzahl der Geschosse', g.anzahl],
      ['Geschosshöhe (cm)', g.hoehe],
      ['Geschossfläche (m²)', g.flaeche],
    ]) {
      const f = feld(label);
      if (await f.count().catch(() => 0)) await tippenRuhig(f, wert, 70);
      await warte(600);
    }
    // Die zweite "Bezeichnung" gehoert zum Geschoss, die erste zum Dach.
    const bez = page.locator(
      'mat-dialog-container mat-form-field:has(mat-label:text-is("Bezeichnung")) input').nth(1);
    if (await bez.count().catch(() => 0)) await tippenRuhig(bez, g.bezeichnung, 45);
    await warte(700);
  }
  takt('struktur gesetzt');

  sagen('Fünf Regelgeschosse mit 3,40 Meter Raumhöhe, typisch Gründerzeit');
  await warte(1600);

  const anlegen = page.locator('mat-dialog-container button:has-text("Hinzufügen")').last();
  sagen('Übernehmen');
  // Eine Sekunde stehenlassen, damit das ausgefuellte Formular lesbar ist.
  await warte(1000);
  await zeigenUndKlicken(anlegen, 500);
  await warte(2400);
  takt('angelegt');

  sagen('Das Gebäude steht jetzt in der eigenen Objektliste');
  await page.goto(BASE + '/bestandsverwaltung', { waitUntil: 'networkidle', timeout: 30000 })
    .catch(() => {});
  await warte(2600);
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
