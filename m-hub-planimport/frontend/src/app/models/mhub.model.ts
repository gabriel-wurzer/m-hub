// m-hub ingestion target — the contract, in code.
//
// See ../../../../INGESTION_CONTRACT.md. This module mirrors m-hub's closed
// vocabularies and its `CreateBauteilPayload` shape, and maps assigned buildups
// to that payload. A 2D plan yields geometry; materials/part-types are picked
// from these enums, never extracted. This is the spine the rebuild migrates the
// UI onto — it deliberately does not touch the legacy plan.model.ts yet.

// ── Closed vocabularies (mirror of m-hub-frontend enums) ────────────────────

/** m-hub-frontend/src/app/enums/material-type.enum.ts */
export enum MaterialType {
  Aluminium = 'Aluminium',
  Asphalt = 'Asphalt',
  Beton = 'Beton',
  Bitumen = 'Bitumen',
  'Blähbeton' = 'Blähbeton',
  Blei = 'Blei',
  'Diverse Kunststoffe' = 'Diverse Kunststoffe',
  Eternit = 'Eternit',
  Estrich = 'Estrich',
  Fliesen = 'Fliesen',
  Fliesenkleber = 'Fliesenkleber',
  Glas = 'Glas',
  Heraklith = 'Heraklith',
  Holz = 'Holz',
  Kautschuk = 'Kautschuk',
  Keramik = 'Keramik',
  Kupfer = 'Kupfer',
  Laminat = 'Laminat',
  Linol = 'Linol',
  Messing = 'Messing',
  Mineralfaser = 'Mineralfaser',
  Mineralwolle = 'Mineralwolle',
  'Mörtel' = 'Mörtel',
  Naturstein = 'Naturstein',
  Papier = 'Papier',
  Putz = 'Putz',
  PVC = 'PVC',
  Rigips = 'Rigips',
  Schlacke = 'Schlacke',
  'Schüttung' = 'Schüttung',
  Stahl = 'Stahl',
  Steinzeug = 'Steinzeug',
  Stroh = 'Stroh',
  Styropor = 'Styropor',
  Teppich = 'Teppich',
  Terrazzo = 'Terrazzo',
  Ytong = 'Ytong',
  Ziegel = 'Ziegel',
}

/** m-hub-frontend/src/app/enums/connection-type.enum.ts — the thickness:0 layers */
export enum ConnectionType {
  Klebeverbindung = 'Klebeverbindung',
  Schraubverbindung = 'Schraubverbindung',
  'Schweißverbindung' = 'Schweißverbindung',
  Nietverbindung = 'Nietverbindung',
  Nagelverbindung = 'Nagelverbindung',
  Steckverbindung = 'Steckverbindung',
  'Lötverbindung' = 'Lötverbindung',
  Krimpverbindung = 'Krimpverbindung',
  Pressverbindung = 'Pressverbindung',
  Keilverbindung = 'Keilverbindung',
}

export const UNKNOWN_LAYER_MATERIAL = 'Unbekannt' as const;

export type LayerMaterial =
  | MaterialType
  | ConnectionType
  | typeof UNKNOWN_LAYER_MATERIAL;

export const LAYER_MATERIAL_OPTIONS: readonly LayerMaterial[] = [
  ...Object.values(MaterialType),
  ...Object.values(ConnectionType),
  UNKNOWN_LAYER_MATERIAL,
];

/** True for the joining methods that carry thickness 0 in m-hub. */
export function isConnection(m: LayerMaterial): m is ConnectionType {
  return (Object.values(ConnectionType) as string[]).includes(m as string);
}

/** m-hub-frontend/src/app/enums/part-type.enum.ts — wall subtypes. */
export enum WallPartType {
  Innenwand = 'Innenwand',
  'Außenwand' = 'Außenwand',
  Brandwand = 'Brandwand',
  Kniestock = 'Kniestock',
  Attika = 'Attika',
}

/** Slab subtypes. */
export enum SlabPartType {
  Bodenaufbau = 'Bodenaufbau',
  Dachaufbau = 'Dachaufbau',
}

export type PartType = WallPartType | SlabPartType;

// ── m-hub payload shape (mirror of building-component.ts / part-structure.ts) ─

/** thickness in mm; layer_index 1-based. Connections carry thickness 0. */
export interface MhubLayer {
  layer_index: number;
  material: LayerMaterial;
  thickness: number;
}

export interface WallStructure {
  type: 'wall';
  length: number | null; // meters
  layers: MhubLayer[];
}

export interface SlabStructure {
  type: 'slab';
  area: number | null; // m²
  layers: MhubLayer[];
}

export type PartStructure = WallStructure | SlabStructure;

