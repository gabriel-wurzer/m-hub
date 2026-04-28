import { MaterialGroup } from '../enums/material-group';
import { ObjectType } from '../enums/object-type';
import { MarketCategory, MarketCategoryKind } from '../models/market.models';

type MarketPreviewMotif =
  | 'mineralik'
  | 'metals'
  | 'biomass'
  | 'plastics'
  | 'ceiling'
  | 'door'
  | 'frame'
  | 'window'
  | 'radiator'
  | 'pipes'
  | 'cables'
  | 'misc';

interface MarketPreviewTheme {
  background: string;
  surface: string;
  accent: string;
  accentSoft: string;
  ink: string;
}

interface CategorySeed {
  description: string;
  motif: MarketPreviewMotif;
  theme: MarketPreviewTheme;
}

const materialSeeds: Record<MaterialGroup, CategorySeed> = {
  [MaterialGroup.Mineralik]: {
    description: 'Ziegel, Beton, Estrich, Fliesen, Glas und weitere mineralische Baustoffe',
    motif: 'mineralik',
    theme: { background: '#F7F4EF', surface: '#E6DDD0', accent: '#B9A88D', accentSoft: '#D8CCBC', ink: '#5F5447' }
  },
  [MaterialGroup.Metalle]: {
    description: 'Aluminium, Blei, Kupfer, Stahl und Messing',
    motif: 'metals',
    theme: { background: '#F2F6F8', surface: '#D6E0E6', accent: '#6C8795', accentSoft: '#A7BBC6', ink: '#324752' }
  },
  [MaterialGroup.Biomasse]: {
    description: 'Holz, Heraklith, Laminat, Papier, Stroh und Linol',
    motif: 'biomass',
    theme: { background: '#F7F1E7', surface: '#E7D2AF', accent: '#B7864F', accentSoft: '#D8B783', ink: '#614225' }
  },
  [MaterialGroup.Kunststoffe]: {
    description: 'PVC, Styropor und diverse Kunststoffe',
    motif: 'plastics',
    theme: { background: '#F5F7FB', surface: '#DFE5F3', accent: '#8498CF', accentSoft: '#B9C6E7', ink: '#45567F' }
  }
};

const objectSeeds: Record<ObjectType, CategorySeed> = {
  [ObjectType['Abh\u00e4ngung']]: {
    description: 'Abhängesysteme, Rasterdecken und Unterkonstruktionen',
    motif: 'ceiling',
    theme: { background: '#F6F8FA', surface: '#DBE3EA', accent: '#8EA3B4', accentSoft: '#B8C6D1', ink: '#435A69' }
  },
  [ObjectType['T\u00fcr']]: {
    description: 'Innen-, Außen- und Spezialtüren',
    motif: 'door',
    theme: { background: '#FAF4EB', surface: '#E9D8C2', accent: '#B58753', accentSoft: '#D8B88F', ink: '#6B4720' }
  },
  [ObjectType.Zarge]: {
    description: 'Stahl- und Holzzargen',
    motif: 'frame',
    theme: { background: '#F5F6F7', surface: '#D8DDE3', accent: '#8B97A2', accentSoft: '#BBC4CD', ink: '#46515A' }
  },
  [ObjectType.Fenster]: {
    description: 'Fensterelemente',
    motif: 'window',
    theme: { background: '#EFF7FA', surface: '#D2E7EE', accent: '#74AFC4', accentSoft: '#A8D0DB', ink: '#2D6172' }
  },
  [ObjectType['Heizk\u00f6rper']]: {
    description: 'Heizkörper',
    motif: 'radiator',
    theme: { background: '#FBF7F2', surface: '#E7DCCF', accent: '#C49C72', accentSoft: '#DEC4A7', ink: '#77522D' }
  },
  [ObjectType.Rohre]: {
    description: 'Installationsrohre aus Kupfer, PVC und Mischsystemen',
    motif: 'pipes',
    theme: { background: '#F6F6F7', surface: '#DBDCDF', accent: '#7F838B', accentSoft: '#B0B4BB', ink: '#404349' }
  },
  [ObjectType.Kabel]: {
    description: 'Energie-, Steuer- und Datenkabel',
    motif: 'cables',
    theme: { background: '#F6F8FB', surface: '#DCE3F2', accent: '#7D92C9', accentSoft: '#B0C0E5', ink: '#364978' }
  },
  [ObjectType.Sonstige]: {
    description: 'Sonderteile, Module und sonstige Objekte',
    motif: 'misc',
    theme: { background: '#F7F6F3', surface: '#E4DFD5', accent: '#9A8F74', accentSoft: '#C9BEA7', ink: '#5A523E' }
  }
};

export const MATERIAL_GROUP_CATEGORIES: MarketCategory[] = (Object.values(MaterialGroup) as MaterialGroup[])
  .map(group => createCategory('material', group, materialSeeds[group]));

