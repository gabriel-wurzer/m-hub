"""
run_vienna_materials.py — Apply-Stage ueber ALLE Wiener Gebaeude.

parametric_input.gpkg (164k) -> parametric_model -> apply_materials -> Materialbilanz
(Volumen + Masse) des Wiener Gebaeudebestands, gesamt und nach Bauperiode.
Erster Wurf: Konstanten sind Platzhalter, Dichten Standardwerte -> Groessenordnung,
noch keine geeichte Statistik.
"""
import time
from collections import defaultdict

import geopandas as gpd

import apply_materials as am
import parametric_model as pm

SRC = "../data/parametric_input.gpkg"

t0 = time.time()
gdf = gpd.read_file(SRC)
gdf["bp_code"] = gdf["bp"].map(pm.collapse_bp)
print(f"gelesen: {len(gdf):,} Gebaeude in {time.time()-t0:.1f}s")

t1 = time.time()
para = pm.compute_parametric(gdf, group_col="bw_geb_id",
                             period_col="bp_code", height_col="maxhoehe")
print(f"parametrik: {len(para):,} Zeilen in {time.time()-t1:.1f}s")

t2 = time.time()
total_vol = defaultdict(float)
period_mass = defaultdict(float)     # Masse [kg] je Bauperiode
n = 0
for row in para.itertuples(index=False):
    r = row._asdict()
    v = am.apply_building(r)
    n += 1
    for mat, x in v.items():
        total_vol[mat] += x
    period_mass[r["bauperiode"]] += sum(am.mass(v).values())
print(f"apply: {n:,} Gebaeude in {time.time()-t2:.1f}s "
      f"({len(am._profile_cache)} gecachte Element-Profile)")

total_mass = am.mass(total_vol)
tot_kg = sum(total_mass.values())
tot_m3 = sum(total_vol.values())

print("\n" + "=" * 66)
print("MATERIALBILANZ WIENER GEBAEUDEBESTAND  (Modell, erster Wurf)")
print("=" * 66)
print(f"Gesamt: {tot_kg/1e9:.1f} Mio t   /   {tot_m3/1e6:.1f} Mio m3")

print("\nTop-15 Materialien nach Masse:")
for mat, kg in sorted(total_mass.items(), key=lambda x: x[1], reverse=True)[:15]:
    flag = "" if mat in am.DENSITY else "  [Dichte-Default]"
    print(f"  {kg/1e9:7.2f} Mio t  {100*kg/tot_kg:4.1f}%  {mat}{flag}")

print("\nMasse nach Bauperiode:")
for bp, kg in sorted(period_mass.items(), key=lambda x: x[1], reverse=True):
    print(f"  {kg/1e9:7.2f} Mio t  {100*kg/tot_kg:4.1f}%  {bp}")

deflt_kg = sum(kg for mat, kg in total_mass.items() if mat not in am.DENSITY)
print(f"\nMasse aus Dichte-Default (Abdeckungscheck): {100*deflt_kg/tot_kg:.1f}%")
