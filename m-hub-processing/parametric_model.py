"""
parametric_model.py — parametric geometry model for m-hub.

Plain GDAL/geopandas port of Wolfgang's QGIS scripts
  data/02_offset-walls, 03_add_attributes, 04_calculate-perimeter
with NO QGIS runtime.

Runs on m-hub's `buildings_details` (one row per building = one ACD unit, so no
dissolve/grouping needed; party walls are found between adjacent buildings). It
produces, per building, only the DERIVED VALUES the material step needs. No
geometry is persisted.

Output columns (one row per building):
  group_id                   the grouping key (bw_geb_id)
  bp_code                    building-period code 0..5 after collapsing bp
  bauperiode                 human label for bp_code
  storeys                    round(height / storey_height[bp])
  height_m
  wall_thickness_m           inward offset (mean exterior wall, by period)
  gross_area_m2              footprint area                            (02: fläche_alt)
  net_area_m2                footprint offset inward by wall_thickness  (02: fläche_neu)
  percentage_wall            1 - net/gross (exterior-wall footprint share; cross-check)
  aussenwand_frei_lfm        exterior wall NOT touching a neighbour     (04: FreiLaenge)
  aussenwand_beruehrend_lfm  exterior wall touching a neighbour = party (04: GrenzLaenge)
  innenwand_lfm              interior_wall_lfm_per_m2[bp] * net_area_m2
  floor_area_m2              gross_area * storeys

Period is the m-hub `bp` CODE (period.enum.ts): 0 unbekannt, 1 vor 1919,
2 1919-1944, 3 1945-1979, 4 1980-1999, 5 nach 2000. `bp` in buildings_details is
a comma-list (Stefan merged Bauteile of different periods) -> collapse_bp() picks
ONE code. The authoritative multi-period pick (by largest Bauteil volume) is
Stefan's upstream job; collapse_bp is only the defensive fallback (earliest).

The per-period constants are PLACEHOLDERS. The nightly run overrides them with
measured means from `parametric_calibration` (calibration_schema.sql) via a
`calibration=` overlay; a missing (period, metric) falls back to the placeholder.

Simplifications (agreed with Gabriel): ONE inward offset per building (not per
storey); exterior-wall QUANTITY = perimeter split (04), the ring stays as
`percentage_wall` for cross-check; storeys = height / storey_height (drops script
03's point join). All geometry in EPSG:31256 (metres); 4326 inputs reprojected.
"""

from __future__ import annotations

import geopandas as gpd
import pandas as pd
from shapely.strtree import STRtree

METRIC_CRS = "EPSG:31256"

# bp period codes -> human label (m-hub-frontend/src/app/enums/period.enum.ts)
PERIOD_LABEL = {
    0: "unbekannt", 1: "vor 1919", 2: "1919-1944",
    3: "1945-1979", 4: "1980-1999", 5: "nach 2000",
}

# --- per-period constants: PLACEHOLDER defaults, keyed by bp code -----------
# Fallbacks only; the calibration overlay wins wherever it has a value. Each
# entry is (per-code table, fallback for a code not in the table, incl. 0=unknown
# which is 93% of buildings). Guesses to be replaced by measured means.
_DEFAULTS: dict[str, tuple[dict[int, float], float]] = {
    # inward offset = mean exterior wall thickness [m]; older stock -> thicker
    "wall_thickness_m":         ({1: 0.70, 2: 0.60, 3: 0.50, 4: 0.40, 5: 0.35}, 0.60),
    # interior-wall running length per m² of NET floor area [1/m]; ~0.5, ~flat
    "interior_wall_lfm_per_m2": ({1: 0.50, 2: 0.50, 3: 0.53, 4: 0.55, 5: 0.58}, 0.50),
    # storey height [m] for storeys = round(height / storey_height); older taller
    "storey_height_m":          ({1: 3.5, 2: 3.2}, 3.0),
}

# ---- CALIBRATION -----------------------------------------------------------
# The constants above are guesses. Replace them with measured means kept in the
# `parametric_calibration` table (period=bp code, metric, value, n_samples); the
# nightly run loads them via load_calibration() and passes calibration= here.
# Empty table == these defaults, so the model runs day one and sharpens as data
# arrives. Sources: every plan / point-cloud slice / IFC through the plan tool is
# a sample -- wall_thickness_m = measured exterior thickness; interior_wall_lfm_per_m2
# = sum(interior-wall lengths)/net floor area; storey_height_m = floor-to-floor.
# Average per bp code, upsert. See project_processing_core calibration loop.


def collapse_bp(bp) -> int:
    """
    Collapse a buildings_details.bp value (e.g. '0', '0,1', '0,1,2') to ONE
    period code 0..5. Defensive rule: drop 0 (unknown); if one real period
    remains use it; if several, take the EARLIEST (min); if none, return 0.
    (Authoritative multi-period pick by largest Bauteil volume is upstream/Stefan.)
    """
    if bp is None:
        return 0
    codes = [int(t) for t in str(bp).split(",") if t.strip().isdigit()]
    real = sorted(c for c in codes if c != 0)
    return real[0] if real else 0


def metric(name: str, bp_code: int, calibration: dict | None = None) -> float:
    """Measured value from the calibration overlay if present, else placeholder."""
    if calibration:
        v = calibration.get(name, {}).get(bp_code)
        if v is not None:
            return float(v)
    table, fallback = _DEFAULTS[name]
    return table.get(bp_code, fallback)


