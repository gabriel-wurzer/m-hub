"""Hierarchischer Rollout: Stage1 = 3-Klassen (bis1918/1919-45/nach1945, glaubwuerdig, Union-Labels).
Stage2 = verfeinert NUR nach-1945 in 1945-79/1980-99/ab2000 (trainiert auf den bp3/4/5-Labels).
Bekannte bp sticht. Kein class_weight (natuerlicher Prior -> keine Verteilungs-Verzerrung)."""
import numpy as np, pandas as pd, geopandas as gpd
from sklearn.ensemble import RandomForestClassifier
OUT="./work/bp_hier_prediction.csv"
N5={1:"bis 1918",2:"1919-1944",3:"1945-1979",4:"1980-1999",5:"ab 2000"}

df=pd.read_csv("./work/feat164k.csv").merge(pd.read_csv("./work/context.csv"),on="fid",how="left")
poly=gpd.read_file("./work/gebtyp_full.json")[["OBJ_STR2_TXT","geometry"]]
if poly.crs is None: poly=poly.set_crs(31256)
poly=poly.to_crs(4326)
pts=gpd.GeoDataFrame(df,geometry=gpd.points_from_xy(df.cx,df.cy),crs=4326)
jj=gpd.sjoin(pts,poly,how="left",predicate="within"); jj=jj[~jj.index.duplicated(keep="first")]; df["gt_raw"]=jj["OBJ_STR2_TXT"].values
def gt3(s):
    s=str(s).replace(" ","")
    return "nach 1945" if s=="nach1945" else "1919-1945" if s.startswith("1919") else ("bis 1918" if s in ("vor1848","1848-1918","1849-1859") else None)
def bp5(bp):
    r=[int(x) for x in str(bp).split(",") if x.strip() and x.strip()!="0"]; return min(r) if r else np.nan
df["k5"]=df["bp"].apply(bp5)                                          # bekannte 5-klasse (1..5) oder NaN
df["k3_bp"]=df["k5"].map({1:"bis 1918",2:"1919-1945",3:"nach 1945",4:"nach 1945",5:"nach 1945"})
df["k3"]=df["k3_bp"].fillna(df["gt_raw"].apply(gt3))                  # bekannte 3-klasse (bp bevorzugt, sonst gebtyp)

df["area_m2"]=df["area_m2"].clip(lower=1); df["perim_m"]=df["perim_m"].clip(lower=1); df["hull_area_m2"]=df["hull_area_m2"].clip(lower=1)
df["compactness"]=4*np.pi*df["area_m2"]/(df["perim_m"]**2); df["solidity"]=(df["area_m2"]/df["hull_area_m2"]).clip(0,1)
df["log_area"]=np.log(df["area_m2"]); df["log_vol"]=np.log(df["m3vol"].clip(lower=1)); df["shape_idx"]=df["perim_m"]/np.sqrt(df["area_m2"])
df["vol_per_area"]=df["m3vol"].clip(lower=0)/df["area_m2"]; df["builtfrac"]=(df["sum_nb_area"].fillna(0)/37000).clip(0,3); df["log_meanA"]=np.log(df["mean_nb_area"].fillna(0).clip(lower=1))
feats=["log_area","log_vol","vol_per_area","m2bgf","maxhoehe","perim_m","npoints","compactness","shape_idx","solidity","n_nb","log_meanA","std_nb_area","builtfrac"]
X=pd.concat([df[feats].fillna(0),pd.get_dummies(df["dom_nutzung"].fillna("unk"),prefix="use")],axis=1).astype("float64").to_numpy()

# --- Stage 1: 3-Klassen ---
m1=df["k3"].notna()
c1=RandomForestClassifier(n_estimators=400,min_samples_leaf=3,n_jobs=-1,random_state=42).fit(X[m1.values],df.loc[m1,"k3"].values)
pr1=c1.predict_proba(X); cl1=list(c1.classes_)
df["s1"]=[cl1[i] for i in pr1.argmax(1)]; df["s1_conf"]=pr1.max(1)
df["coarse"]=df["k3"].fillna(df["s1"])                               # bekannte 3-klasse sonst Stage1
print("Stage1 3-Klassen train:",int(m1.sum()))

# --- Stage 2: verfeinert nur nach-1945 (bp3/4/5) ---
m2=df["k5"].isin([3,4,5])
c2=RandomForestClassifier(n_estimators=400,min_samples_leaf=2,n_jobs=-1,random_state=42).fit(X[m2.values],df.loc[m2,"k5"].astype(int).values)
pr2=c2.predict_proba(X); cl2=list(c2.classes_)
df["s2"]=[cl2[i] for i in pr2.argmax(1)]; df["s2_conf"]=pr2.max(1)
print("Stage2 nach-1945 train:",int(m2.sum()),dict(df.loc[m2,"k5"].astype(int).value_counts().sort_index()))

# --- Zusammenbau: bekannte bp sticht; sonst coarse, nach-1945 via Stage2 ---
def final5(r):
    if not np.isnan(r["k5"]): return int(r["k5"])
    if r["coarse"]=="bis 1918": return 1
    if r["coarse"]=="1919-1945": return 2
    return int(r["s2"])                                              # nach 1945 -> verfeinert
df["bp5_final"]=df.apply(final5,axis=1)
df["source"]=np.where(df["k5"].notna(),"known_bp",np.where(df["k3"].notna(),"known_coarse","predicted"))
def conf_row(r):
    if not np.isnan(r["k5"]): return 1.0                             # fine bp bekannt
    known_c=pd.notna(r["k3"])                                        # grobklasse bekannt (gebtyp)
    if r["coarse"] in ("bis 1918","1919-1945"):
        return 1.0 if known_c else round(float(r["s1_conf"]),3)      # grob determiniert die feinklasse
    return round((1.0 if known_c else float(r["s1_conf"]))*float(r["s2_conf"]),3)  # nach1945: sub-split unsicher
df["conf"]=df.apply(conf_row,axis=1)
for c in cl2: df[f"p_bp{c}"]=(pr1[:,cl1.index("nach 1945")]*pr2[:,cl2.index(c)]).round(3)  # p(nachkrieg-subklasse)
print("=== quelle ===",dict(df["source"].value_counts()))
print("=== bp5_final verteilung ===",{N5[k]:int(v) for k,v in df["bp5_final"].value_counts().sort_index().items()})
df["coarse3"]=df["coarse"]                                            # trustworthy 3-klasse
cols=["fid","bp5_final","coarse3","source","conf","p_bp3","p_bp4","p_bp5"]
df[cols].to_csv(OUT,index=False); print("geschrieben:",OUT,"|",len(df),"zeilen")
