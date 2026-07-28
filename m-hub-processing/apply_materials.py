"""
apply_materials.py — Apply-Stage: parametrische Geometrie x Materialvorhersage.

Fuehrt die drei Bausteine zusammen:
  parametric_model  -> Geometrie je Gebaeude (Perimeter, Flaechen, Geschosse, Keller/Dach)
  material_markov   -> Materialfolge je (Bauperiode, Ort, Art)          [Stufe 1]
  material_thickness-> Schichtdicken (Modell C), auf Gesamtstaerke T     [Stufe 2]
Ergebnis: Volumen [m3] je Material je Gebaeude.

Ort-Split (mit Wolfgang abgestimmt):
  Geschosse je Ort: KG = keller_geschosse, DG = dachgeschosse (oben), RG = storeys - DG
  AW je Ort  = Perimeter        x Geschosshoehe x Geschosse
  IW je Ort  = innenwand_lfm     x Geschosshoehe x Geschosse
  FB je Ort  = Fussabdruckflaeche               x Geschosse
  Dach (DG,D)= dach_area_m2  (Fussabdruck x Dachfaktor 1.2, vereinfacht)

Dicke T je Element: AW = wall_thickness_m (parametrisch, gebaeudespezifisch),
sonst Katalog-Mittel `staerke` je (bp, ort, art) mit Backoff.
"""
from collections import defaultdict
from functools import lru_cache

import pandas as pd

import material_markov as mk
import material_thickness as th


# Rohdichten [kg/m3], erster Wurf mit Standardwerten (spaeter verfeinern).
DENSITY = {
    "Ziegel": 1800, "Vollziegel": 2000, "Beton": 2300, "STB": 2400,
    "Leichtbeton": 1200, "Betonfertigteil": 2400, "Betonträger/Untezug": 2400,
    "Stein": 2600, "Unterzug": 2400, "Wand": 1800, "Stiegen": 2400, "Stiegenhaus": 2400,
    "Putz": 1600, "Putzträger": 1600, "Gips": 1000, "Estrich": 2100, "Schüttung": 1600,
    "Dämmung-weich": 40, "Dämmung-hart": 150, "Styropor": 20,
    "Heraklith": 450, "Heraklith/Holz": 450,
    "Glas": 2500, "Keramik": 2000, "Wandfliesen": 2000, "Faserzement": 1700, "Dachfenster": 2500,
    "Bitumen": 1050, "Abdichtung": 1000, "Dachschindeln": 1100, "Dachaufbau": 1000, "Dachlucke": 2500,
    "Stahl": 7850, "Stahlträger": 7850, "IPE": 7850, "IPE 140": 7850, "IPE Träger": 7850,
    "Rundeisen": 7850, "Träger": 7850, "Gitterträger": 7850, "Metall": 7850, "Blech": 7850,
    "Blechdach": 7850, "Trockenbauprofil": 7850, "Blitzableiter": 7850, "Dachrinne": 7850,
    "Geländer": 7850, "Geländersteher": 7850, "Lawinengitter": 7850,
    "Rigipswand": 900,
    "Holz": 500, "Holzschalung": 500, "Holztram": 500, "Holzträger": 500, "Sparren": 500,
    "Latten": 500, "Ziegellatten": 500, "Pfetten": 500, "Querpfetten": 500, "Längspfetten": 500,
    "Querbalken": 500, "Längsbalken": 500, "Bodensparren": 500, "Bodenbretter": 500,
    "Pfosten": 500, "Säulen": 500, "Dippelbaum": 500, "Dippelboden": 500, "Tramdecke": 500,
    "Wandverkleidung": 500, "Unterkonstruktion": 500, "Ausfachung": 500, "Ausspreizung": 500,
    "Aussteifung": 500,
}
DENSITY_DEFAULT = 1500   # unmapped -> mittleres Mineral


def mass(vol):
    """m3 je Material -> kg je Material."""
    return {m: v * DENSITY.get(m, DENSITY_DEFAULT) for m, v in vol.items()}


@lru_cache(maxsize=None)
def catalog_T(bp, ort, art, default=0.20):
    """Mittlere Gesamtstaerke aus dem Katalog je (bp,ort,art), Backoff, sonst default."""
    d = th.df
    for f in [(d.bauperiode == bp) & (d.ort == ort) & (d.art == art),
              (d.ort == ort) & (d.art == art),
              (d.art == art)]:
        s = pd.to_numeric(d.loc[f, "staerke"], errors="coerce").dropna()
        if len(s):
            return float(s.median())   # median, nicht mean: robust gegen Dateneingabe-Ausreisser (IW/D bis 18-50m)
    return default


