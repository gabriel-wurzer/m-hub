# -*- coding: utf-8 -*-
"""Baut eine mobile-first HTML-Seite mit eingebetteten Karten (data URIs)."""
import base64, os
D="./out/"
def uri(fn):
    b=base64.b64encode(open(D+fn,"rb").read()).decode()
    print(fn,round(os.path.getsize(D+fn)/1024),"KB"); return "data:image/png;base64,"+b
FEIN,GROB,KONF,ACC=uri("ph_fein.png"),uri("ph_grob.png"),uri("ph_konf.png"),uri("ph_acc.png")

dist=[("bis 1918","63.045","38","#6a0f0f"),("1919-1944","41.335","25","#d95f0e"),
      ("1945-1979","59.159","36","#2c7fb8"),("1980-1999","721","0,4","#41ab5d"),
      ("ab 2000","8","~0","#810f7c")]
rows="".join(f'''<div class="drow">
  <div class="dlab">{n}</div>
  <div class="dbarwrap"><div class="dbar" style="width:{max(float(p.replace('~0','0.2').replace(',','.')),0.6)}%;background:{c}"></div></div>
  <div class="dval"><b>{cnt}</b><span>{p}%</span></div>
</div>''' for n,cnt,p,c in dist)

maps=[("Bauperiode fein — 5 Klassen",FEIN,"Gruenderzeit-Kern rot, Nachkrieg-Peripherie blau"),
      ("Bauperiode grob — 3 Klassen",GROB,"Die belastbare Ebene: bis 1918 / 1919-45 / nach 1945"),
      ("Konfidenz / Herkunft",KONF,"Hell = echtes Wissen (Zentrum), dunkel = geraten (Raender)"),
      ("Genauigkeit — Confusion-Matrix",ACC,"Raeumlich kreuzvalidiert, Zeile = 100% je echter Epoche")]
mapcards="".join(f'''<figure class="map">
  <figcaption><b>{t}</b><span>{cap}</span></figcaption>
  <img src="{u}" alt="{t}" loading="lazy">
  <div class="tap">antippen zum Zoomen</div>
</figure>''' for t,u,cap in maps)

