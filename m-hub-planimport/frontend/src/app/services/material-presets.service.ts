import { Injectable, computed, signal } from '@angular/core';

/** Built-in default layer thickness (mm) per material. */
export const DEFAULT_MATERIAL_THICKNESS_MM: Readonly<Record<string, number>> = Object.freeze({
  'Aluminium': 3,
  'Asphalt': 30,
  'Beton': 200,
  'Bitumen': 4,
  'Blähbeton': 200,
  'Blei': 2,
  'Diverse Kunststoffe': 5,
  'Eternit': 6,
  'Estrich': 60,
  'Fliesen': 10,
  'Fliesenkleber': 5,
  'Glas': 6,
  'Heraklith': 35,
  'Holz': 24,
  'Kautschuk': 4,
  'Keramik': 10,
  'Kupfer': 1,
  'Laminat': 8,
  'Linol': 3,
  'Messing': 2,
  'Mineralfaser': 20,
  'Mineralwolle': 120,
  'Mörtel': 12,
  'Naturstein': 30,
  'Papier': 1,
  'Putz': 15,
  'PVC': 2,
  'Rigips': 12,
  'Schlacke': 80,
  'Schüttung': 60,
  'Stahl': 5,
  'Steinzeug': 10,
  'Stroh': 400,
  'Styropor': 100,
  'Teppich': 8,
  'Terrazzo': 20,
  'Ytong': 250,
  'Ziegel': 300,
});

/** Fallback when a material has neither an override nor a built-in default. */
const FALLBACK_MM = 50;
const LS_KEY = 'mhub-planimport-material-presets';

@Injectable({ providedIn: 'root' })
export class MaterialPresetService {
  /** User overrides, persisted to localStorage; take precedence over built-ins. */
  private overrides = signal<Record<string, number>>(this.load());

  private load(): Record<string, number> {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private persist() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this.overrides()));
    } catch {
      // best-effort
    }
  }

  /** Effective default thickness (mm): override → built-in → fallback. */
  defaultFor(material: string): number {
    const o = this.overrides();
    if (material in o) return o[material];
    return DEFAULT_MATERIAL_THICKNESS_MM[material] ?? FALLBACK_MM;
  }

  builtinFor(material: string): number {
    return DEFAULT_MATERIAL_THICKNESS_MM[material] ?? FALLBACK_MM;
  }

  isOverridden(material: string): boolean {
    return material in this.overrides();
  }

  setOverride(material: string, mm: number) {
    this.overrides.update((o) => ({ ...o, [material]: Math.max(0, Math.round(mm)) }));
    this.persist();
  }

  resetOverride(material: string) {
    this.overrides.update((o) => {
      const n = { ...o };
      delete n[material];
      return n;
    });
    this.persist();
  }

  resetAll() {
    this.overrides.set({});
    this.persist();
  }

  /** All materials (alphabetical) with effective value + override flag. */
  readonly rows = computed(() => {
    const o = this.overrides();
    return Object.keys(DEFAULT_MATERIAL_THICKNESS_MM).sort((a, b) => a.localeCompare(b, 'de')).map((m) => ({
      material: m,
      value: m in o ? o[m] : DEFAULT_MATERIAL_THICKNESS_MM[m],
      overridden: m in o,
    }));
  });
}
