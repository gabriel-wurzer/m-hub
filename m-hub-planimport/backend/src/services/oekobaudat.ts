// ÖKOBAU.dat proxy + local cache.
//
// The ÖKOBAU.dat public instance serves ILCD data via a Soda4LCA REST API at:
//   https://www.oekobaudat.de/OEKOBAU.DAT/resource/processes?search=true&name=<q>&format=json
//
// Docs: https://www.oekobaudat.de and Soda4LCA service specification.
// We:
//   - Proxy search queries through our backend (avoids CORS pain in the browser).
//   - Cache responses in a local JSON file keyed by normalized query so repeated
//     typing in the autocomplete is instant and we don't hammer their server.
//   - Fall back to a bundled seed list of common materials if the remote call
//     fails (offline dev, firewalled environments).

import fs from 'node:fs/promises';
import path from 'node:path';

const OEKOBAUDAT_BASE =
  'https://www.oekobaudat.de/OEKOBAU.DAT/resource';
const CACHE_FILE = path.resolve(process.cwd(), 'data', 'oekobaudat-cache.json');

export interface OekobaudatHit {
  uuid: string;
  name: string;
  category?: string;
  /** Full ILCD dataset URL on the remote server, if known. */
  sourceUrl?: string;
}

type Cache = Record<string, { ts: number; hits: OekobaudatHit[] }>;

const MEM_CACHE: Cache = {};
let loaded = false;

async function loadDiskCache(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await fs.readFile(CACHE_FILE, 'utf8');
    Object.assign(MEM_CACHE, JSON.parse(raw));
  } catch {
    // no cache yet — fine
  }
}

async function persistCache(): Promise<void> {
  try {
    await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(MEM_CACHE, null, 2), 'utf8');
  } catch {
    // best-effort
  }
}

export async function searchOekobaudat(query: string): Promise<OekobaudatHit[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  await loadDiskCache();

  const cached = MEM_CACHE[q];
  const FRESH_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
  if (cached && Date.now() - cached.ts < FRESH_MS) {
    return cached.hits;
  }

  let hits: OekobaudatHit[] = [];
  try {
    const url = `${OEKOBAUDAT_BASE}/processes?search=true&name=${encodeURIComponent(q)}&format=json&pageSize=25`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const json: any = await res.json();
      // Soda4LCA returns { data: [ { uuid, name, classific, ... } ] }
      const arr: any[] = Array.isArray(json?.data) ? json.data : [];
      hits = arr.map((d) => ({
        uuid: String(d.uuid ?? d.uuidAsString ?? ''),
        name: String(
          d.name?.value ?? d.name ?? d.baseName ?? 'Unknown',
        ),
        category: firstString(d.classific ?? d.classificationInformation),
        sourceUrl: d.uuid
          ? `${OEKOBAUDAT_BASE}/processes/${d.uuid}`
          : undefined,
      })).filter((h) => h.uuid);
    }
  } catch {
    // fall through to seed list
  }

  if (hits.length === 0) {
    hits = SEED_MATERIALS.filter((m) => m.name.toLowerCase().includes(q));
  }

  MEM_CACHE[q] = { ts: Date.now(), hits };
  await persistCache();
  return hits;
}

function firstString(v: any): string | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return firstString(v[0]);
  if (typeof v === 'object') {
    for (const k of Object.keys(v)) {
      const s = firstString(v[k]);
      if (s) return s;
    }
  }
  return undefined;
}

// Offline fallback — covers the most common construction materials so the UI
// remains usable when the remote ÖKOBAU.dat service is unreachable. UUIDs are
// deliberately synthetic (prefixed `seed-`) so they can be distinguished from
// real ÖKOBAU.dat entries and later upgraded when connectivity returns.
const SEED_MATERIALS: OekobaudatHit[] = [
  { uuid: 'seed-brick-solid', name: 'Ziegel, Vollziegel', category: 'Mineralische Baustoffe' },
  { uuid: 'seed-brick-hollow', name: 'Ziegel, Hochlochziegel', category: 'Mineralische Baustoffe' },
  { uuid: 'seed-mortar-lime-cement', name: 'Kalkzementmörtel', category: 'Mineralische Baustoffe' },
  { uuid: 'seed-mortar-cement', name: 'Zementmörtel', category: 'Mineralische Baustoffe' },
  { uuid: 'seed-mortar-lime', name: 'Kalkmörtel', category: 'Mineralische Baustoffe' },
  { uuid: 'seed-concrete-c25', name: 'Beton C25/30', category: 'Mineralische Baustoffe' },
  { uuid: 'seed-concrete-reinforced', name: 'Stahlbeton', category: 'Mineralische Baustoffe' },
  { uuid: 'seed-aac', name: 'Porenbeton', category: 'Mineralische Baustoffe' },
  { uuid: 'seed-sand-lime-brick', name: 'Kalksandstein', category: 'Mineralische Baustoffe' },
  { uuid: 'seed-eps', name: 'EPS Wärmedämmung', category: 'Dämmstoffe' },
  { uuid: 'seed-xps', name: 'XPS Wärmedämmung', category: 'Dämmstoffe' },
  { uuid: 'seed-mineralwool', name: 'Mineralwolle', category: 'Dämmstoffe' },
  { uuid: 'seed-woodfibre', name: 'Holzfaserdämmplatte', category: 'Dämmstoffe' },
  { uuid: 'seed-gypsum-board', name: 'Gipskartonplatte', category: 'Innenausbau' },
  { uuid: 'seed-gypsum-plaster', name: 'Gipsputz', category: 'Innenausbau' },
  { uuid: 'seed-lime-plaster', name: 'Kalkputz', category: 'Innenausbau' },
  { uuid: 'seed-timber-softwood', name: 'Nadelholz KVH', category: 'Holz' },
  { uuid: 'seed-clt', name: 'Brettsperrholz (CLT)', category: 'Holz' },
  { uuid: 'seed-osb', name: 'OSB-Platte', category: 'Holz' },
  { uuid: 'seed-steel-profile', name: 'Stahlprofil', category: 'Metalle' },
];
