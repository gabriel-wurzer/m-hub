"""Run the parametric model over all of buildings_details (exported to gpkg)."""
import time

import geopandas as gpd

from parametric_model import collapse_bp, compute_parametric

SRC = "../data/parametric_input.gpkg"
OUT_CSV = "../data/parametric_output.csv"

t0 = time.time()
gdf = gpd.read_file(SRC)
print(f"read {len(gdf):,} buildings in {time.time()-t0:.1f}s | "
      f"bw_geb_id unique: {gdf['bw_geb_id'].is_unique}")

gdf["bp_code"] = gdf["bp"].map(collapse_bp)

t1 = time.time()
out = compute_parametric(
    gdf, group_col="bw_geb_id", period_col="bp_code", height_col="maxhoehe"
)
print(f"computed {len(out):,} rows in {time.time()-t1:.1f}s")

out.to_csv(OUT_CSV, index=False)
print(f"wrote {OUT_CSV}\n")

print("bp_code distribution:")
print(out["bp_code"].value_counts().sort_index().to_string())

print("\nnumeric summary:")
cols = ["storeys", "height_m", "gross_area_m2", "net_area_m2",
        "aussenwand_frei_lfm", "aussenwand_beruehrend_lfm", "innenwand_lfm", "floor_area_m2"]
print(out[cols].describe().round(1).to_string())

print("\nspot-check 5538110:")
print(out[out["group_id"] == "5538110"].to_string(index=False))