/** Context m-hub supplies at handoff — the plan cannot know these. */
export interface MhubContext {
  building_id: string;
  user_building_id: string;
  owner_id: string;
  /** One of user_buildings.structure[] labels, e.g. "Regelgeschoss 1". */
  location: string;
}

/** Mirror of m-hub-frontend CreateBauteilPayload. */
export interface CreateBauteilPayload {
  building_id: string;
  user_building_id: string;
  owner_id: string;
  category: 'Bauteil';
  name: string;
  description?: string;
  is_public: boolean;
  is_hazardous: boolean;
  part_type: PartType;
  part_structure: PartStructure;
  location: string;
}

// ── Assigned buildups (the tool's output before payload mapping) ────────────
//
// A buildup is the crux of the rebuild: a set of wall runs sharing one
// Schichtaufbau. length = Σ member run lengths. Two runs with different total
// thickness cannot share a buildup (different Σ layers ⇒ different Bauteil).
// The shaft/void case is a length approximation — no net-volume field exists in
// m-hub (decision 2026-07-09).

export interface WallBuildup {
  partType: WallPartType;
  name: string;
  description?: string;
  is_public: boolean;
  is_hazardous: boolean;
  /** Σ of member run lengths, in mm (geometry already reduced + calibrated). */
  totalLengthMm: number;
  layers: MhubLayer[];
}

export interface SlabBuildup {
  partType: SlabPartType;
  name: string;
  description?: string;
  is_public: boolean;
  is_hazardous: boolean;
  areaM2: number;
  layers: MhubLayer[];
}

// ── Mapping to the payload (unit reconciliation lives here) ──────────────────

const round = (v: number, decimals: number): number => {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
};

/** Re-index layers 1-based and drop empty/None thicknesses to 0. */
function normalizeLayers(layers: MhubLayer[]): MhubLayer[] {
  return layers.map((l, i) => ({
    layer_index: i + 1,
    material: l.material,
    thickness: isConnection(l.material) ? 0 : Math.max(0, Math.round(l.thickness || 0)),
  }));
}

export function wallBuildupToPayload(
  b: WallBuildup,
  ctx: MhubContext,
): CreateBauteilPayload {
  return {
    ...ctx,
    category: 'Bauteil',
    name: b.name,
    description: b.description,
    is_public: b.is_public,
    is_hazardous: b.is_hazardous,
    part_type: b.partType,
    part_structure: {
      type: 'wall',
      length: round(b.totalLengthMm / 1000, 3), // mm → m
      layers: normalizeLayers(b.layers),
    },
  };
}

export function slabBuildupToPayload(
  b: SlabBuildup,
  ctx: MhubContext,
): CreateBauteilPayload {
  return {
    ...ctx,
    category: 'Bauteil',
    name: b.name,
    description: b.description,
    is_public: b.is_public,
    is_hazardous: b.is_hazardous,
    part_type: b.partType,
    part_structure: {
      type: 'slab',
      area: round(b.areaM2, 3),
      layers: normalizeLayers(b.layers),
    },
  };
}

export function toBauteilPayloads(
  walls: WallBuildup[],
  slabs: SlabBuildup[],
  ctx: MhubContext,
): CreateBauteilPayload[] {
  return [
    ...walls.map((w) => wallBuildupToPayload(w, ctx)),
    ...slabs.map((s) => slabBuildupToPayload(s, ctx)),
  ];
}

/** Σ layer thickness (mm) — the buildup's total, to check against measured. */
export function buildupThicknessMm(layers: MhubLayer[]): number {
  return layers.reduce((a, l) => a + (isConnection(l.material) ? 0 : l.thickness || 0), 0);
}

// ── Objekte (building_objects) ──────────────────────────────────────────────

/** m-hub-frontend/src/app/enums/object-type.ts — closed 8-value enum. */
export enum ObjectType {
  'Abhängung' = 'Abhängung',
  'Tür' = 'Tür',
  Zarge = 'Zarge',
  Fenster = 'Fenster',
  'Heizkörper' = 'Heizkörper',
  Rohre = 'Rohre',
  Kabel = 'Kabel',
  Sonstige = 'Sonstige',
}

/**
 * Fixture catalog: recognizable items the user drops on the plan, each pre-mapped
 * to m-hub's (object_type, name). Anything not in the 8 enum types lands as
 * Sonstige + a name (that's how m-hub itself models WC / Waschbecken / …).
 * `icon` is a classic Material Icons ligature.
 */
export interface Fixture {
  key: string;
  label: string;
  objectType: ObjectType;
  name: string;
  icon: string;
}

