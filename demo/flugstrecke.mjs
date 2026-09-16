// m-hub Flugstrecke: geskriptete Bildschirmvideos fuer den Abschlussworkshop.
//
// EIN CLIP JE DEMO-FOLIE. Der Demo-Block dauert 90 Minuten und hat elf
// Vortragende. Ein durchlaufendes Video hilft da niemandem: jede Folie bekommt
// ihren eigenen, lautlosen Clip, der laeuft waehrend die Person spricht und von
// vorne anfaengt, wenn sie laenger braucht.
//
// EDITIERBAR: Die ganze Demo steht als CHAPTERS unten. Schritte umsortieren,
// Untertitel umschreiben, Zeiten anpassen. Wer einen Clip nicht mag, aendert
// hier und dreht neu.
//
// Aktions-Vokabular je Schritt:
//   { goto:'/pfad' }                 Seite aufrufen
//   { caption:'Text' }               Untertitel einblenden ('' blendet aus)
//   { hold:ms }                      stehenbleiben
//   { waitFor:'Text|.selector' }     auf Inhalt warten
//   { click:'.selector' }            klicken
//   { clickText:'Text' }             erstes Element mit diesem Text klicken
//   { type:['.selector','Text'] }    tippen (sichtbar, mit Verzoegerung)
//   { press:'Enter' }                Taste
//   { followLink:'.selector' }       dem href folgen, im selben Fenster
//   { fill:['.selector','wert'] }    Eingabefeld oder Regler setzen
//   { scrollTo:'.selector' }         Element in den Blick scrollen
//   { wheel:[x,y,dy,n] }             n-mal Mausrad an Position x,y
//
// Lauf:  node flugstrecke.mjs                 alle Kapitel
//        node flugstrecke.mjs karte splat     nur diese
//        DEMO_BASE=https://m-hub.dap.tuwien.ac.at node flugstrecke.mjs
//
// Anmeldung: Token aus der Env DEMO_TOKEN oder aus demo/.token (gitignored).
// Ohne Token laufen nur die oeffentlichen Kapitel sinnvoll.
//
// Ergebnis: video/<kapitel>.webm. Umwandeln nach mp4 siehe README.

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync, renameSync, readFileSync, existsSync, mkdirSync } from 'fs';

const BASE = process.env.DEMO_BASE || 'http://localhost:8910';
const VW = { width: 1440, height: 900 };
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'video');
const TOKEN =
  process.env.DEMO_TOKEN ||
  (existsSync(join(HERE, '.token')) ? readFileSync(join(HERE, '.token'), 'utf8').trim() : '');

const ADRESSE = 'Schwarzspanierstrasse 18, Wien';

// Gebaeude-Detail oeffnen. Mehrere Kapitel fangen so an.
const detailOeffnen = [
  { goto: '/bestandsverwaltung' },
  { waitFor: 'Gebäudeliste' },
  { click: '.building-card' },
  { hold: 1200 },
  { click: 'button[aria-label="Struktur anzeigen"]' },
  { hold: 2400 },
];

