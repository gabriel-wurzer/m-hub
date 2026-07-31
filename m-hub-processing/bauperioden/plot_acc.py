"""Genauigkeits-Bild: Confusion-Matrizen (raeumlich kreuzvalidiert) fuer Grob-3 und Fein-5.
Zeilen-normiert = Recall je echter Epoche. Macht die post-1980-Blindheit sichtbar."""
import numpy as np, pandas as pd, geopandas as gpd
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_predict, GroupKFold
from sklearn.metrics import balanced_accuracy_score, confusion_matrix
OUT="./out/bp_accuracy_phone.png"

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

def cvpred(mask,y):
    X=Xall[mask].to_numpy(); yv=np.asarray(y[mask]); g=cell[mask].values
    p=cross_val_predict(RandomForestClassifier(n_estimators=300,min_samples_leaf=3,n_jobs=-1,random_state=42),
                        X,yv,cv=GroupKFold(5),groups=g,n_jobs=-1)
    return yv,p

m3=df["k3"].notna(); y3,p3=cvpred(m3,df["k3"])
m5=df["k5"].notna(); y5,p5=cvpred(m5,df["k5"])
L3=["bis 1918","1919-1945","nach 1945"]
L5=["bis 1918","1919-1944","1945-1979","1980-1999","ab 2000"]
cm3=confusion_matrix(y3,p3,labels=L3); cm5=confusion_matrix(y5,p5,labels=[1,2,3,4,5])

def heat(ax,cm,labels,title):
    rn=cm/cm.sum(1,keepdims=True).clip(min=1)
    im=ax.imshow(rn,cmap="Blues",vmin=0,vmax=1,aspect="equal")
    ax.set_xticks(range(len(labels))); ax.set_yticks(range(len(labels)))
    ax.set_xticklabels(labels,rotation=35,ha="right",fontsize=9); ax.set_yticklabels(labels,fontsize=9)
    ax.set_xlabel("vorhergesagt",fontsize=10); ax.set_ylabel("tatsaechlich (echtes Label)",fontsize=10)
    for i in range(len(labels)):
        for j in range(len(labels)):
            t=f"{rn[i,j]*100:.0f}%\n{cm[i,j]:,}".replace(",",".")
            ax.text(j,i,t,ha="center",va="center",fontsize=8.5,color="white" if rn[i,j]>0.5 else "#222",weight="bold" if i==j else "normal")
    ax.set_title(title,weight="bold",fontsize=12,pad=8)
    for s in ax.spines.values(): s.set_visible(False)

fig,ax=plt.subplots(2,1,figsize=(8.5,15)); fig.patch.set_facecolor("white")
heat(ax[0],cm3,L3,f"GROB 3 Klassen\naccuracy {(p3==y3).mean()*100:.0f}%  ·  balanced {balanced_accuracy_score(y3,p3)*100:.0f}%")
heat(ax[1],cm5,L5,f"FEIN 5 Klassen\naccuracy {(p5==y5).mean()*100:.0f}%  ·  balanced {balanced_accuracy_score(y5,p5)*100:.0f}%")
fig.suptitle("Wie genau? Confusion-Matrix, raeumlich kreuzvalidiert\n(Zeile = 100% je echter Epoche)",weight="bold",fontsize=13,y=0.995)
fig.text(0.5,0.01,"Diagonale = richtig. Grob: \"bis 1918\" sitzt (88%), Interwar leckt.\n"
         "Fein: \"1980-1999\"/\"ab 2000\" 0% auf Diagonale - post-1980 nicht erkennbar.",
         ha="center",fontsize=9,color="#555")
fig.tight_layout(rect=[0,0.04,1,0.96])
fig.savefig(OUT,dpi=130,facecolor="white",bbox_inches="tight"); print("gespeichert:",OUT)
