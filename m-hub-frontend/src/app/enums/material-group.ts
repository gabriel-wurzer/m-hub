import { MaterialType } from './material-type.enum';

/**
 * Enum for supported material groups (from excel sheet Materialienliste_v2_pa.xlsx and the Oekobaudat categories)
 */
export enum MaterialGroup {
  Mineralik = 'Mineralik',
  Metalle = 'Metalle',
  Biomasse = 'Biomasse',
  Kunststoffe = 'Kunststoffe'
}

export enum OekobaudatCategory {
  MineralischeBaustoffe = 'Mineralische Baustoffe',
  Daemmstoffe = 'D\u00e4mmstoffe',
  Holz = 'Holz',
  Metalle = 'Metalle',
  Beschichtungen = 'Beschichtungen',
  Kunststoffe = 'Kunststoffe',
  FensterUndVorhangfassadenKomponenten = 'Komponenten von Fenstern und Vorhangfassaden',
  Gebaeudetechnik = 'Geb\u00e4udetechnik',
  Sonstige = 'Sonstige',
  Komposite = 'Komposite',
  EndOfLife = 'End of Life'
}

export const MATERIAL_GROUP_TO_TYPES: Readonly<Record<MaterialGroup, readonly MaterialType[]>> = Object.freeze({
  [MaterialGroup.Mineralik]: Object.freeze([
    MaterialType.mat_38, // Ziegel
    MaterialType.mat_3,  // Beton
    MaterialType.mat_2,  // Asphalt
    MaterialType.mat_5,  // Blaehbeton
    MaterialType.mat_8,  // Eternit
    MaterialType.mat_9,  // Estrich
    MaterialType.mat_10, // Fliesen
    MaterialType.mat_16, // Keramik
    MaterialType.mat_11, // Fliesenkleber
    MaterialType.mat_12, // Glas
    MaterialType.mat_21, // Mineralfaser
    MaterialType.mat_23, // Moertel
    MaterialType.mat_26, // Putz
    MaterialType.mat_30, // Schuettung
    MaterialType.mat_37, // Ytong
    MaterialType.mat_28, // Rigips
    MaterialType.mat_32  // Steinzeug
  ]),
  [MaterialGroup.Metalle]: Object.freeze([
    MaterialType.mat_1,  // Aluminium
    MaterialType.mat_6,  // Blei
    MaterialType.mat_17, // Kupfer
    MaterialType.mat_31, // Stahl
    MaterialType.mat_20  // Messing
  ]),
  [MaterialGroup.Biomasse]: Object.freeze([
    MaterialType.mat_14, // Holz
    MaterialType.mat_13, // Heraklith
    MaterialType.mat_18, // Laminat
    MaterialType.mat_25, // Papier
    MaterialType.mat_33, // Stroh
    MaterialType.mat_19  // Linol
  ]),
  [MaterialGroup.Kunststoffe]: Object.freeze([
    MaterialType.mat_7,  // Diverse Kunststoffe
    MaterialType.mat_27, // PVC
    MaterialType.mat_34  // Styropor
  ])
});

export const MATERIAL_TYPE_TO_GROUP: Readonly<Partial<Record<MaterialType, MaterialGroup>>> = Object.freeze(
  Object.values(MaterialGroup).reduce<Partial<Record<MaterialType, MaterialGroup>>>((acc, group) => {
    for (const material of MATERIAL_GROUP_TO_TYPES[group]) {
      acc[material] = group;
    }
    return acc;
  }, {})
);

export function getMaterialTypesForGroup(group: MaterialGroup): readonly MaterialType[] {
  return MATERIAL_GROUP_TO_TYPES[group] ?? [];
}

export function getMaterialGroupForType(material: MaterialType | null | undefined): MaterialGroup | null {
  if (!material) {
    return null;
  }

  return MATERIAL_TYPE_TO_GROUP[material] ?? null;
}
