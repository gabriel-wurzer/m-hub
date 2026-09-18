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

const INSERAT = process.env.DEMO_LISTING || 'Mauerziegel massiv, ca. 1875';

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

    // Sichtbarer Mauszeiger: Playwright rendert keinen, im Video sieht man sonst
    // nicht, worauf geklickt wird. Rein dekorativ, faengt keine Klicks ab.
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
        punkt.style.borderWidth = '3px';
      }, true);
      document.addEventListener('mouseup', () => {
        punkt.style.background = 'rgba(13,97,46,.22)';
        punkt.style.borderWidth = '2px';
      }, true);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', zeichnen);
    } else {
      zeichnen();
    }
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

  async function zeigenUndKlicken(locator, ruhe = 700) {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await locator.hover();
    await warte(ruhe);
    await locator.click();
  }

  /** Inserate liegen im Zustand von /markt, nach einem Viewer klickt man sich neu hin. */
  async function oeffne(kategorie, inserat) {
    await page.goto(BASE + '/markt', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await warte(1400);
    await zeigenUndKlicken(page.getByText(kategorie).first(), 900);
    await warte(1800);
    await zeigenUndKlicken(page.getByText(inserat).first(), 900);
    await warte(2200);
    await page.locator('.listing-media').first()
      .scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
  }

  await page.goto(BASE + '/markt', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await warte(1300);
  sagen('Der Marktplatz: wiederverwendbare Bauteile, nach Materialgruppen');
  await warte(2600);
  takt('markt');

  // --- Ziegel: Foto und Zertifikat ---
  sagen('Mineralik: Ziegel, Beton, Estrich');
  await zeigenUndKlicken(page.getByText('Mineralik').first(), 900);
  await warte(2600);
  sagen('Mauerziegel von 1875, 10.000 Stück aus einem einzigen Rückbau');
  await zeigenUndKlicken(page.getByText('Mauerziegel massiv, ca. 1875').first(), 900);
  await warte(2600);
  sagen('Am Inserat hängen Foto und Rezertifizierung');
  await page.locator('.listing-media').first()
    .scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
  await warte(3000);
  takt('ziegel offen');

  const zertifikat = await page
    .locator('.listing-media-item:has-text("rezertifizierung") a:has-text("Herunterladen")').first()
    .getAttribute('href', { timeout: 5000 }).catch(() => null);
  if (zertifikat) {
    sagen('Welche Normen der Ziegel heute erfüllt, steht im Zertifikat');
    await page.goto(new URL(zertifikat, BASE).toString(), { timeout: 30000 }).catch(() => {});
    await warte(5500);
    takt('zertifikat');
  }

  // --- Waschbecken: Splat ---
  sagen('Ein Objekt aus demselben Haus: das Waschbecken');
  await oeffne('Sonstige', 'Handwaschbecken, Gusseisen emailliert');
  await warte(2200);
  takt('waschbecken offen');

  const splat = await page.locator('.listing-media a:has-text("3D ansehen")').first()
    .getAttribute('href', { timeout: 5000 }).catch(() => null);
  if (splat) {
    sagen('Hier hängt der Gaussian Splat aus der Begehung');
    await page.goto(new URL(splat, BASE).toString(), { timeout: 90000 }).catch(() => {});
    await page.waitForFunction(
      () => (document.body.innerText || '').includes('Loaded'), { timeout: 60000 }).catch(() => {});
    await warte(900);
    sagen('Einmal rundherum, bevor man kauft');
    await page.getByRole('button', { name: 'Spin off' }).click({ timeout: 5000 }).catch(() => {});
    await warte(14000);
    takt('rotation');
    sagen('Vom Bestand über die Begehung bis ins Inserat, ohne Medienbruch');
    await warte(2600);
  }
  takt('ende');
}

// ------------------------------------------------------------- Einbringen
async function einbringen(page, sagen) {
  const warte = (ms) => page.waitForTimeout(ms);
  const t0 = Date.now();
  const takt = (was) => console.log('   %ds  %s', Math.round((Date.now() - t0) / 1000), was);

  /** Erst hinfahren, dann klicken: der eingeblendete Zeiger soll den Weg zeigen. */
  async function zeigenUndKlicken(locator, ruhe = 700) {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await locator.hover();
    await warte(ruhe);
    await locator.click();
  }

  async function tippen(locator, text, verzoegerung = 45) {
    await zeigenUndKlicken(locator, 400);
    await locator.fill('');
    await locator.type(text, { delay: verzoegerung });
  }

  const feld = (label) =>
    page.locator(`mat-dialog-container mat-form-field:has(mat-label:text-is("${label}")) input`).first();

  await page.goto(BASE + '/bestandsverwaltung', { waitUntil: 'networkidle', timeout: 30000 })
    .catch(() => {});
  await warte(800);
  await zeigenUndKlicken(page.locator('.building-card').first());
  await warte(900);
  await zeigenUndKlicken(page.locator('button:has(mat-icon:text-is("edit"))').first());

  // Die Bestandsuebersicht soll man in Ruhe lesen koennen.
  sagen('Die erfassten Bauteile, Objekte und Dokumente des Gebäudes');
  await warte(5000);
  takt('uebersicht gezeigt');

  sagen('Ein Bauteil lässt sich direkt inserieren');
  await zeigenUndKlicken(page.locator('button[aria-label="Im Markt inserieren"]').first(), 900);
  await warte(1400);
  takt('maske offen');

  sagen('Verkauft wird der Ziegel, nicht die Wand');
  await tippen(page.locator('mat-dialog-container input').first(), 'Mauerziegel massiv, ca. 1875');
  await warte(800);

  const beschreibung = page.locator('mat-dialog-container textarea').first();
  if (await beschreibung.count().catch(() => 0)) {
    await tippen(beschreibung, 'Heinrich Drasche Werke Inzersdorf, Prägung H D mit Doppeladler', 20);
    await warte(900);
  }

  sagen('Preis, Menge und Einheit');
  for (const [label, wert] of [['Preis (€)', '1.60'], ['Anzahl/Menge', '10000']]) {
    const f = feld(label);
    if (await f.count().catch(() => 0)) await tippen(f, wert, 60);
    await warte(700);
  }

  // Einheit ist eine Auswahl, kein Eingabefeld.
  const einheit = page.locator('mat-dialog-container mat-form-field:has(mat-label:text-is("Einheit")) mat-select').first();
  if (await einheit.count().catch(() => 0)) {
    await zeigenUndKlicken(einheit, 600);
    await warte(900);
    await page.locator('mat-option >> text="Stück"').first().click({ timeout: 6000 }).catch(() => {});
    await warte(900);
  }

  // Pflichtfelder, sonst bleibt "Erstellen" deaktiviert.
  for (const [label, wert] of [['Material', 'Ziegel'], ['Status', 'eingelagert'], ['Potential', 'Wiederverwendung']]) {
    const sel = page.locator(
      `mat-dialog-container mat-form-field:has(mat-label:text-is("${label}")) mat-select`).first();
    if (await sel.count().catch(() => 0)) {
      await zeigenUndKlicken(sel, 500);
      await warte(800);
      await page.locator(`mat-option:has-text("${wert}")`).first().click({ timeout: 6000 })
        .catch(() => page.keyboard.press('Escape'));
      await warte(700);
    }
  }
  const datum = feld('Datum (dd.mm.yyyy)');
  if (await datum.count().catch(() => 0)) {
    // Der Datepicker nimmt getippte Zeichen nicht zuverlaessig an; fill setzt
    // den Wert, Tab laesst ihn uebernehmen.
    await zeigenUndKlicken(datum, 500);
    await datum.fill('23.09.2026');
    await datum.press('Tab');
  }
  await warte(900);

  sagen('Die Abmessungen des einzelnen Ziegels');
  for (const [label, wert] of [['Länge (cm)', '30'], ['Breite (cm)', '14'], ['Höhe (cm)', '7']]) {
    const f = feld(label);
    if (await f.count().catch(() => 0)) await tippen(f, wert, 90);
    await warte(600);
  }
  takt('formular gefuellt');

  // Nur eigene Belege: Foto und Zertifikat entstehen bei der Aufbereitung.
  // Splat und Schadstoffbericht gehoeren zur Wand, nicht zum Ziegel.
  sagen('Dazu Eigenes: Foto des Ziegels und die Rezertifizierung');
  // Ursache und Wirkung sichtbar machen: die Datei wird als Kachel von aussen
  // in die Ablageflaeche gezogen und landet dort. Der Datei-Dialog des
  // Betriebssystems gehoert nicht zur Seite und laesst sich nicht aufnehmen.
  const ablage = page.locator('.listing-own-upload').first();
  await ablage.scrollIntoViewIfNeeded().catch(() => {});
  await warte(1200);

  for (const datei of ['ziegel.png', 'rezertifizierung-mauerziegel.pdf']) {
    const inhalt = readFileSync('C:/temp/m-hub/AP6-DISSEMINATION/' + datei).toString('base64');
    const kasten = await ablage.boundingBox();
    if (!kasten) break;
    const ziel = { x: kasten.x + kasten.width / 2, y: kasten.y + 40 };

    // Kachel einblenden und zur Ablageflaeche fliegen lassen.
    await page.evaluate(({ name, ziel }) => {
      const k = document.createElement('div');
      k.id = '__demo_datei';
      k.textContent = name;
      k.style.cssText =
        'position:fixed;left:60px;top:' + (ziel.y + 210) + 'px;z-index:2147483646;' +
        'background:#fff;border:1px solid #c3c9d0;border-radius:8px;padding:10px 14px;' +
        'font:600 13px system-ui,Segoe UI,Arial,sans-serif;color:#2b3138;' +
        'box-shadow:0 8px 24px rgba(0,0,0,.22);pointer-events:none;' +
        'transition:left 1.1s ease-in-out, top 1.1s ease-in-out, opacity .25s';
      document.body.appendChild(k);
      requestAnimationFrame(() => {
        k.style.left = (ziel.x - 80) + 'px';
        k.style.top = ziel.y + 'px';
      });
    }, { name: datei, ziel });

    // Der Zeiger begleitet die Kachel.
    await page.mouse.move(80, ziel.y + 220);
    await warte(150);
    for (let i = 1; i <= 14; i += 1) {
      await page.mouse.move(80 + ((ziel.x - 80) * i) / 14, (ziel.y + 220) - (220 * i) / 14);
      await warte(75);
    }
    await warte(300);

    // Echter Drop mit echtem Dateiinhalt.
    await ablage.dispatchEvent('dragover');
    await warte(500);
    await page.evaluate(async ({ name, b64, typ }) => {
      const binaer = atob(b64);
      const bytes = new Uint8Array(binaer.length);
      for (let i = 0; i < binaer.length; i += 1) bytes[i] = binaer.charCodeAt(i);
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], name, { type: typ }));
      document.querySelector('.listing-own-upload')
        .dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }));
      const k = document.getElementById('__demo_datei');
      if (k) { k.style.opacity = '0'; setTimeout(() => k.remove(), 300); }
    }, { name: datei, b64: inhalt, typ: datei.endsWith('.pdf') ? 'application/pdf' : 'image/png' });
    await warte(1700);
  }
  takt('dateien gewaehlt');

  sagen('Anlegen');
  const anlegen = page.locator('mat-dialog-container button:has-text("Erstellen")').last();
  await zeigenUndKlicken(anlegen, 900);
  await warte(3500);
  takt('inserat angelegt');

  // Und jetzt hinschauen, was daraus geworden ist.
  sagen('Und so steht der Ziegel im Marktplatz');
  await page.goto(BASE + '/markt', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await warte(1600);
  await zeigenUndKlicken(page.getByText('Mineralik').first(), 800);
  await warte(1800);
  await zeigenUndKlicken(page.getByText('Mauerziegel massiv, ca. 1875').first(), 800);
  await warte(3000);
  sagen('Mit Foto und Zertifikat am Inserat');
  await page.locator('.listing-media').first()
    .scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
  await warte(3500);
  takt('ende');
}

const gewuenscht = process.argv.slice(2);
const laeuft = (id) => gewuenscht.length === 0 || gewuenscht.includes(id);

if (laeuft('abfrage')) await aufnehmen('markt-abfrage', abfrage);
if (laeuft('einbringen')) await aufnehmen('markt-einbringen', einbringen);
console.log('fertig');