HTML=f'''<style>
:root{{--bg:#faf9f7;--surface:#fff;--text:#1c1a17;--muted:#6b6560;--border:#e7e3dc;--accent:#2c6b9c;--good:#2c7a4b;--warn:#b4531a;}}
@media(prefers-color-scheme:dark){{:root{{--bg:#15171b;--surface:#1e2127;--text:#f0ede7;--muted:#9c968d;--border:#2f343d;--accent:#5aa6d8;--good:#57b982;--warn:#e2864a;}}}}
:root[data-theme=light]{{--bg:#faf9f7;--surface:#fff;--text:#1c1a17;--muted:#6b6560;--border:#e7e3dc;--accent:#2c6b9c;--good:#2c7a4b;--warn:#b4531a;}}
:root[data-theme=dark]{{--bg:#15171b;--surface:#1e2127;--text:#f0ede7;--muted:#9c968d;--border:#2f343d;--accent:#5aa6d8;--good:#57b982;--warn:#e2864a;}}
*{{box-sizing:border-box}}
.wrap{{max-width:640px;margin:0 auto;padding:20px 16px 64px;color:var(--text);background:var(--bg);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.5;
  font-variant-numeric:tabular-nums;-webkit-text-size-adjust:100%;}}
.eyebrow{{font-size:.72rem;letter-spacing:.09em;text-transform:uppercase;color:var(--accent);font-weight:700;margin:0 0 6px}}
h1{{font-size:1.7rem;line-height:1.15;margin:0 0 4px;text-wrap:balance}}
.sub{{color:var(--muted);margin:0 0 26px;font-size:1rem}}
.card{{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px 16px;margin:0 0 18px}}
h2{{font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:0 0 14px;font-weight:700}}
.drow{{display:grid;grid-template-columns:88px 1fr 78px;align-items:center;gap:10px;margin:9px 0}}
.dlab{{font-size:.92rem;font-weight:600}}
.dbarwrap{{background:color-mix(in srgb,var(--border) 60%,transparent);border-radius:5px;height:20px;overflow:hidden}}
.dbar{{height:100%;border-radius:5px;min-width:3px}}
.dval{{text-align:right;font-size:.82rem}}.dval b{{font-size:.98rem}}.dval span{{color:var(--muted);margin-left:5px}}
.acc{{display:grid;grid-template-columns:1fr 1fr;gap:12px}}
.stat{{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px}}
.stat .n{{font-size:2rem;font-weight:800;line-height:1}}
.stat .n.g{{color:var(--good)}}.stat .n.w{{color:var(--warn)}}
.stat .k{{color:var(--muted);font-size:.82rem;margin-top:6px}}
.note{{font-size:.9rem;color:var(--muted);margin:14px 0 0}}
.note b{{color:var(--text)}}
.map{{margin:0 0 20px;background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden}}
.map figcaption{{padding:13px 15px 11px;display:flex;flex-direction:column;gap:2px}}
.map figcaption b{{font-size:1.02rem}}.map figcaption span{{color:var(--muted);font-size:.85rem}}
.map img{{display:block;width:100%;height:auto;cursor:zoom-in;border-top:1px solid var(--border)}}
.tap{{padding:8px 15px;font-size:.76rem;color:var(--accent);font-weight:600;text-align:center}}
#lb{{display:none;position:fixed;inset:0;background:rgba(8,8,10,.94);z-index:99;overflow:auto;
  align-items:flex-start;justify-content:flex-start;padding:0}}
#lb img{{width:auto;max-width:none;display:block}}
#lb .x{{position:fixed;top:12px;right:14px;background:#fff;color:#111;border-radius:20px;
  padding:7px 15px;font-weight:700;font-size:.9rem;z-index:100;box-shadow:0 2px 10px rgba(0,0,0,.4)}}
.foot{{color:var(--muted);font-size:.8rem;margin-top:30px;border-top:1px solid var(--border);padding-top:16px}}
</style>

<div class="wrap">
  <p class="eyebrow">m-hub · Rollout</p>
  <h1>Wien — Bauperioden citywide</h1>
  <p class="sub">164.268 Gebaeude, ML-Vorhersage aus Footprint-Morphologie. Tabelle <code>building_period_prediction</code> steht in Prod.</p>

  <div class="card">
    <h2>Verteilung</h2>
    {rows}
    <p class="note">Rote Gruenderzeit-Masse innen, blaue Nachkriegs-Peripherie aussen — die erwartete Wiener Struktur. <b>Nach 1980 stark untergezaehlt</b> (kaum Trainingsdaten).</p>
  </div>

  <div class="card">
    <h2>So genau ist es (ehrlich, kreuzvalidiert)</h2>
    <div class="acc">
      <div class="stat"><div class="n g">72%</div><div class="k">grobe 3 Klassen (bal. 55%)</div></div>
      <div class="stat"><div class="n g">88%</div><div class="k">„bis 1918" erkannt</div></div>
      <div class="stat"><div class="n">25%</div><div class="k">echtes Label statt Vorhersage</div></div>
      <div class="stat"><div class="n w">0%</div><div class="k">nach 1980 erkannt — kann es nicht</div></div>
    </div>
    <p class="note">Was traegt: <b>alt vs. Nachkrieg</b>. Was nicht: die feine Moderne. Und: Zentrum = echtes Wissen, Raender = geraten.</p>
  </div>

  <h2 style="margin:26px 4px 14px">Die Karten</h2>
  {mapcards}

  <p class="foot">Ehrliche Grenze: post-1980 label-gehungert (nur 161 Trainingslabels), landet fast alles in 1945-79 — dort nur die Grobklasse „nach 1945" belastbar. Historische Luftbilder brachten nichts.</p>
</div>

<div id="lb"><div class="x">schliessen ✕</div><img alt="zoom"></div>
<script>
(function(){{
  var lb=document.getElementById('lb'),im=lb.querySelector('img');
  document.querySelectorAll('.map img').forEach(function(el){{
    el.addEventListener('click',function(){{im.src=el.src;lb.style.display='block';document.body.style.overflow='hidden';}});
  }});
  lb.addEventListener('click',function(){{lb.style.display='none';im.removeAttribute('src');document.body.style.overflow='';}});
}})();
</script>'''

open(D+"bp_stadt.html","w",encoding="utf-8").write(HTML)
print("html:",round(os.path.getsize(D+"bp_stadt.html")/1024),"KB")