def _floors(row):
    """[(ort, geschosse)] fuer KG / RG / DG."""
    N = int(row["storeys"])
    return [("KG", int(row["keller_geschosse"])),
            ("RG", max(0, N - int(row["dachgeschosse"]))),
            ("DG", int(row["dachgeschosse"]))]


def _storey_h(row):
    N = int(row["storeys"])
    return float(row["height_m"]) / N if N else 3.0


def ort_split(row):
    """AW, FB (+ Dach) — die datengetriebenen Elemente. IW siehe iw_split()."""
    # party walls (beruehrend) are SHARED with the neighbour -> count HALF, sonst
    # zaehlt die Stadtbilanz jede geteilte Wand doppelt (beide Nachbarn sehen sie).
    P = float(row["aussenwand_frei_lfm"]) + 0.5 * float(row["aussenwand_beruehrend_lfm"])
    A = float(row["gross_area_m2"])
    h = _storey_h(row)
    elements = []
    for ort, n in _floors(row):
        if n > 0:
            elements.append((ort, "AW", P * h * n))
            elements.append((ort, "FB", A * n))
    elements.append(("DG", "D", float(row["dach_area_m2"])))   # Dach immer (ein Dach je Gebaeude)
    return elements


# --- Innenwand-Modell (Wolfgangs Struktur, kalibrierbar) -------------------
# tragend = Kamininnenwand ~ Gebaeudelaenge; bis 1945 Ziegel 45cm, danach STB 25cm.
# leicht  = restliche Innenwand (Trennwand), 12cm Leichtbau-Proxy (Gips).
# (Wohnungstrennwaende erstmal in "leicht" gefaltet — Wolfgangs offener Punkt.)
IW_TRAGEND = {   # bp_code -> Aufbau (Kaminwand ~ Gebaeudelaenge), Wolfgang 2026-07-28
    0: [("Putz", 0.015), ("Ziegel", 0.45), ("Putz", 0.015)],   # unbekannt -> Altbau, 48cm
    1: [("Putz", 0.015), ("Ziegel", 0.45), ("Putz", 0.015)],   # bis 1918: Kaminwand 48cm
    2: [("Putz", 0.015), ("Ziegel", 0.42), ("Putz", 0.015)],   # 1919-44: Kaminwand 45cm
    3: [("STB", 0.15)],   # 1945-79: Betonphase, STB 15cm
    4: [("STB", 0.18)],   # 1980-99: STB 15-20cm
    5: [("STB", 0.18)],   # ab 2000: dito
}
IW_TRAGEND_DEFAULT = [("Putz", 0.015), ("Ziegel", 0.45), ("Putz", 0.015)]

# leichte (nicht-tragende) IW — Aufbau je bp_code (Wolfgang 2026-07-28). WICHTIG: im
# Altbau ist die "leichte" IW SOLIDER Ziegel (schwer!), erst ab ~1970 Gipskarton-
# Staenderwand (leicht, effektiv nur ~2 Platten -> als Gips 0.025 modelliert).
IW_LEICHT = {
    0: [("Putz", 0.015), ("Ziegel", 0.14), ("Putz", 0.015)],   # unbekannt -> Altbau, 17cm
    1: [("Putz", 0.015), ("Ziegel", 0.14), ("Putz", 0.015)],   # bis 1918, 17cm
    2: [("Putz", 0.010), ("Ziegel", 0.12), ("Putz", 0.010)],   # 1919-44, 14cm
    3: [("Putz", 0.010), ("Ziegel", 0.12), ("Putz", 0.010)],   # 1945-79, Nachkrieg-Ziegel (Repr.)
    4: [("Gips", 0.025)],   # 1980-99, Gipskarton-Staenderwand (effektiv ~2x12.5mm)
    5: [("Gips", 0.025)],   # ab 2000, dito
}
IW_LEICHT_DEFAULT = [("Putz", 0.015), ("Ziegel", 0.14), ("Putz", 0.015)]

# Wohnungstrennwaende (zwischen Wohnungen) — 3. IW-Kategorie, Aufbau je bp (Wolfgang 2026-07-28).
IW_WOHNUNG = {
    0: [("Putz", 0.015), ("Ziegel", 0.29), ("Putz", 0.015)],   # unbekannt -> Altbau, 32cm
    1: [("Putz", 0.015), ("Ziegel", 0.29), ("Putz", 0.015)],   # bis 1918, 32cm
    2: [("Putz", 0.015), ("Ziegel", 0.29), ("Putz", 0.015)],   # 1919-44, 32cm
    3: [("Ziegel", 0.25)],   # 1945-79: Schallschutzziegel 25cm (1970er; 1960er war STB 15)
    4: [("Beton", 0.25)],    # 1980-99: Fuellziegel mit Beton ausgegossen, 25cm
    5: [("STB", 0.20)],      # ab 2000: Ortbeton 20cm
}
IW_WOHNUNG_DEFAULT = [("Putz", 0.015), ("Ziegel", 0.29), ("Putz", 0.015)]

