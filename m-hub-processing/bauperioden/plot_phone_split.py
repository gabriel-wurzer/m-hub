"""Handy-tauglich: jedes Panel als EIGENES Bild, max ~1500px (unter dem 2048-Mobile-Limit)."""
import numpy as np, pandas as pd, geopandas as gpd
from pyogrio import read_dataframe
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
from matplotlib.patches import Patch
D="./out/"

g=read_dataframe("../../data/mhub_wien.gpkg",layer="buildings_details",columns=[],fid_as_index=True).reset_index()
g.columns=["fid","geometry"]
g=gpd.GeoDataFrame(g,geometry="geometry",crs=4326)
pred=pd.read_csv("./work/bp_hier_prediction.csv"); g=g.merge(pred,on="fid",how="inner"); n=len(g)
NAMES={1:"bis 1918",2:"1919-1944",3:"1945-1979",4:"1980-1999",5:"ab 2000"}
COL5={1:"#6a0f0f",2:"#d95f0e",3:"#2c7fb8",4:"#41ab5d",5:"#810f7c"}
COL3={"bis 1918":"#8B0000","1919-1945":"#E67E22","nach 1945":"#2980B9"}
g["c5"]=g["bp5_final"].map(COL5); g["c3"]=g["coarse3"].map(COL3)
d5={k:int((g["bp5_final"]==k).sum()) for k in range(1,6)}; d3={k:int((g["coarse3"]==k).sum()) for k in COL3}
asp=1/np.cos(np.radians(48.21)); de=lambda v:f"{v:,}".replace(",",".")

def save(name,plotfn,title,legend=None,cbar=False):
    fig,ax=plt.subplots(figsize=(9.5,9),dpi=150); fig.patch.set_facecolor("white")
    plotfn(ax); ax.set_aspect(asp); ax.set_axis_off(); ax.set_title(title,weight="bold",fontsize=15,pad=8)
    if legend: ax.legend(handles=legend,loc="lower left",fontsize=11,framealpha=0.92)
    if cbar:
        sm=plt.cm.ScalarMappable(cmap="viridis",norm=plt.Normalize(0.3,1.0)); sm.set_array([])
        fig.colorbar(sm,ax=ax,shrink=0.55,pad=0.01).set_label("Konfidenz",fontsize=11)
    fig.tight_layout(); fig.savefig(D+name,facecolor="white",bbox_inches="tight")
    from PIL import Image; print(name,Image.open(D+name).size); plt.close(fig)

save("ph_fein.png",lambda a:g.plot(ax=a,color=g["c5"].values,linewidth=0,antialiased=False),
     f"Wien Bauperiode fein (5 Kl., {de(n)})",
     [Patch(fc=COL5[k],label=f"{NAMES[k]} ({de(d5[k])})") for k in range(1,6)])
save("ph_grob.png",lambda a:g.plot(ax=a,color=g["c3"].values,linewidth=0,antialiased=False),
     "Wien Bauperiode grob (3 Kl., belastbar)",
     [Patch(fc=COL3[k],label=f"{k} ({de(d3[k])})") for k in COL3])
save("ph_konf.png",lambda a:g.plot(ax=a,column="conf",cmap="viridis",vmin=0.3,vmax=1.0,linewidth=0,antialiased=False),
     "Konfidenz (hell=sicher, dunkel=geraten)",cbar=True)
