import { MaterialGroup } from '../enums/material-group.enum';
import { ObjectType } from '../enums/object-type';
import { MarketCategory, MarketCategoryKind, MarketListing, MarketListingDimension } from '../models/market.models';

type MarketPreviewMotif =
  | 'concrete'
  | 'brick'
  | 'planks'
  | 'steel'
  | 'glass'
  | 'wool'
  | 'foam'
  | 'gypsum'
  | 'aggregate'
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

interface ListingSeed {
  title: string;
  price: string;
  quantity: string;
  condition: string;
  location: string;
  dimensions: MarketListingDimension[];
  motif?: MarketPreviewMotif;
}

interface CategorySeed {
  description: string;
  motif: MarketPreviewMotif;
  theme: MarketPreviewTheme;
  listings: ListingSeed[];
}

const materialSeeds: Record<MaterialGroup, CategorySeed> = {
  [MaterialGroup.mg_1]: {
    description: 'Angebote für tragende und ausgleichende Bauteile aus Beton oder Estrich.',
    motif: 'concrete',
    theme: { background: '#F7F5F1', surface: '#E5E0D6', accent: '#B3AEA5', accentSoft: '#D5D0C6', ink: '#5A5956' },
    listings: [
      {
        title: 'Betonplatten 120 x 60',
        price: '18 EUR / Stk.',
        quantity: '24 Stk.',
        condition: 'gut',
        location: 'Leopoldauer Strasse 87, 1210 Wien',
        dimensions: [{ label: 'Länge', value: '120 cm' }, { label: 'Breite', value: '60 cm' }, { label: 'Höhe', value: '8 cm' }]
      },
      {
        title: 'Trockenestrich-Elemente',
        price: '11 EUR / Stk.',
        quantity: '36 Stk.',
        condition: 'sehr gut',
        location: 'An den alten Schanzen 14, 1220 Wien',
        dimensions: [{ label: 'Länge', value: '150 cm' }, { label: 'Breite', value: '50 cm' }, { label: 'Höhe', value: '4 cm' }]
      }
    ]
  },
  [MaterialGroup.mg_2]: {
    description: 'Wiederverwendbare Ziegel für Ausbau, Sanierung und Gartenprojekte.',
    motif: 'brick',
    theme: { background: '#FBF1EB', surface: '#F2D2BF', accent: '#C47152', accentSoft: '#E7B9A0', ink: '#7B3D24' },
    listings: [
      {
        title: 'Recycling-Vollziegel',
        price: '1.40 EUR / Stk.',
        quantity: '420 Stk.',
        condition: 'gut',
        location: 'Gudrunstrasse 102, 1100 Wien',
        dimensions: [{ label: 'Länge', value: '25 cm' }, { label: 'Breite', value: '12 cm' }, { label: 'Höhe', value: '6.5 cm' }]
      },
      {
        title: 'Ziegelpaket',
        price: '280 EUR / ges.',
        quantity: '1 Palette',
        condition: 'gebraucht',
        location: 'Industriestrasse 9, 2345 Brunn am Gebirge',
        dimensions: [{ label: 'Länge', value: '24 cm' }, { label: 'Breite', value: '11.5 cm' }, { label: 'Höhe', value: '7.1 cm' }]
      }
    ]
  },
  [MaterialGroup.mg_3]: {
    description: 'Holzbauteile fuer Innenausbau, Tragwerk und kreative Upcycling-Projekte.',
    motif: 'planks',
    theme: { background: '#F8F2E7', surface: '#E7D3B0', accent: '#B9824A', accentSoft: '#D7B07C', ink: '#654322' },
    listings: [
      {
        title: 'Eichenholzdielen',
        price: '45 EUR / Stk.',
        quantity: '6 Stk.',
        condition: 'gut',
        location: 'Muehlgasse 12, 1040 Wien',
        dimensions: [{ label: 'Länge', value: '210 cm' }, { label: 'Breite', value: '45 cm' }, { label: 'Höhe', value: '5 cm' }]
      },
      {
        title: 'Holzbalken (Fichte)',
        price: '337 EUR / ges.',
        quantity: '4 Stk.',
        condition: 'neuwertig',
        location: 'Reinlgasse 23, 1120 Wien',
        dimensions: [{ label: 'Länge', value: '200 cm' }, { label: 'Breite', value: '50 cm' }, { label: 'Höhe', value: '20 cm' }]
      }
    ]
  },
  [MaterialGroup.mg_4]: {
    description: 'Stahlbauteile fuer Hallenbau, Unterkonstruktionen und Sonderanfertigungen.',
    motif: 'steel',
    theme: { background: '#F3F6F8', surface: '#D3DEE5', accent: '#6A8797', accentSoft: '#A7BCC8', ink: '#2F4956' },
    listings: [
      {
        title: 'HEA-Traeger 180',
        price: '165 EUR / Stk.',
        quantity: '8 Stk.',
        condition: 'gut',
        location: 'Laxenburger Strasse 210, 1230 Wien',
        dimensions: [{ label: 'Länge', value: '360 cm' }, { label: 'Breite', value: '18 cm' }, { label: 'Höhe', value: '17 cm' }]
      },
      {
        title: 'Stahlbleche verzinkt',
        price: '52 EUR / Platte',
        quantity: '15 Platten',
        condition: 'sehr gut',
        location: 'Triester Strasse 14, 2351 Wiener Neudorf',
        dimensions: [{ label: 'Länge', value: '250 cm' }, { label: 'Breite', value: '125 cm' }, { label: 'Staerke', value: '4 mm' }]
      }
    ]
  },
  [MaterialGroup.mg_5]: {
    description: 'Verglasungen fuer Innenraeume, Fassadenelemente und Sonderlösungen.',
    motif: 'glass',
    theme: { background: '#EEF8FA', surface: '#D1EBF0', accent: '#78B9C9', accentSoft: '#A4D5DF', ink: '#2B6674' },
    listings: [
      {
        title: 'Isolierglasscheiben',
        price: '96 EUR / Stk.',
        quantity: '10 Stk.',
        condition: 'gut',
        location: 'Ketzergasse 77, 1230 Wien',
        dimensions: [{ label: 'Länge', value: '140 cm' }, { label: 'Breite', value: '120 cm' }, { label: 'Staerke', value: '24 mm' }]
      },
      {
        title: 'Glastrennwand mit Beschlägen',
        price: '380 EUR / ges.',
        quantity: '1 Set',
        condition: 'sehr gut',
        location: 'Mariahilfer Guertel 5, 1150 Wien',
        dimensions: [{ label: 'Länge', value: '280 cm' }, { label: 'Höhe', value: '240 cm' }, { label: 'Staerke', value: '10 mm' }]
      }
    ]
  },
  [MaterialGroup.mg_6]: {
    description: 'Mineralwolldämmung für technische Räume, Wandsysteme und Decken.',
    motif: 'wool',
    theme: { background: '#F8F7EF', surface: '#E6E0BE', accent: '#B3A35F', accentSoft: '#D6CC9B', ink: '#6A6032' },
    listings: [
      {
        title: 'Mineralwolle Akustikmatten',
        price: '6 EUR / m2',
        quantity: '48 m2',
        condition: 'neu',
        location: 'Siemensstrasse 120, 1210 Wien',
        dimensions: [{ label: 'Länge', value: '125 cm' }, { label: 'Breite', value: '62.5 cm' }, { label: 'Staerke', value: '8 cm' }]
      }
    ]
  },
  [MaterialGroup.mg_7]: {
    description: 'Leichte Dämmsysteme fuer thermische Sanierung und Neubau.',
    motif: 'foam',
    theme: { background: '#F7F8FB', surface: '#DDE4F4', accent: '#8FA7D7', accentSoft: '#BBC8E8', ink: '#4F628D' },
    listings: [
      {
        title: 'EPS-Daemmplatten WDV',
        price: '4.50 EUR / m2',
        quantity: '74 m2',
        condition: 'neu',
        location: 'Liesinger Flur Gasse 18, 1230 Wien',
        dimensions: [{ label: 'Länge', value: '100 cm' }, { label: 'Breite', value: '50 cm' }, { label: 'Staerke', value: '14 cm' }]
      },
      {
        title: 'XPS-Sockelplatten',
        price: '7 EUR / m2',
        quantity: '32 m2',
        condition: 'neu',
        location: 'Wagramer Strasse 310, 1220 Wien',
        dimensions: [{ label: 'Länge', value: '125 cm' }, { label: 'Breite', value: '60 cm' }, { label: 'Staerke', value: '10 cm' }]
      }
    ]
  },
  [MaterialGroup.mg_8]: {
    description: 'Plattenwerkstoffe fuer Wände, Vorsatzschalen und Deckenbekleidungen.',
    motif: 'gypsum',
    theme: { background: '#FAF7F7', surface: '#E8D8DB', accent: '#C59AA4', accentSoft: '#DDBBC2', ink: '#7D4A56' },
    listings: [
      {
        title: 'Gipskartonplatten Standard',
        price: '5.80 EUR / Platte',
        quantity: '40 Platten',
        condition: 'neu',
        location: 'Hernalser Hauptstrasse 195, 1170 Wien',
        dimensions: [{ label: 'Länge', value: '200 cm' }, { label: 'Breite', value: '125 cm' }, { label: 'Staerke', value: '12.5 mm' }]
      },
      {
        title: 'Gipsfaserplatten',
        price: '11 EUR / Platte',
        quantity: '22 Platten',
        condition: 'sehr gut',
        location: 'Perfektastrasse 62, 1230 Wien',
        dimensions: [{ label: 'Länge', value: '260 cm' }, { label: 'Breite', value: '120 cm' }, { label: 'Staerke', value: '15 mm' }]
      }
    ]
  },
  [MaterialGroup.mg_9]: {
    description: 'Lose oder palettierte mineralische Baustoffe für Garten und Landschaft.',
    motif: 'aggregate',
    theme: { background: '#F8F5EF', surface: '#E7DECC', accent: '#B19463', accentSoft: '#D2BF9C', ink: '#6D5732' },
    listings: [
      {
        title: 'Pflastersteine Granit',
        price: '28 EUR / m2',
        quantity: '65 m2',
        condition: 'gut',
        location: 'Breitenleer Strasse 250, 1220 Wien',
        dimensions: [{ label: 'Länge', value: '10 cm' }, { label: 'Breite', value: '10 cm' }, { label: 'Höhe', value: '8 cm' }]
      },
      {
        title: 'Drainagekies 16/32',
        price: '95 EUR / Big Bag',
        quantity: '5 Bags',
        condition: 'neu',
        location: 'Schwechatfeld 6, 2320 Schwechat',
        dimensions: [{ label: 'Volumen', value: '1 m3' }, { label: 'Koernung', value: '16/32' }, { label: 'Gewicht', value: '1.5 t' }]
      }
    ]
  }
};