# Aufteilung der Innenwand-LAENGE (Platzhalter, = Punkt 7 fuer Wolfgang): tragend =
# Kaminwand ~ Gebaeudelaenge; vom Rest sind WOHNUNG_ANTEIL Wohnungstrennwaende, Rest leicht.
WOHNUNG_ANTEIL = 0.35


def iw_split(row):
    """Wolfgangs IW-Struktur -> [(typ, material, dicke_m, flaeche_m2)];
    tragend ~ Gebaeudelaenge, leicht = Rest der Innenwand-Laenge."""
    code = int(row["bp_code"])
    laenge = float(row["gebaeudelaenge_m"])
    iw_lfm = float(row["innenwand_lfm"])
    h = _storey_h(row)
    tragend_aufbau = IW_TRAGEND.get(code, IW_TRAGEND_DEFAULT)
    wohnung_aufbau = IW_WOHNUNG.get(code, IW_WOHNUNG_DEFAULT)
    leicht_aufbau = IW_LEICHT.get(code, IW_LEICHT_DEFAULT)
    out = []
    for ort, n in _floors(row):
        if n <= 0:
            continue
        tragend_lfm = min(laenge, iw_lfm)              # Kaminwand <= gesamte IW-Laenge
        rest = max(0.0, iw_lfm - tragend_lfm)
        wohnung_lfm = WOHNUNG_ANTEIL * rest
        leicht_lfm = rest - wohnung_lfm
        for mat, dick in tragend_aufbau:
            out.append(("tragend", mat, dick, tragend_lfm * h * n))
        for mat, dick in wohnung_aufbau:
            out.append(("wohnung", mat, dick, wohnung_lfm * h * n))
        for mat, dick in leicht_aufbau:
            out.append(("leicht", mat, dick, leicht_lfm * h * n))
    return out


_profile_cache = {}


def element_profile(bp, ort, art, T):
    """[(material, dicke)] fuer ein Element. Gecacht: haengt nur an (bp,ort,art,T),
    nicht am Einzelgebaeude -> ein Markov/Dicke-Lauf je Zelle statt je Gebaeude."""
    key = (bp, ort, art, round(float(T), 4))
    if key not in _profile_cache:
        pred = mk.predict(bp, ort, art, k=1)
        if pred and pred[0][0]:
            seq = pred[0][0]
            _profile_cache[key] = list(zip(seq, th.predict_C(seq, bp, ort, art, T)))
        else:
            _profile_cache[key] = []
    return _profile_cache[key]


def apply_building(row):
    """Volumen [m3] je Material fuer ein Gebaeude (parametrische Zeile)."""
    bp = row["bauperiode"]
    wt = float(row["wall_thickness_m"])
    vol = defaultdict(float)
    for ort, art, area in ort_split(row):            # AW, FB, Dach: Markov + C
        if area <= 0:
            continue
        T = wt if art == "AW" else catalog_T(bp, ort, art)
        for material, t in element_profile(bp, ort, art, T):
            vol[material] += t * area
    for _typ, material, dicke, area in iw_split(row):   # IW: Wolfgangs Struktur
        if area > 0:
            vol[material] += dicke * area
    return dict(vol)


if __name__ == "__main__":
    import geopandas as gpd
    from shapely.geometry import Polygon

    import parametric_model as pm

    # drei freistehende Gebaeude (kein Party-Wall), je 20x15 = 300 m2
    def rect(x):
        return Polygon([(x, 0), (x + 20, 0), (x + 20, 15), (x, 15)])

    gdf = gpd.GeoDataFrame(
        {"bw_geb_id": ["Gruenderzeit", "Nachkrieg", "Achtziger"],
         "bp": ["1", "3", "4"],
         "maxhoehe": [18.0, 24.0, 12.0]},
        geometry=[rect(0), rect(40), rect(80)],
        crs=pm.METRIC_CRS,
    )
    gdf["bp_code"] = gdf["bp"].map(pm.collapse_bp)
    para = pm.compute_parametric(gdf, group_col="bw_geb_id",
                                 period_col="bp_code", height_col="maxhoehe")

    for _, row in para.iterrows():
        vols = apply_building(row)
        total = sum(vols.values()) or 1.0
        print("=" * 60)
        print(f"{row['group_id']}  ({row['bauperiode']}, {row['storeys']} OG + "
              f"{row['keller_geschosse']} KG, {row['gross_area_m2']:.0f} m2 Grundriss)")
        print(f"  Materialvolumen gesamt: {sum(vols.values()):.0f} m3")
        for m, v in sorted(vols.items(), key=lambda x: x[1], reverse=True)[:8]:
            print(f"    {v:8.1f} m3  {v/total*100:4.0f}%  {m}")
