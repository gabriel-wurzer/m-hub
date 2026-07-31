"""Gpkg-nativ (kein Prod-Zugriff): baut ./work/feat164k.csv + ./work/context.csv aus
../../data/mhub_wien.gpkg. Ersetzt die ad-hoc Prod-Extraktion.

feat164k: bp/dom_nutzung/m2flaeche/m3vol/m2bgf/maxhoehe sind Attribute; area_m2/perim_m/
  hull_area_m2 aus der Geometrie (EPSG:31256, metrisch); npoints = Stuetzpunkte; cx/cy Zentroid (4326).
context: Nachbarn innerhalb 0.0012 Grad (== Prod ST_DWithin(geom,geom,0.0012), Polygon-Distanz),
  aggregiert zu n_nb/sum_nb_area/mean_nb_area/std_nb_area (Nachbar-Flaeche = area_m2)."""
import numpy as np, pandas as pd, geopandas as gpd
from pyogrio import read_dataframe
GPKG="../../data/mhub_wien.gpkg"; RAD=0.0012

g=read_dataframe(GPKG,layer="buildings_details",fid_as_index=True).reset_index()
g=g.rename(columns={g.columns[0]:"fid"})
g=gpd.GeoDataFrame(g,geometry="geometry",crs=4326)
print("gebaeude:",len(g))
gm=g.geometry.to_crs(31256)                                          # metrisch
def npts(geom):
    parts=geom.geoms if geom.geom_type=="MultiPolygon" else [geom]
    return int(sum(len(p.exterior.coords)+sum(len(r.coords) for r in p.interiors) for p in parts))
area=gm.area.values
cent=g.geometry.centroid
feat=pd.DataFrame({"fid":g["fid"].values,"bp":g["bp"].values,"bp_best_guess":g["bp_best_guess"].values,"dom_nutzung":g["dom_nutzung"].values,
    "m2flaeche":g["m2flaeche"].values,"m3vol":g["m3vol"].values,"m2bgf":g["m2bgf"].values,
    "maxhoehe":g["maxhoehe"].values,"perim_m":gm.length.values,"npoints":g.geometry.apply(npts).values,
    "area_m2":area,"hull_area_m2":gm.convex_hull.area.values,"cx":cent.x.values,"cy":cent.y.values})
feat.to_csv("./work/feat164k.csv",index=False); print("feat164k geschrieben:",len(feat))

# context: Polygon-DWithin ueber gepufferte Geometrien (0.0012 Grad, planar wie Prod)
buf=gpd.GeoDataFrame({"fid":g["fid"].values},geometry=g.geometry.buffer(RAD,resolution=8),crs=4326)
nb=gpd.GeoDataFrame({"fid_nb":g["fid"].values,"nb_area":area},geometry=g.geometry,crs=4326)
j=gpd.sjoin(buf,nb,predicate="intersects")
j=j[j["fid"]!=j["fid_nb"]]
ctx=j.groupby("fid")["nb_area"].agg(n_nb="count",sum_nb_area="sum",mean_nb_area="mean",std_nb_area="std").reset_index()
ctx=pd.DataFrame({"fid":g["fid"].values}).merge(ctx,on="fid",how="left")   # auch fid ohne Nachbarn
ctx[["n_nb","sum_nb_area"]]=ctx[["n_nb","sum_nb_area"]].fillna(0)
ctx.to_csv("./work/context.csv",index=False); print("context geschrieben:",len(ctx),"| n_nb mean:",round(ctx["n_nb"].mean(),1))