export const FIXTURE_CATALOG: readonly Fixture[] = [
  { key: 'tuer',        label: 'Tür',         objectType: ObjectType['Tür'],       name: 'Tür',         icon: 'meeting_room' },
  { key: 'fenster',     label: 'Fenster',     objectType: ObjectType.Fenster,      name: 'Fenster',     icon: 'window' },
  { key: 'zarge',       label: 'Zarge',       objectType: ObjectType.Zarge,        name: 'Zarge',       icon: 'crop_square' },
  { key: 'heizkoerper', label: 'Heizkörper',  objectType: ObjectType['Heizkörper'], name: 'Heizkörper', icon: 'thermostat' },
  { key: 'rohre',       label: 'Rohre',       objectType: ObjectType.Rohre,        name: 'Rohre',       icon: 'plumbing' },
  { key: 'kabel',       label: 'Kabel',       objectType: ObjectType.Kabel,        name: 'Kabel',       icon: 'electrical_services' },
  { key: 'abhaengung',  label: 'Abhängung',   objectType: ObjectType['Abhängung'], name: 'Abhängung',   icon: 'vertical_align_bottom' },
  { key: 'wc',          label: 'WC',          objectType: ObjectType.Sonstige,     name: 'WC',          icon: 'wc' },
  { key: 'waschbecken', label: 'Waschbecken', objectType: ObjectType.Sonstige,     name: 'Waschbecken', icon: 'wash' },
  { key: 'badewanne',   label: 'Badewanne',   objectType: ObjectType.Sonstige,     name: 'Badewanne',   icon: 'bathtub' },
  { key: 'dusche',      label: 'Dusche',      objectType: ObjectType.Sonstige,     name: 'Dusche',      icon: 'shower' },
  { key: 'herd',        label: 'Herd',        objectType: ObjectType.Sonstige,     name: 'Herd',        icon: 'local_fire_department' },
  { key: 'spuele',      label: 'Spüle',       objectType: ObjectType.Sonstige,     name: 'Spüle',       icon: 'countertops' },
  { key: 'kuehlschrank',label: 'Kühlschrank', objectType: ObjectType.Sonstige,     name: 'Kühlschrank', icon: 'kitchen' },
  { key: 'sonstige',    label: 'Sonstige',    objectType: ObjectType.Sonstige,     name: '',            icon: 'category' },
];

export function fixtureByKey(key: string): Fixture | undefined {
  return FIXTURE_CATALOG.find((f) => f.key === key);
}

/** Category color for a placemark pin. */
export function objectTypeColor(t: ObjectType): string {
  switch (t) {
    case ObjectType['Tür']:
    case ObjectType.Fenster:
    case ObjectType.Zarge:
      return '#1e88e5'; // openings — blue
    case ObjectType['Heizkörper']:
    case ObjectType.Rohre:
    case ObjectType.Kabel:
    case ObjectType['Abhängung']:
      return '#e66c1a'; // building services — orange
    default:
      return '#00897b'; // Sonstige (fixtures) — teal
  }
}

/** Mirror of m-hub-frontend CreateObjektPayload. */
export interface CreateObjektPayload {
  building_id: string;
  user_building_id: string;
  owner_id: string;
  category: 'Objekt';
  name: string;
  description?: string;
  is_public: boolean;
  is_hazardous: boolean;
  object_type: ObjectType;
  count: number;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  location: string;
}

/**
 * One hand-off batch to m-hub's POST /api/import/plan. Each part/object already
 * carries its `location` (storey). The backend replaces everything with the same
 * `source_extract_id` for that `user_building_id` (delete-and-reallocate).
 *
 * One packet == one (document, storey) extract. A plan spanning several storeys
 * is submitted as several packets (one per storey), each with its own
 * `source_extract_id` so a storey can be re-imported independently.
 */
export interface ImportPacket {
  building_id: string;
  user_building_id: string;
  source_extract_id: string;
  parts: CreateBauteilPayload[];
  objects: CreateObjektPayload[];
}

/**
 * Deterministic extract id for a (document, storey) pair: same inputs always
 * yield the same UUID, so re-importing the same plan+storey replaces its rows
 * instead of duplicating them. SHA-256 of "documentId|storey", formatted as a
 * v4-shaped UUID (passes m-hub's UUID validation).
 */
export async function extractIdFor(documentId: string, storey: string): Promise<string> {
  const bytes = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${documentId}|${storey}`)),
  ).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const h = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** One aggregated object (identical placemarks folded into a count). */
export interface ObjektAggregate {
  objectType: ObjectType;
  name: string;
  count: number;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  is_public: boolean;
  is_hazardous: boolean;
}

export function objektToPayload(o: ObjektAggregate, ctx: MhubContext): CreateObjektPayload {
  return {
    ...ctx,
    category: 'Objekt',
    name: o.name || o.objectType,
    is_public: o.is_public,
    is_hazardous: o.is_hazardous,
    object_type: o.objectType,
    count: o.count,
    length: o.length ?? null,
    width: o.width ?? null,
    height: o.height ?? null,
  };
}