const objectSeeds: Record<ObjectType, CategorySeed> = {
  [ObjectType.Abhängung]: {
    description: 'Komponenten für abgehängte Decken und technische Zwischendecken.',
    motif: 'ceiling',
    theme: { background: '#F6F8FA', surface: '#DBE3EA', accent: '#8EA3B4', accentSoft: '#B8C6D1', ink: '#435A69' },
    listings: [
      {
        title: 'Rasterdecken-Set 60 x 60',
        price: '14 EUR / m2',
        quantity: '52 m2',
        condition: 'gut',
        location: 'Donau-City-Strasse 3, 1220 Wien',
        dimensions: [{ label: 'Raster', value: '60 x 60 cm' }, { label: 'Abhaengung', value: '35 cm' }, { label: 'Profile', value: 'T24' }]
      },
      {
        title: 'Metall-Unterkonstruktion Decke',
        price: '220 EUR / Set',
        quantity: '1 Set',
        condition: 'sehr gut',
        location: 'Arbeiterstrandbadstrasse 128, 1220 Wien',
        dimensions: [{ label: 'Länge', value: '480 cm' }, { label: 'Breite', value: '300 cm' }, { label: 'SystemHöhe', value: '18 cm' }]
      }
    ]
  },
  [ObjectType.Tür]: {
    description: 'Türelemente für Wohnbau, Gewerbe und Brandschutzanwendungen.',
    motif: 'door',
    theme: { background: '#FAF4EB', surface: '#E9D8C2', accent: '#B58753', accentSoft: '#D8B88F', ink: '#6B4720' },
    listings: [
      {
        title: 'Vollholztuer Eiche',
        price: '190 EUR / Stk.',
        quantity: '3 Stk.',
        condition: 'sehr gut',
        location: 'Puchsbaumgasse 8, 1100 Wien',
        dimensions: [{ label: 'Höhe', value: '205 cm' }, { label: 'Breite', value: '90 cm' }, { label: 'Staerke', value: '4 cm' }]
      },
      {
        title: 'Brandschutztuer EI30',
        price: '420 EUR / Stk.',
        quantity: '2 Stk.',
        condition: 'gut',
        location: 'Franzosengraben 12, 1030 Wien',
        dimensions: [{ label: 'Höhe', value: '210 cm' }, { label: 'Breite', value: '100 cm' }, { label: 'Staerke', value: '6 cm' }]
      }
    ]
  },
  [ObjectType.Zarge]: {
    description: 'Zargen für Sanierung, Austausch und Nachrüstung bestehender Türen.',
    motif: 'frame',
    theme: { background: '#F5F6F7', surface: '#D8DDE3', accent: '#8B97A2', accentSoft: '#BBC4CD', ink: '#46515A' },
    listings: [
      {
        title: 'Stahlzarge weiss lackiert',
        price: '95 EUR / Stk.',
        quantity: '5 Stk.',
        condition: 'sehr gut',
        location: 'Wiedner Guertel 18, 1040 Wien',
        dimensions: [{ label: 'Höhe', value: '205 cm' }, { label: 'Breite', value: '88 cm' }, { label: 'Wandstaerke', value: '12 cm' }]
      },
      {
        title: 'Holzzarge Buche',
        price: '78 EUR / Stk.',
        quantity: '4 Stk.',
        condition: 'gut',
        location: 'Antonigasse 71, 1180 Wien',
        dimensions: [{ label: 'Höhe', value: '200 cm' }, { label: 'Breite', value: '80 cm' }, { label: 'Wandstaerke', value: '10 cm' }]
      }
    ]
  },
  [ObjectType.Fenster]: {
    description: 'Komplette Fenster mit Rahmen, Beschlaegen und teilweise Verglasung.',
    motif: 'window',
    theme: { background: '#EFF7FA', surface: '#D2E7EE', accent: '#74AFC4', accentSoft: '#A8D0DB', ink: '#2D6172' },
    listings: [
      {
        title: 'Kunststofffenster 2-fluegelig',
        price: '240 EUR / Stk.',
        quantity: '6 Stk.',
        condition: 'sehr gut',
        location: 'Erdberger Laende 34, 1030 Wien',
        dimensions: [{ label: 'Höhe', value: '140 cm' }, { label: 'Breite', value: '160 cm' }, { label: 'Uw', value: '1.1 W/m2K' }]
      },
      {
        title: 'Dachfenster mit Eindeckrahmen',
        price: '315 EUR / Stk.',
        quantity: '2 Stk.',
        condition: 'gut',
        location: 'Schanzstrasse 31, 1140 Wien',
        dimensions: [{ label: 'Höhe', value: '118 cm' }, { label: 'Breite', value: '78 cm' }, { label: 'Einbauart', value: 'Schraeg' }]
      }
    ]
  },
  [ObjectType.Heizkörper]: {
    description: 'Funktionstüchtige Heizkörper mit verschiedenen Leistungen und Anschlussarten.',
    motif: 'radiator',
    theme: { background: '#FBF7F2', surface: '#E7DCCF', accent: '#C49C72', accentSoft: '#DEC4A7', ink: '#77522D' },
    listings: [
      {
        title: 'Flachheizkörper Typ 22',
        price: '85 EUR / Stk.',
        quantity: '7 Stk.',
        condition: 'gut',
        location: 'Rudolfsplatz 9, 1010 Wien',
        dimensions: [{ label: 'Höhe', value: '60 cm' }, { label: 'Breite', value: '120 cm' }, { label: 'Tiefe', value: '10 cm' }]
      },
      {
        title: 'Design-Heizkoerper vertikal',
        price: '180 EUR / Stk.',
        quantity: '2 Stk.',
        condition: 'sehr gut',
        location: 'Mittersteig 25, 1050 Wien',
        dimensions: [{ label: 'Höhe', value: '180 cm' }, { label: 'Breite', value: '45 cm' }, { label: 'Tiefe', value: '8 cm' }]
      }
    ]
  },
  [ObjectType.Rohre]: {
    description: 'Rohre fuer Sanitaer-, Heizungs- und Entwaesserungsanwendungen.',
    motif: 'pipes',
    theme: { background: '#F6F6F7', surface: '#DBDCDF', accent: '#7F838B', accentSoft: '#B0B4BB', ink: '#404349' },
    listings: [
      {
        title: 'Kupferrohre',
        price: '95 EUR / Ring',
        quantity: '4 Ringe',
        condition: 'neu',
        location: 'Bessemerstrasse 6, 1210 Wien',
        dimensions: [{ label: 'Länge', value: '25 m' }, { label: 'Durchmesser', value: '18 mm' }, { label: 'Wandstaerke', value: '1 mm' }]
      },
      {
        title: 'KG-Rohrpaket DN160',
        price: '140 EUR / ges.',
        quantity: '1 Paket',
        condition: 'gut',
        location: 'Haidfeldstrasse 17, 4060 Leonding',
        dimensions: [{ label: 'Länge', value: '200 cm' }, { label: 'Durchmesser', value: '160 mm' }, { label: 'Muffen', value: '6 Stk.' }]
      }
    ]
  },
  [ObjectType.Kabel]: {
    description: 'Restposten und Gebinde für Elektroinstallationen und Netzwerktechnik.',
    motif: 'cables',
    theme: { background: '#F6F8FB', surface: '#DCE3F2', accent: '#7D92C9', accentSoft: '#B0C0E5', ink: '#364978' },
    listings: [
      {
        title: 'NYM-J Leitungen 3 x 1.5',
        price: '68 EUR / Ring',
        quantity: '3 Ringe',
        condition: 'neu',
        location: 'Troststrasse 65, 1100 Wien',
        dimensions: [{ label: 'Länge', value: '100 m' }, { label: 'Adern', value: '3' }, { label: 'Querschnitt', value: '1.5 mm2' }]
      },
      {
        title: 'Datenkabel Cat7 geschirmt',
        price: '82 EUR / Trommel',
        quantity: '2 Trommeln',
        condition: 'neu',
        location: 'Liechtensteinstrasse 87, 1090 Wien',
        dimensions: [{ label: 'Länge', value: '305 m' }, { label: 'Kategorie', value: 'Cat7' }, { label: 'Schirmung', value: 'S/FTP' }]
      }
    ]
  },
  [ObjectType.Sonstige]: {
    description: 'Sonstige Bauelemente für Werkstatt, Lager oder individuelle Weiterverwendung.',
    motif: 'misc',
    theme: { background: '#F7F6F3', surface: '#E4DFD5', accent: '#9A8F74', accentSoft: '#C9BEA7', ink: '#5A523E' },
    listings: [
      {
        title: 'Werkbankmodul auf Rollen',
        price: '260 EUR / Stk.',
        quantity: '1 Stk.',
        condition: 'gut',
        location: 'Perfektastrasse 89, 1230 Wien',
        dimensions: [{ label: 'Länge', value: '180 cm' }, { label: 'Breite', value: '70 cm' }, { label: 'Höhe', value: '92 cm' }]
      },
      {
        title: 'Regalsystem verzinkt',
        price: '140 EUR / Set',
        quantity: '1 Set',
        condition: 'sehr gut',
        location: 'Hollandstrasse 2, 1020 Wien',
        dimensions: [{ label: 'Länge', value: '240 cm' }, { label: 'Breite', value: '60 cm' }, { label: 'Höhe', value: '220 cm' }]
      }
    ]
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
    imageSrc: createPreviewImage(seed.theme, seed.motif, title),
    imageAlt: `Vorschau fuer ${title}`,
    listings: seed.listings.map((listing, index) => createListing(kind, title, listing, seed.theme, seed.motif, index))
  };
}