def load_calibration(rows) -> dict[str, dict[int, float]]:
    """
    Build a calibration overlay from parametric_calibration rows.
    rows: iterable of (period, metric, value); period is the bp code. Nightly run:
        rows  = cur.execute("SELECT period, metric, value FROM parametric_calibration")
        calib = load_calibration(rows)
        df    = compute_parametric(..., calibration=calib)
    """
    calib: dict[str, dict[int, float]] = {}
    for period, metric_name, value in rows:
        calib.setdefault(metric_name, {})[int(period)] = float(value)
    return calib


# --- core ------------------------------------------------------------------

def compute_parametric(
    buildings: gpd.GeoDataFrame,
    *,
    group_col: str,
    period_col: str,
    height_col: str,
    calibration: dict | None = None,
) -> pd.DataFrame:
    """
    buildings: one row per building footprint, with
      group_col  -> grouping key (bw_geb_id in m-hub; already one row per group)
      period_col -> bp CODE 0..5 (collapse the raw bp string first, see collapse_bp)
      height_col -> building height in metres (group max is used)
    Returns one row per group with the derived values (no geometry).
    """
    gdf = buildings.to_crs(METRIC_CRS)
    gdf = gdf[gdf.geometry.notna() & gdf[group_col].notna()].copy()

    if gdf[group_col].is_unique:
        # one row per group already (m-hub buildings_details): skip the dissolve
        idx = gdf.set_index(group_col)
        blocks = idx[["geometry"]].copy()
        blocks["bp_code"] = idx[period_col].astype(int)
        blocks["height_m"] = idx[height_col].fillna(0).astype(float)
    else:
        blocks = gdf.dissolve(by=group_col)[["geometry"]]

        def _first_code(s: pd.Series):
            s = s.dropna()
            return int(s.mode().iloc[0]) if not s.empty else 0

        agg = gdf.groupby(group_col).agg(
            bp_code=(period_col, _first_code),
            height_m=(height_col, "max"),
        )
        blocks = blocks.join(agg)

    geoms = list(blocks.geometry.values)
    ids = list(blocks.index)
    tree = STRtree(geoms)

    rows = []
    for i, geom in enumerate(geoms):
        if geom is None or geom.is_empty:
            continue
        bp_code = int(blocks.iloc[i]["bp_code"])
        height = float(blocks.iloc[i]["height_m"] or 0.0)

        thickness = metric("wall_thickness_m", bp_code, calibration)
        storey_h = metric("storey_height_m", bp_code, calibration)
        lfm_per_m2 = metric("interior_wall_lfm_per_m2", bp_code, calibration)

        gross_area = geom.area
        inner = geom.buffer(-thickness)
        net_area = inner.area if not inner.is_empty else 0.0

        boundary = geom.boundary
        perimeter = boundary.length

        # 04: length of this building's boundary that touches ANOTHER building
        touching = 0.0
        for j in tree.query(geom):
            if j == i:
                continue
            other = geoms[j]
            if other is None or other.is_empty or not other.intersects(boundary):
                continue
            shared = boundary.intersection(other)
            if not shared.is_empty:
                touching += shared.length
        touching = min(touching, perimeter)
        free = perimeter - touching

        storeys = max(1, round(height / storey_h)) if height else 1
        innenwand_lfm = lfm_per_m2 * net_area

        rows.append(
            dict(
                group_id=ids[i],
                bp_code=bp_code,
                bauperiode=PERIOD_LABEL.get(bp_code, "unbekannt"),
                storeys=storeys,
                height_m=round(height, 2),
                wall_thickness_m=thickness,
                gross_area_m2=round(gross_area, 2),
                net_area_m2=round(net_area, 2),
                percentage_wall=round(1 - net_area / gross_area, 4) if gross_area else 0.0,
                aussenwand_frei_lfm=round(free, 2),
                aussenwand_beruehrend_lfm=round(touching, 2),
                innenwand_lfm=round(innenwand_lfm, 2),
                floor_area_m2=round(gross_area * storeys, 2),
            )
        )

    return pd.DataFrame(rows)


if __name__ == "__main__":
    # collapse_bp checks (the defensive rule)
    assert collapse_bp("0") == 0
    assert collapse_bp("0,1") == 1
    assert collapse_bp("0,2") == 2
    assert collapse_bp("0,1,2") == 1      # earliest real
    assert collapse_bp("2,4") == 2
    assert collapse_bp(None) == 0
    print("collapse_bp: ok")

    # Synthetic self-check: three unit squares in a row. Middle shares a full edge
    # with each neighbour (party on 2 sides), outer two share one edge each.
    from shapely.geometry import Polygon

    squares = gpd.GeoDataFrame(
        {
            "bw_geb_id": ["A", "B", "C"],
            "bp": ["0,2", "2", "0,5"],   # -> codes 2, 2, 5
            "maxhoehe": [12.0, 12.0, 9.0],
        },
        geometry=[
            Polygon([(0, 0), (10, 0), (10, 10), (0, 10)]),
            Polygon([(10, 0), (20, 0), (20, 10), (10, 10)]),
            Polygon([(20, 0), (30, 0), (30, 10), (20, 10)]),
        ],
        crs=METRIC_CRS,
    )
    squares["bp_code"] = squares["bp"].map(collapse_bp)
    out = compute_parametric(
        squares, group_col="bw_geb_id", period_col="bp_code", height_col="maxhoehe"
    )
    with pd.option_context("display.width", 240, "display.max_columns", None):
        print(out.to_string(index=False))
