"""Ehrliche Genauigkeit des deployten Modells: raeumliche GroupKFold-CV (0.005-Grad-Zellen,
gegen Autokorrelations-Leakage). Grob-3-Klassen (belastbarer Layer) und Fein-5-Klassen +
Nachkriegs-Split getrennt. Config wie deployt (RF, kein class_weight)."""
import numpy as np, pandas as pd, geopandas as gpd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_predict, GroupKFold
from sklearn.metrics import balanced_accuracy_score, f1_score, confusion_matrix

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
df["k5"]=df["bp"].apply(bp5)
df["k3_bp"]=df["k5"].map({1:"bis 1918",2:"1919-1945",3:"nach 1945",4:"nach 1945",5:"nach 1945"})
df["k3"]=df["k3_bp"].fillna(df["gt_raw"].apply(gt3))

df["area_m2"]=df["area_m2"].clip(lower=1); df["perim_m"]=df["perim_m"].clip(lower=1); df["hull_area_m2"]=df["hull_area_m2"].clip(lower=1)
df["compactness"]=4*np.pi*df["area_m2"]/(df["perim_m"]**2); df["solidity"]=(df["area_m2"]/df["hull_area_m2"]).clip(0,1)
df["log_area"]=np.log(df["area_m2"]); df["log_vol"]=np.log(df["m3vol"].clip(lower=1)); df["shape_idx"]=df["perim_m"]/np.sqrt(df["area_m2"])
df["vol_per_area"]=df["m3vol"].clip(lower=0)/df["area_m2"]; df["builtfrac"]=(df["sum_nb_area"].fillna(0)/37000).clip(0,3); df["log_meanA"]=np.log(df["mean_nb_area"].fillna(0).clip(lower=1))
feats=["log_area","log_vol","vol_per_area","m2bgf","maxhoehe","perim_m","npoints","compactness","shape_idx","solidity","n_nb","log_meanA","std_nb_area","builtfrac"]
Xall=pd.concat([df[feats].fillna(0),pd.get_dummies(df["dom_nutzung"].fillna("unk"),prefix="use")],axis=1).astype("float64")
cell=(df["cx"]/0.005).round().astype(int).astype(str)+"_"+(df["cy"]/0.005).round().astype(int).astype(str)

def cv(mask,y,classes,tag):
    X=Xall[mask].to_numpy(); yv=np.asarray(y[mask]); g=cell[mask].values
    p=cross_val_predict(RandomForestClassifier(n_estimators=300,min_samples_leaf=3,n_jobs=-1,random_state=42),
                        X,yv,cv=GroupKFold(5),groups=g,n_jobs=-1)
    acc=(p==yv).mean(); bal=balanced_accuracy_score(yv,p)
    print(f"\n=== {tag} | n={mask.sum()} | {len(set(g))} zellen ===")
    print(f"  accuracy={acc:.3f}   balanced={bal:.3f}")
    for c in classes:
        f=f1_score(yv,p,labels=[c],average='macro',zero_division=0)
        n=int((yv==c).sum()); print(f"  {str(c):12s} F1={f:.2f}  (n={n})")
    return p

# 1) Grob 3-Klassen (der belastbare Layer)
m3=df["k3"].notna()
cv(m3,df["k3"],["bis 1918","1919-1945","nach 1945"],"GROB 3-Klassen (bp + Stadt-Wien-Typologie)")

# 2) Nachkriegs-Split (Stage2): nur bp3/4/5
m2=df["k5"].isin([3,4,5])
cv(m2,df["k5"],[3,4,5],"FEIN Nachkriegs-Split 1945-79/1980-99/ab2000")

# 3) Direkt 5-Klassen (nur bp-Labels mit echter Feinklasse)
m5=df["k5"].notna()
cv(m5,df["k5"],[1,2,3,4,5],"FEIN 5-Klassen direkt")