function createListing(
  kind: MarketCategoryKind,
  categoryTitle: string,
  listing: ListingSeed,
  theme: MarketPreviewTheme,
  fallbackMotif: MarketPreviewMotif,
  index: number
): MarketListing {
  return {
    id: `${kind}-${toSlug(categoryTitle)}-${index + 1}`,
    title: listing.title,
    price: listing.price,
    quantity: listing.quantity,
    condition: listing.condition,
    location: listing.location,
    dimensions: listing.dimensions,
    imageSrc: createPreviewImage(theme, listing.motif ?? fallbackMotif, listing.title),
    imageAlt: `Visualisierung fuer ${listing.title}`
  };
}

function createPreviewImage(theme: MarketPreviewTheme, motif: MarketPreviewMotif, label: string): string {
  const svg = `
    <svg width="640" height="360" viewBox="0 0 640 360" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="640" height="360" rx="28" fill="${theme.background}"/>
      <rect x="24" y="24" width="592" height="312" rx="22" fill="${theme.surface}"/>
      ${renderPreviewArt(motif, theme)}
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function renderPreviewArt(motif: MarketPreviewMotif, theme: MarketPreviewTheme): string {
  switch (motif) {
    case 'concrete':
      return `
        <rect x="92" y="86" width="180" height="98" rx="12" fill="${theme.accent}"/>
        <rect x="226" y="128" width="204" height="98" rx="12" fill="${theme.accentSoft}"/>
        <rect x="370" y="92" width="142" height="70" rx="10" fill="${theme.accent}"/>
        <circle cx="140" cy="120" r="4" fill="${theme.ink}" fill-opacity="0.24"/>
        <circle cx="230" cy="160" r="5" fill="${theme.ink}" fill-opacity="0.22"/>
        <circle cx="405" cy="112" r="4" fill="${theme.ink}" fill-opacity="0.22"/>
      `;
    case 'brick':
      return `
        <rect x="82" y="86" width="122" height="42" rx="8" fill="${theme.accent}"/>
        <rect x="216" y="86" width="122" height="42" rx="8" fill="${theme.accentSoft}"/>
        <rect x="350" y="86" width="122" height="42" rx="8" fill="${theme.accent}"/>
        <rect x="149" y="136" width="122" height="42" rx="8" fill="${theme.accentSoft}"/>
        <rect x="283" y="136" width="122" height="42" rx="8" fill="${theme.accent}"/>
        <rect x="417" y="136" width="122" height="42" rx="8" fill="${theme.accentSoft}"/>
        <rect x="82" y="186" width="122" height="42" rx="8" fill="${theme.accentSoft}"/>
        <rect x="216" y="186" width="122" height="42" rx="8" fill="${theme.accent}"/>
        <rect x="350" y="186" width="122" height="42" rx="8" fill="${theme.accentSoft}"/>
      `;
    case 'planks':
      return `
        <rect x="106" y="66" width="52" height="180" rx="10" fill="${theme.accent}"/>
        <rect x="166" y="78" width="48" height="168" rx="10" fill="${theme.accentSoft}"/>
        <rect x="222" y="58" width="54" height="188" rx="10" fill="${theme.accent}"/>
        <rect x="284" y="72" width="46" height="174" rx="10" fill="${theme.accentSoft}"/>
        <rect x="338" y="62" width="54" height="184" rx="10" fill="${theme.accent}"/>
        <rect x="400" y="80" width="50" height="166" rx="10" fill="${theme.accentSoft}"/>
        <rect x="458" y="68" width="56" height="178" rx="10" fill="${theme.accent}"/>
      `;
    case 'steel':
      return `
        <rect x="116" y="90" width="62" height="126" rx="12" fill="${theme.accent}" transform="rotate(-10 116 90)"/>
        <rect x="218" y="76" width="62" height="142" rx="12" fill="${theme.accentSoft}" transform="rotate(-10 218 76)"/>
        <rect x="322" y="88" width="62" height="126" rx="12" fill="${theme.accent}" transform="rotate(-10 322 88)"/>
        <rect x="426" y="70" width="62" height="146" rx="12" fill="${theme.accentSoft}" transform="rotate(-10 426 70)"/>
        <rect x="146" y="190" width="350" height="18" rx="9" fill="${theme.ink}" fill-opacity="0.18"/>
      `;
    case 'glass':
      return `
        <rect x="112" y="70" width="192" height="148" rx="14" fill="${theme.accentSoft}" fill-opacity="0.72" stroke="${theme.accent}" stroke-width="8"/>
        <rect x="328" y="92" width="160" height="126" rx="14" fill="${theme.accentSoft}" fill-opacity="0.6" stroke="${theme.accent}" stroke-width="8"/>
        <path d="M208 70V218" stroke="${theme.accent}" stroke-width="8"/>
        <path d="M112 144H304" stroke="${theme.accent}" stroke-width="8"/>
      `;
    case 'wool':
      return `
        <rect x="96" y="94" width="440" height="118" rx="22" fill="${theme.accentSoft}"/>
        <path d="M116 134C144 102 176 164 204 134C232 104 264 164 292 134C320 104 352 164 380 134C408 104 440 164 468 134C496 104 516 150 536 138" stroke="${theme.accent}" stroke-width="14" stroke-linecap="round"/>
        <path d="M116 174C144 142 176 204 204 174C232 144 264 204 292 174C320 144 352 204 380 174C408 144 440 204 468 174C496 144 516 190 536 178" stroke="${theme.accent}" stroke-width="14" stroke-linecap="round"/>
      `;
    case 'foam':
      return `
        <rect x="118" y="82" width="172" height="126" rx="16" fill="${theme.accent}"/>
        <rect x="278" y="110" width="172" height="110" rx="16" fill="${theme.accentSoft}"/>
        <circle cx="176" cy="128" r="12" fill="white" fill-opacity="0.44"/>
        <circle cx="222" cy="170" r="8" fill="white" fill-opacity="0.44"/>
        <circle cx="330" cy="154" r="12" fill="white" fill-opacity="0.36"/>
        <circle cx="390" cy="188" r="10" fill="white" fill-opacity="0.36"/>
      `;
    case 'gypsum':
      return `
        <rect x="118" y="78" width="196" height="122" rx="12" fill="${theme.accentSoft}"/>
        <rect x="200" y="110" width="196" height="122" rx="12" fill="${theme.accent}"/>
        <rect x="282" y="86" width="196" height="122" rx="12" fill="${theme.accentSoft}"/>
        <rect x="128" y="88" width="176" height="102" rx="10" fill="white" fill-opacity="0.24"/>
      `;
    case 'aggregate':
      return `
        <circle cx="160" cy="192" r="28" fill="${theme.accent}"/>
        <circle cx="214" cy="172" r="24" fill="${theme.accentSoft}"/>
        <circle cx="270" cy="194" r="30" fill="${theme.accent}"/>
        <circle cx="330" cy="166" r="22" fill="${theme.accentSoft}"/>
        <circle cx="382" cy="194" r="28" fill="${theme.accent}"/>
        <circle cx="444" cy="176" r="24" fill="${theme.accentSoft}"/>
        <rect x="118" y="206" width="350" height="20" rx="10" fill="${theme.ink}" fill-opacity="0.14"/>
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
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