export const OBJECT_TYPE_CATEGORIES: MarketCategory[] = (Object.values(ObjectType) as ObjectType[])
  .map(type => createCategory('object', type, objectSeeds[type]));

function createCategory(kind: MarketCategoryKind, title: string, seed: CategorySeed): MarketCategory {
  return {
    id: `${kind}-${toSlug(title)}`,
    title,
    kind,
    label: kind === 'material' ? 'Materialgruppe' : 'Objektkategorie',
    description: seed.description,
    imageSrc: createPreviewImage(seed.theme, seed.motif),
    imageAlt: `Vorschau fuer ${title}`,
    listings: []
  };
}

function createPreviewImage(theme: MarketPreviewTheme, motif: MarketPreviewMotif): string {
  const svg = `
    <svg width="640" height="360" viewBox="0 0 640 360" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="640" height="360" rx="12" fill="${theme.background}"/>
      <rect x="24" y="24" width="592" height="312" rx="18" fill="${theme.surface}"/>
      ${renderPreviewArt(motif, theme)}
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function renderPreviewArt(motif: MarketPreviewMotif, theme: MarketPreviewTheme): string {
  switch (motif) {
    case 'mineralik':
      return `
        <rect x="104" y="92" width="142" height="58" rx="12" fill="${theme.accent}"/>
        <rect x="266" y="84" width="176" height="66" rx="12" fill="${theme.accentSoft}"/>
        <rect x="162" y="166" width="124" height="54" rx="12" fill="${theme.accentSoft}"/>
        <rect x="304" y="166" width="150" height="54" rx="12" fill="${theme.accent}"/>
        <circle cx="144" cy="252" r="18" fill="${theme.accent}"/>
        <circle cx="196" cy="252" r="12" fill="${theme.accentSoft}"/>
        <circle cx="244" cy="252" r="16" fill="${theme.accent}"/>
        <circle cx="292" cy="252" r="10" fill="${theme.accentSoft}"/>
        <circle cx="338" cy="252" r="14" fill="${theme.accent}"/>
        <circle cx="384" cy="252" r="11" fill="${theme.accentSoft}"/>
        <circle cx="430" cy="252" r="16" fill="${theme.accent}"/>
        <circle cx="480" cy="252" r="12" fill="${theme.accentSoft}"/>
        <rect x="124" y="262" width="374" height="10" rx="5" fill="${theme.ink}" fill-opacity="0.1"/>
        <circle cx="154" cy="114" r="4" fill="${theme.ink}" fill-opacity="0.12"/>
        <circle cx="328" cy="106" r="5" fill="${theme.ink}" fill-opacity="0.12"/>
        <circle cx="350" cy="198" r="4" fill="${theme.ink}" fill-opacity="0.12"/>
      `;
    case 'metals':
      return `
        <rect x="116" y="86" width="150" height="70" rx="12" fill="${theme.accentSoft}"/>
        <rect x="132" y="102" width="118" height="38" rx="8" fill="${theme.surface}"/>
        <circle cx="148" cy="120" r="5" fill="${theme.accent}"/>
        <circle cx="234" cy="120" r="5" fill="${theme.accent}"/>
        <rect x="116" y="182" width="184" height="26" rx="10" fill="${theme.accent}"/>
        <rect x="352" y="76" width="34" height="182" rx="12" fill="${theme.accent}"/>
        <rect x="320" y="94" width="98" height="24" rx="12" fill="${theme.accentSoft}"/>
        <rect x="320" y="216" width="98" height="24" rx="12" fill="${theme.accentSoft}"/>
        <rect x="434" y="106" width="88" height="118" rx="14" fill="${theme.accentSoft}"/>
        <rect x="452" y="126" width="52" height="78" rx="10" fill="${theme.surface}"/>
        <circle cx="448" cy="120" r="5" fill="${theme.accent}"/>
        <circle cx="508" cy="120" r="5" fill="${theme.accent}"/>
        <circle cx="448" cy="210" r="5" fill="${theme.accent}"/>
        <circle cx="508" cy="210" r="5" fill="${theme.accent}"/>
      `;
    case 'biomass':
      return `
        <rect x="118" y="76" width="70" height="166" rx="16" fill="${theme.accent}"/>
        <rect x="204" y="92" width="62" height="150" rx="16" fill="${theme.accentSoft}"/>
        <rect x="282" y="66" width="74" height="176" rx="16" fill="${theme.accent}"/>
        <rect x="372" y="88" width="66" height="154" rx="16" fill="${theme.accentSoft}"/>
        <rect x="454" y="72" width="68" height="170" rx="16" fill="${theme.accent}"/>
        <path d="M140 108L166 224" stroke="${theme.ink}" stroke-width="4" stroke-linecap="round" stroke-opacity="0.16"/>
        <path d="M304 98L330 224" stroke="${theme.ink}" stroke-width="4" stroke-linecap="round" stroke-opacity="0.16"/>
        <path d="M478 104L500 224" stroke="${theme.ink}" stroke-width="4" stroke-linecap="round" stroke-opacity="0.16"/>
      `;
    case 'plastics':
      return `
        <rect x="118" y="90" width="168" height="124" rx="22" fill="${theme.accent}"/>
        <rect x="262" y="118" width="168" height="106" rx="22" fill="${theme.accentSoft}"/>
        <rect x="406" y="88" width="108" height="124" rx="22" fill="${theme.accent}"/>
        <circle cx="170" cy="132" r="12" fill="white" fill-opacity="0.34"/>
        <circle cx="216" cy="168" r="8" fill="white" fill-opacity="0.3"/>
        <circle cx="316" cy="156" r="12" fill="white" fill-opacity="0.28"/>
        <circle cx="456" cy="140" r="10" fill="white" fill-opacity="0.28"/>
      `;
    case 'ceiling':
      return `
        <path d="M166 84V140" stroke="${theme.accent}" stroke-width="8" stroke-linecap="round"/>
        <path d="M322 84V140" stroke="${theme.accent}" stroke-width="8" stroke-linecap="round"/>
        <path d="M478 84V140" stroke="${theme.accent}" stroke-width="8" stroke-linecap="round"/>
        <rect x="104" y="140" width="124" height="72" rx="10" fill="${theme.accentSoft}"/>
        <rect x="258" y="140" width="124" height="72" rx="10" fill="${theme.accent}"/>
        <rect x="412" y="140" width="124" height="72" rx="10" fill="${theme.accentSoft}"/>
      `;
    case 'door':
      return `
        <rect x="220" y="66" width="176" height="182" rx="18" fill="${theme.accent}"/>
        <rect x="246" y="92" width="124" height="130" rx="12" fill="${theme.accentSoft}"/>
        <circle cx="354" cy="156" r="8" fill="${theme.ink}"/>
      `;
    case 'frame':
      return `
        <rect x="188" y="76" width="244" height="164" rx="18" fill="${theme.accent}"/>
        <rect x="220" y="106" width="180" height="104" rx="12" fill="${theme.surface}"/>
        <rect x="208" y="94" width="204" height="128" rx="14" stroke="${theme.accentSoft}" stroke-width="12"/>
      `;
    case 'window':
      return `
        <rect x="184" y="72" width="272" height="176" rx="18" fill="${theme.accent}"/>
        <rect x="210" y="96" width="98" height="126" rx="10" fill="${theme.accentSoft}"/>
        <rect x="332" y="96" width="98" height="126" rx="10" fill="${theme.accentSoft}"/>
        <path d="M320 96V222" stroke="${theme.surface}" stroke-width="12"/>
        <path d="M210 158H430" stroke="${theme.surface}" stroke-width="12"/>
      `;
    case 'radiator':
      return `
        <rect x="176" y="104" width="32" height="108" rx="12" fill="${theme.accent}"/>
        <rect x="224" y="96" width="32" height="116" rx="12" fill="${theme.accentSoft}"/>
        <rect x="272" y="104" width="32" height="108" rx="12" fill="${theme.accent}"/>
        <rect x="320" y="96" width="32" height="116" rx="12" fill="${theme.accentSoft}"/>
        <rect x="368" y="104" width="32" height="108" rx="12" fill="${theme.accent}"/>
        <rect x="416" y="96" width="32" height="116" rx="12" fill="${theme.accentSoft}"/>
        <rect x="170" y="212" width="286" height="16" rx="8" fill="${theme.ink}" fill-opacity="0.18"/>
      `;
    case 'pipes':
      return `
        <path d="M162 210V112H274V162H384V92H488" stroke="${theme.accent}" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="162" cy="210" r="20" fill="${theme.accentSoft}"/>
        <circle cx="488" cy="92" r="20" fill="${theme.accentSoft}"/>
      `;
    case 'cables':
      return `
        <path d="M116 210C168 112 232 112 282 210C332 308 396 308 452 170" stroke="${theme.accent}" stroke-width="16" stroke-linecap="round"/>
        <path d="M156 226C208 128 272 128 322 226C372 324 430 310 504 188" stroke="${theme.accentSoft}" stroke-width="14" stroke-linecap="round"/>
        <circle cx="116" cy="210" r="10" fill="${theme.ink}"/>
        <circle cx="156" cy="226" r="10" fill="${theme.ink}"/>
      `;
    case 'misc':
      return `
        <rect x="128" y="116" width="120" height="96" rx="14" fill="${theme.accentSoft}"/>
        <rect x="264" y="86" width="140" height="126" rx="14" fill="${theme.accent}"/>
        <rect x="420" y="136" width="92" height="76" rx="14" fill="${theme.accentSoft}"/>
        <rect x="150" y="104" width="76" height="10" rx="5" fill="${theme.ink}" fill-opacity="0.18"/>
        <rect x="292" y="74" width="84" height="10" rx="5" fill="${theme.ink}" fill-opacity="0.18"/>
      `;
  }
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
