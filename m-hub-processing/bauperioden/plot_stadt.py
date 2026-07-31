"""Stadt-Bild wie bpxxx, aber Rollout: alle 164k echten Footprints, dreiteilig.
1) Bauperiode fein (5 Klassen)  2) grob (3 Klassen, belastbar)  3) Konfidenz/Herkunft."""
import numpy as np, pandas as pd, geopandas as gpd
from pyogrio import read_dataframe
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
from matplotlib.patches import Patch
OUT="./out/bp_stadt_phone.png"

g=read_dataframe("../../data/mhub_wien.gpkg",layer="buildings_details",columns=[],fid_as_index=True).reset_index()
g.columns=["fid","geometry"] if list(g.columns)[:1]!=["fid"] else g.columns
g=gpd.GeoDataFrame(g,geometry="geometry",crs=4326)
pred=pd.read_csv("./work/bp_hier_prediction.csv")
g=g.merge(pred,on="fid",how="inner")
n=len(g); print("footprints:",n)

NAMES={1:"bis 1918",2:"1919-1944",3:"1945-1979",4:"1980-1999",5:"ab 2000"}
COL5={1:"#6a0f0f",2:"#d95f0e",3:"#2c7fb8",4:"#41ab5d",5:"#810f7c"}
COL3={"bis 1918":"#8B0000","1919-1945":"#E67E22","nach 1945":"#2980B9"}
g["c5"]=g["bp5_final"].map(COL5); g["c3"]=g["coarse3"].map(COL3)
d5={k:int((g["bp5_final"]==k).sum()) for k in range(1,6)}
d3={k:int((g["coarse3"]==k).sum()) for k in COL3}
asp=1/np.cos(np.radians(48.21))
def de(v): return f"{v:,}".replace(",",".")

fig,ax=plt.subplots(3,1,figsize=(11,26)); fig.patch.set_facecolor("white")
g.plot(ax=ax[0],color=g["c5"].values,linewidth=0,antialiased=False)
g.plot(ax=ax[1],color=g["c3"].values,linewidth=0,antialiased=False)
g.plot(ax=ax[2],column="conf",cmap="viridis",vmin=0.3,vmax=1.0,linewidth=0,antialiased=False)
for a in ax: a.set_aspect(asp); a.set_axis_off()

ax[0].set_title("Bauperiode fein (5 Klassen)",weight="bold",fontsize=14,pad=6)
ax[0].legend(handles=[Patch(fc=COL5[k],ec="none",label=f"{NAMES[k]}  ({de(d5[k])})") for k in range(1,6)],
             loc="lower left",fontsize=10,framealpha=0.92,title="Epoche (Anzahl)")
ax[1].set_title("Bauperiode grob (3 Klassen, belastbar)",weight="bold",fontsize=14,pad=6)
ax[1].legend(handles=[Patch(fc=COL3[k],ec="none",label=f"{k}  ({de(d3[k])})") for k in COL3],
             loc="lower left",fontsize=10,framealpha=0.92,title="Grobklasse (Anzahl)")
nk=int(g["source"].isin(["known_bp","known_coarse"]).sum())
ax[2].set_title(f"Konfidenz / Herkunft\nhell = sicher (echtes Label {100*nk/n:.0f}%), dunkel = geraten",weight="bold",fontsize=14,pad=6)
sm=plt.cm.ScalarMappable(cmap="viridis",norm=plt.Normalize(0.3,1.0)); sm.set_array([])
cb=fig.colorbar(sm,ax=ax[2],shrink=0.5,pad=0.01); cb.set_label("Konfidenz",fontsize=10)

fig.suptitle(f"Wien - Bauperioden citywide ({de(n)} Gebaeude)\nGruenderzeit-Kern rot, Nachkrieg-Peripherie blau",
             weight="bold",fontsize=17,y=0.995)
fig.tight_layout(rect=[0,0,1,0.97])
fig.savefig(OUT,dpi=140,facecolor="white",bbox_inches="tight"); print("gespeichert:",OUT)