// ========================= STORYBOARD (hier editieren) =========================
const CHAPTERS = [
  {
    id: 'karte',
    folie: '8 Karte → Suche → Zusammensetzung',
    steps: [
      { goto: '/karte' },
      { waitFor: '.leaflet-container' },
      { hold: 1800 },
      { caption: 'Der Wiener Gebäudebestand als Materiallager' },
      { hold: 2600 },
      { caption: 'Ein Gebäude suchen: Schwarzspanierstraße 18' },
      { click: '.leaflet-control-geocoder-icon' },
      { hold: 800 },
      { type: ['input[placeholder="Suchen.."]', ADRESSE] },
      { hold: 1000 },
      { press: 'Enter' },
      { hold: 5000 },
      { caption: 'Bauperiode und Typ liefern die erwartete Materialzusammensetzung' },
      { hold: 2600 },
      { wheel: [1240, 520, 260, 4] },
      { hold: 3600 },
    ],
  },
  {
    id: 'einbringen',
    folie: '9 Einloggen → Einbringen',
    steps: [
      { goto: '/bestandsverwaltung' },
      { waitFor: 'Gebäudeliste' },
      { hold: 1600 },
      { caption: 'Angemeldet: vom Betrachten zum Mitmachen' },
      { hold: 3000 },
      { caption: 'Eigene Objekte, eigene Daten. Die Datenhoheit bleibt beim Einbringenden.' },
      { hold: 3600 },
    ],
  },
  {
    id: 'schadstoff',
    folie: '10 Tippen → Querverweis Schad- und Störstoff',
    steps: [
      ...detailOeffnen,
      { scrollTo: 'text=Dokumente' },
      { hold: 1600 },
      { caption: 'Am Gebäude hängt die Schad- und Störstofferkundung' },
      { hold: 2600 },
      { click: 'mat-list-item:has-text("Schad- und Störstoff")' },
      { hold: 5000 },
      { caption: 'Frühe Warnung für Rückbau und Entsorgung' },
      { hold: 3000 },
    ],
  },
  {
    id: 'mgp',
    folie: '11a Materieller Gebäudepass',
    steps: [
      ...detailOeffnen,
      { scrollTo: 'button:has-text("Materieller Gebäudepass")' },
      { hold: 1800 },
      { caption: 'Materieller Gebäudepass: Mengen je Materialgruppe, als CSV' },
      { hold: 4200 },
    ],
  },
  {
    id: 'kataster',
    folie: '11b Materialkataster (stadtweit)',
    steps: [
      { goto: '/statistik' },
      { waitFor: 'Sand, Kies, Stein' },
      { hold: 1600 },
      { caption: 'Dasselbe für den ganzen Bestand: rund 165.000 Gebäude' },
      { hold: 2600 },
      { click: '.us-period-select mat-select' },
      { hold: 900 },
      { click: 'mat-option:has-text("bis 1918")' },
      { hold: 1200 },
      { caption: 'Je Bauperiode wählbar: bis 1918 ist Ziegel statt Beton' },
      { hold: 3400 },
      { scrollTo: '.us-table' },
      { hold: 2600 },
    ],
  },
  {
    id: 'katalog',
    folie: '12 Aufbauten-Katalog (Material-KI)',
    steps: [
      { goto: '/katalog' },
      { waitFor: 'Putz → Ziegel → Putz' },
      { hold: 1600 },
      { caption: 'Typische Schichtfolgen je Bauperiode, Lage und Bauteil' },
      { hold: 3000 },
      { wheel: [700, 500, 300, 3] },
      { hold: 2400 },
      { caption: 'Gemessen wo Daten da sind, vom Markov-Modell wo nicht' },
      { hold: 3400 },
    ],
  },
  {
    id: 'punktwolke',
    folie: '13a Punktwolke',
    steps: [
      ...detailOeffnen,
      { scrollTo: 'text=Dokumente' },
      { hold: 1200 },
      { caption: 'Laserscan des Stiegenhauses, 20,6 Mio Punkte' },
      { click: 'mat-list-item:has-text("Vorschau")' },
      { hold: 2600 },
      { followLink: 'a:has-text("3D ansehen")' },
      { hold: 8000 },
      { caption: 'Ausgedünnte Vorschau, direkt im Browser drehbar' },
      { hold: 2400 },
      { caption: '20,6 Mio Punkte auf 251.478 ausgedünnt, 5 MB statt 236' },
      { hold: 4000 },
    ],
  },
  {
    id: 'ifc',
    folie: '13b IFC',
    steps: [
      ...detailOeffnen,
      { scrollTo: 'text=Dokumente' },
      { hold: 1200 },
      { caption: 'Aus der Punktwolke wird ein reduziertes IFC' },
      { click: 'mat-list-item:has-text("Gebäudemodell")' },
      { hold: 2600 },
      { followLink: 'a:has-text("3D ansehen")' },
      { hold: 14000 },
      { caption: 'Bauteile einzeln, mit Materialbilanz je Bauteil' },
      { hold: 4000 },
    ],
  },
  {
    id: 'splat',
    folie: '14 Splats → Marktplatz',
    steps: [
      ...detailOeffnen,
      { scrollTo: 'text=Dokumente' },
      { hold: 1200 },
      { caption: 'Einzelne Bauteile als Gaussian Splat' },
      { click: 'mat-list-item:has-text("Handwaschbecken")' },
      { hold: 2600 },
      { followLink: 'a:has-text("3D ansehen")' },
      { hold: 11000 },
      { caption: 'Fotorealistisch im Browser, Kandidat für den Marktplatz' },
      { hold: 4000 },
    ],
  },
  {
    id: 'markt',
    folie: '16 Marktplatz',
    steps: [
      { goto: '/markt' },
      { hold: 2400 },
      { caption: 'Wiederverwendbare Bauteile anbieten und finden' },
      { hold: 3600 },
      { caption: 'Vom Bestand zum handelbaren Material' },
      { hold: 3000 },
    ],
  },
];
// ==============================================================================

