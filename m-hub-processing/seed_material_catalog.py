"""Seed the Bauperiodenkatalog (material_catalog) from useCasesAufbauten.xlsx.

Maps the Stadt-Wien period strings to bp codes and emits data/material_catalog.csv
(loaded to PostGIS via ogr2ogr). bp 5 (2001-) and bp 0 (unbekannt) have no sample
build-ups; the file's "1981-" == bp4 (1981-2000) since the 11 use cases contain no
2001- buildings. All orts kept (RG/DG/KG).
"""
import pandas as pd

SRC = "../data/useCasesAufbauten.xlsx"
OUT = "../data/material_catalog.csv"

# Bauperiode string -> bp code. The regenerated xlsx uses m-hub's boundaries
# exactly; bp 5 (ab 2000) and bp 0 (unbekannt) have no sample build-ups.
BP = {"bis 1918": 1, "1919-1944": 2, "1945-1979": 3, "1980-1999": 4}

df = pd.read_excel(SRC, sheet_name="Ergebnis")
df.columns = ["bauperiode", "ort", "art", "aufbau", "nettoflaeche",
              "anteil", "pct_po", "stk", "staerke"]

df["bp"] = df["bauperiode"].astype(str).str.strip().map(BP)
unmapped = sorted(df.loc[df["bp"].isna(), "bauperiode"].astype(str).unique())
assert not unmapped, f"unmapped Bauperiode values: {unmapped}"
df["bp"] = df["bp"].astype(int)
df["quelle"] = "vermessung"

out = df[["bp", "ort", "art", "aufbau", "nettoflaeche", "anteil", "stk", "staerke", "quelle"]]
out.to_csv(OUT, index=False, encoding="utf-8-sig")

print(f"wrote {len(out)} catalog rows -> {OUT}")
print("\nrows per bp:", out["bp"].value_counts().sort_index().to_dict())
print("rows per Ort:", out["ort"].value_counts().to_dict())
print("rows per Art:", out["art"].value_counts().to_dict())
print("\nrows per (bp, ort, art):")
print(out.groupby(["bp", "ort", "art"]).size().to_string())
