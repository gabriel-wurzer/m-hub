"""Finaler Schritt: bp_hier_prediction.csv (auf fid) auf den App-Key bw_geb_id umschluesseln
und als gzip nach m-hub-db/ schreiben, wo deploy.sh es laedt. Die gpkg-Feature-ID (implizit,
1-basiert) == fid in feat164k/bp_hier_prediction (validiert: bp-Match 100%)."""
import pandas as pd
from pyogrio import read_dataframe
GPKG="../../data/mhub_wien.gpkg"
OUT="../../m-hub-db/building_period_prediction.csv.gz"

g=read_dataframe(GPKG,layer="buildings_details",columns=["bw_geb_id"],fid_as_index=True,read_geometry=False).reset_index()
g.columns=["fid","bw_geb_id"]; g["bw_geb_id"]=g["bw_geb_id"].astype(str).str.strip()
assert g["bw_geb_id"].is_unique and (g["bw_geb_id"]!="").all(), "bw_geb_id nicht eindeutig/leer -> kein PK"

pred=pd.read_csv("./work/bp_hier_prediction.csv")
out=pred.merge(g,on="fid",how="left").drop(columns=["fid"])
assert out["bw_geb_id"].notna().all(), "fid ohne bw_geb_id -> Alignment kaputt"
# Spaltenreihenfolge = Tabelle building_period_prediction (COPY ist positionsbasiert)
out=out[["bw_geb_id","bp5_final","coarse3","source","conf","p_bp3","p_bp4","p_bp5"]]
out.to_csv(OUT,index=False,compression="gzip")
print("geschrieben:",OUT,"|",len(out),"zeilen")
