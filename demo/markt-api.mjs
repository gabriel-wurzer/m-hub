// Clip "markt-api": der m-hub-Markt ueber die Schnittstelle.
//
// Die Aufrufe laufen wirklich gegen die API, die Antworten werden mitgeschnitten
// und danach in einem nachgebauten Terminal abgespielt. Ein echtes Terminal
// aufzunehmen waere aufwendiger, ohne mehr zu zeigen, und die Ausgaben waeren
// dieselben.
//
// Lauf: node markt-api.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync, renameSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

const BASE = process.env.DEMO_BASE || 'http://localhost:8910';
const OEFFENTLICH = process.env.DEMO_PUBLIC_BASE || BASE;
const VW = { width: 1280, height: 800 };
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'video');
const TOKEN = process.env.DEMO_TOKEN || readFileSync(join(HERE, '.token'), 'utf8').trim();

mkdirSync(OUT, { recursive: true });

/** Kuerzt lange JSON-Antworten auf das, was im Clip lesbar bleibt. */
function kuerzen(text, zeilen = 16) {
  const alle = text.split('\n');
  if (alle.length <= zeilen) return text;
  return alle.slice(0, zeilen).join('\n') + `\n… (${alle.length - zeilen} weitere Zeilen)`;
}

async function hole(pfad, optionen = {}) {
  const antwort = await fetch(BASE + pfad, optionen);
  const roh = await antwort.text();
  try {
    return { status: antwort.status, text: JSON.stringify(JSON.parse(roh), null, 2) };
  } catch {
    return { status: antwort.status, text: roh };
  }
}

// --- echte Aufrufe ------------------------------------------------------
const schritte = [];

const kategorien = await hole('/api/market-listing/categories/counts');
schritte.push({
  kommentar: 'Welche Kategorien hat der Markt, und wie viel liegt drin?',
  befehl: `curl -s ${OEFFENTLICH}/api/market-listing/categories/counts`,
  ausgabe: kuerzen(kategorien.text, 14),
});

const suche = await hole('/api/market-listings/search?q=Ziegel');
schritte.push({
  kommentar: 'Volltextsuche, ohne Anmeldung',
  befehl: `curl -s '${OEFFENTLICH}/api/market-listings/search?q=Ziegel'`,
  ausgabe: kuerzen(suche.text, 18),
});

// Erste Inserats-ID aus der Suche ziehen, damit der Clip nicht auf eine
// fest verdrahtete ID angewiesen ist.
let listingId = null;
try {
  const treffer = JSON.parse(suche.text);
  listingId = Array.isArray(treffer) && treffer.length ? treffer[0].id : null;
} catch { /* ohne Treffer bleibt der Medien-Aufruf weg */ }

if (listingId) {
  const medien = await hole(`/api/market-listings/${listingId}/media`);
  schritte.push({
    kommentar: 'Und das Neue: die Medien am Inserat',
    befehl: `curl -s ${OEFFENTLICH}/api/market-listings/${listingId}/media`,
    ausgabe: kuerzen(medien.text, 18),
  });
}

schritte.push({
  kommentar: 'Schreiben braucht ein Token, Lesen nicht',
  befehl: `curl -s -X POST ${OEFFENTLICH}/api/market-listings/<id>/media \\\n`
        + `  -H 'Authorization: Bearer <token>' \\\n`
        + `  -d '{"document_ids":["…"]}'`,
  ausgabe: '[ { "name": "Handwaschbecken (Gaussian Splat)", "file_type": "ply", … } ]',
});

writeFileSync(join(OUT, 'markt-api.json'), JSON.stringify(schritte, null, 2), 'utf8');

// --- Terminal nachbauen und abspielen -----------------------------------
const seite = `<!doctype html><meta charset="utf-8"><title>m-hub API</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; background:#12151a; color:#d7dde5;
         font:15px/1.55 "Cascadia Code","Consolas",monospace; }
  .kopf { padding:10px 18px; background:#1b1f27; color:#8b95a3; font-size:13px;
          border-bottom:1px solid #262c36; }
  .schirm { padding:18px 22px; white-space:pre-wrap; }
  .kommentar { color:#6f7b8a; margin-top:18px; }
  .zeile { color:#e6edf5; }
  .prompt { color:#5ec4a0; }
  .ausgabe { color:#9fb3c8; }
  .cursor { background:#5ec4a0; color:#12151a; }
</style>
<div class="kopf">m-hub · Marktplatz über die Schnittstelle</div>
<div class="schirm" id="s"></div>
<script>
const schritte = ${JSON.stringify(schritte)};
const s = document.getElementById('s');
const warte = ms => new Promise(r => setTimeout(r, ms));
function el(cls, text) { const d = document.createElement('div'); d.className = cls; d.textContent = text; s.appendChild(d); return d; }
(async () => {
  for (const schritt of schritte) {
    el('kommentar', '# ' + schritt.kommentar);
    const zeile = el('zeile', '');
    const p = document.createElement('span'); p.className = 'prompt'; p.textContent = '$ ';
    zeile.appendChild(p);
    const t = document.createElement('span'); zeile.appendChild(t);
    for (const zeichen of schritt.befehl) { t.textContent += zeichen; await warte(18); }
    await warte(500);
    el('ausgabe', schritt.ausgabe);
    window.scrollTo(0, document.body.scrollHeight);
    await warte(2600);
  }
  document.title = 'fertig';
})();
</script>`;
const seitePfad = join(OUT, '_markt-api.html');
writeFileSync(seitePfad, seite, 'utf8');

const roh = join(OUT, '_raw_markt-api');
mkdirSync(roh, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: VW, recordVideo: { dir: roh, size: VW }, deviceScaleFactor: 1,
});
const page = await context.newPage();
await page.goto('file://' + seitePfad.replace(/\\/g, '/'));
await page.waitForFunction(() => document.title === 'fertig', { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(2500);
await page.screenshot({ path: join(OUT, 'markt-api.png') });
await context.close();
await browser.close();

const NL = String.fromCharCode(10);
writeFileSync(join(OUT, 'markt-api.txt'),
  ['markt-api', ''].concat(schritte.map((s) => '· ' + s.kommentar)).join(NL) + NL, 'utf8');

const webm = readdirSync(roh).filter((f) => f.endsWith('.webm')).sort();
if (webm.length) {
  renameSync(join(roh, webm[webm.length - 1]), join(OUT, 'markt-api.webm'));
  console.log('markt-api aufgenommen,', schritte.length, 'Aufrufe');
}