const wanted = process.argv.slice(2);
const chapters = wanted.length ? CHAPTERS.filter((c) => wanted.includes(c.id)) : CHAPTERS;
if (!chapters.length) {
  console.error('Kein Kapitel getroffen. Vorhanden:', CHAPTERS.map((c) => c.id).join(', '));
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

for (const chapter of chapters) {
  const dir = join(OUT, '_raw_' + chapter.id);
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({
    viewport: VW,
    recordVideo: { dir, size: VW },
    deviceScaleFactor: 1,
  });
  if (TOKEN) {
    await context.addInitScript((t) => {
      try { sessionStorage.setItem('auth_token', t); } catch { /* egal */ }
    }, TOKEN);
  }
  const page = await context.newPage();
  const wait = (ms) => page.waitForTimeout(ms);

  const caption = (text) =>
    page.evaluate((t) => {
      let el = document.getElementById('__demo_caption');
      if (!el) {
        el = document.createElement('div');
        el.id = '__demo_caption';
        el.style.cssText =
          'position:fixed;left:50%;bottom:34px;transform:translateX(-50%);z-index:2147483647;' +
          'background:rgba(13,97,46,.92);color:#fff;padding:12px 22px;border-radius:10px;' +
          'font:600 19px/1.35 system-ui,Segoe UI,Arial,sans-serif;max-width:80vw;' +
          'text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.35);transition:opacity .3s;' +
          // Nie Klicks abfangen: der Untertitel liegt sonst ueber dem untersten
          // Listeneintrag und schluckt den Klick darauf.
          'pointer-events:none';
        document.body.appendChild(el);
      }
      el.textContent = t || '';
      el.style.opacity = t ? '1' : '0';
    }, text).catch(() => {});

  async function dismissDialogs() {
    for (const label of ['Verstanden', 'OK', 'Akzeptieren']) {
      const btn = page.getByRole('button', { name: label });
      if (await btn.count().catch(() => 0)) {
        await btn.first().click({ timeout: 1500 }).catch(() => {});
        await wait(300);
      }
    }
  }

  for (const step of chapter.steps) {
    try {
      if (step.goto) {
        await page.goto(BASE + step.goto, { waitUntil: 'networkidle', timeout: 25000 })
          .catch(() => page.goto(BASE + step.goto, { timeout: 25000 }).catch(() => {}));
        await dismissDialogs();
      }
      if (step.waitFor) {
        const loc = step.waitFor.startsWith('.') || step.waitFor.startsWith('#')
          ? page.locator(step.waitFor)
          : page.getByText(step.waitFor);
        await loc.first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
      }
      if (step.caption !== undefined) await caption(step.caption);
      if (step.scrollTo) {
        await page.locator(step.scrollTo).first()
          .scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {});
      }
      if (step.wheel) {
        const [x, y, dy, n] = step.wheel;
        await page.mouse.move(x, y);
        for (let i = 0; i < n; i += 1) { await page.mouse.wheel(0, dy); await wait(650); }
      }
      if (step.type) {
        const [sel, text] = step.type;
        await page.locator(sel).first().click({ timeout: 5000 });
        await page.locator(sel).first().type(text, { delay: 80 });
      }
      if (step.fill) {
        const [sel, value] = step.fill;
        await page.locator(sel).first().fill(String(value), { timeout: 6000 });
        await page.locator(sel).first().dispatchEvent('input');
        await page.locator(sel).first().dispatchEvent('change');
      }
      if (step.press) await page.keyboard.press(step.press);
      if (step.followLink) {
        const href = await page.locator(step.followLink).first()
          .getAttribute('href', { timeout: 6000 });
        if (href) {
          await page.goto(new URL(href, page.url()).toString(), { timeout: 30000 })
            .catch(() => {});
        }
      }
      if (step.click) await page.locator(step.click).first().click({ timeout: 6000 });
      if (step.clickText) await page.getByText(step.clickText).first().click({ timeout: 6000 });
      if (step.hold) await wait(step.hold);
    } catch (err) {
      // Ein Schritt darf scheitern, das Kapitel laeuft weiter. Am Ende steht im
      // Log, wo es geklemmt hat.
      console.log(`  [${chapter.id}] Schritt uebersprungen:`, JSON.stringify(step).slice(0, 70));
    }
  }

  await caption('');
  await wait(400);
  await page.screenshot({ path: join(OUT, `${chapter.id}.png`) }).catch(() => {});
  await context.close();

  const webm = readdirSync(dir).filter((f) => f.endsWith('.webm')).sort();
  if (webm.length) {
    renameSync(join(dir, webm[webm.length - 1]), join(OUT, `${chapter.id}.webm`));
    console.log(`${chapter.id.padEnd(12)} ${chapter.folie}`);
  } else {
    console.log(`${chapter.id.padEnd(12)} KEIN VIDEO`);
  }
}

await browser.close();
console.log('\nFertig. Clips in', OUT);
