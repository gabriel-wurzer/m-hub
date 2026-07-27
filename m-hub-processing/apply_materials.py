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
    "Bitumen": 1050, "Abdichtung": 1000, "Dachschindeln": 1100,
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
            return float(s.mean())
    return default


def ort_split(row):
    """Parametrische Zeile -> Liste von (ort, art, flaeche_m2)."""
    P = float(row["aussenwand_frei_lfm"]) + float(row["aussenwand_beruehrend_lfm"])
    A = float(row["gross_area_m2"])
    iw_lfm = float(row["innenwand_lfm"])
    N = int(row["storeys"])
    K = int(row["keller_geschosse"])
    DG = int(row["dachgeschosse"])
    RG = max(0, N - DG)
    h = float(row["height_m"]) / N if N else 3.0

    elements = []
    for ort, n in (("KG", K), ("RG", RG), ("DG", DG)):
        if n > 0:
            elements.append((ort, "AW", P * h * n))
            elements.append((ort, "IW", iw_lfm * h * n))
            elements.append((ort, "FB", A * n))
    elements.append(("DG", "D", float(row["dach_area_m2"])))   # Dach immer (ein Dach je Gebaeude)
    return elements


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
    for ort, art, area in ort_split(row):
        if area <= 0:
            continue
        T = wt if art == "AW" else catalog_T(bp, ort, art)
        for material, t in element_profile(bp, ort, art, T):
            vol[material] += t * area
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
