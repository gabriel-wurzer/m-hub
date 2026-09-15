"""
plausibility_api.py — kleiner HTTP-Service fuer den Plausibilitaetscheck.

POST /check  {period, floor_type, part_type, materials:[...] | layers:[{material,..}]}
  -> {stufe, label, detail, umgekehrt, referenz_n, gelesen_als?}
GET  /health -> {status, vocab}
GET  /vocab  -> welche m-hub-Materialien der Katalog kennt, uebersetzt oder gar nicht

Nutzt material_markov.check() (Markov + Referenzbereich + Umkehr-Erkennung). Zero-deps
(nur stdlib), damit node-red ihn per http-request-Node aufrufen kann. Der erste Baustein
der Processing-Core; spaeter ggf. FastAPI, wenn Point-Cloud-Endpoints dazukommen.

Der Service spricht AUSSEN m-hubs Materialvokabular (MaterialType, 38 Werte) und
INNEN Wolfgangs Kategorie-Katalog (32 Begriffe). Seit der Kategorie-Umstellung tragen
beide fast dieselben Begriffe (Beton, Ziegel, Mineralwolle ...), die Uebersetzung ist
darum auf wenige Faelle geschrumpft. Frueher hiess die tragende Wand im Katalog "STB",
m-hub nur "Beton" -> Fehlalarm; mit dem neuen Katalog ist das weg.

Start:  cd m-hub-processing && python plausibility_api.py   (lauscht auf 127.0.0.1:8971)
"""
import itertools
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

import material_markov as mk

# --- Mapping Frontend-Enums -> Katalog (akzeptiert Kuerzel UND deutsche Enum-Werte) ---
ORT = {"KG": "KG", "Kellergeschoss": "KG",              # FloorType -> Katalog-Ort
       "RG": "RG", "Regelgeschoss": "RG",
       "D": "DG", "Dach": "DG", "DG": "DG"}
ART = {"IW": "IW", "Innenwand": "IW",                   # PartType -> Katalog-Art
       "AW": "AW", "Außenwand": "AW",
       "BW": "AW", "Brandwand": "AW",
       "BA": "FB", "Bodenaufbau": "FB",
       "DA": "D", "Dachaufbau": "D",
       "KS": "AW", "Kniestock": "AW",
       "A": "AW", "Attika": "AW"}
BP = {"unbekannt": "unbekannt", "vor 1919": "bis 1918", "bis 1918": "bis 1918",
      "1919-1944": "1919-1944", "1945-1979": "1945-1979", "1980-1999": "1980-1999",
      "nach 2000": "ab 2000", "ab 2000": "ab 2000"}

# --- m-hub MaterialType -> Katalogbegriffe (Kandidaten, bester gewinnt) ---
# Quelle links: m-hub-frontend/src/app/enums/material-type.enum.ts (38 Werte).
# Quelle rechts: mk.VOCAB aus Wolfgangs Kategorie-Katalog. Der traegt die m-hub-Begriffe
# fast direkt, darum bleiben nur die Faelle wo m-hub anders heisst als die Kategorie.
# Nicht gelistete gehen unveraendert durch; fehlt die Kategorie (Blei, Messing, Moertel,
# Papier), meldet der Check sie ehrlich als unbekannt.
ALIAS = {
    "Linol": ("Linoleum",),
    "Mineralfaser": ("Mineralwolle",),
    "Terrazzo": ("Kunststein",),
    "Keramik": ("Fliesen", "Steinzeug"),
}

# Nur fuer den /vocab-Report: m-hubs geschlossenes Materialvokabular.
MHUB_MATERIALS = [
    "Aluminium", "Asphalt", "Beton", "Bitumen", "Blähbeton", "Blei",
    "Diverse Kunststoffe", "Eternit", "Estrich", "Fliesen", "Fliesenkleber",
    "Glas", "Heraklith", "Holz", "Kautschuk", "Keramik", "Kupfer", "Laminat",
    "Linol", "Messing", "Mineralfaser", "Mineralwolle", "Mörtel", "Naturstein",
    "Papier", "Putz", "PVC", "Rigips", "Schlacke", "Schüttung", "Stahl",
    "Steinzeug", "Stroh", "Styropor", "Teppich", "Terrazzo", "Ytong", "Ziegel",
]


def translate(materials, bp, ort, art):
    """m-hub-Materialien -> die Katalog-Lesart, die das Modell am besten kennt.

    Bewertet wird vorwaerts UND rueckwaerts (max), sonst waehlt eine verkehrt
    eingegebene Wand eine beliebige Lesart und die Umkehr-Erkennung greift nicht
    mehr. Bei Gleichstand gewinnt der erste Kandidat, also die Hauptlesart.
    """
    lattice = [ALIAS.get(m, (m,)) for m in materials]
    best, best_score = None, -1.0
    for variant in itertools.product(*lattice):
        v = list(variant)
        score = max(mk.geomean(mk._step_probs(v, bp, ort, art)),
                    mk.geomean(mk._step_probs(v[::-1], bp, ort, art)))
        if score > best_score:
            best, best_score = v, score
    return best or list(materials)


def plausibility(period, floor_type, part_type, materials):
    bp = BP.get(period, period)
    ort = ORT.get(floor_type, floor_type)
    art = ART.get(part_type, part_type)
    gelesen = translate(list(materials), bp, ort, art)
    r = mk.check(gelesen, bp, ort, art)
    out = {
        "stufe": r["tier"],
        "label": r["label"],
        "detail": r["detail"],
        "umgekehrt": r["label"].startswith("vermutlich UMGEKEHRT"),
        "referenz_n": r["n_ref"],
    }
    if gelesen != list(materials):
        out["gelesen_als"] = gelesen
    return out


def vocab_report():
    """Welche m-hub-Materialien der Katalog direkt kennt, uebersetzt kennt, gar nicht."""
    direkt, uebersetzt, ohne = [], {}, []
    for m in MHUB_MATERIALS:
        treffer = [c for c in ALIAS.get(m, (m,)) if c in mk.VOCAB]
        if m in mk.VOCAB and m not in ALIAS:
            direkt.append(m)
        elif treffer:
            uebersetzt[m] = treffer
        else:
            ohne.append(m)
    return {"mhub": len(MHUB_MATERIALS), "katalog": len(mk.VOCAB),
            "direkt": direkt, "uebersetzt": uebersetzt, "ohne_entsprechung": ohne}


# --- Aufbauten-Katalog: typische Schichtfolgen je (Bauperiode, Ort, Art) ---------
# Das "errechnete Buch": pro Zelle die gemessenen typischen Aufbauten mit Anteil.
CAT_PERIOD_ORDER = ["bis 1918", "1919-1944", "1945-1979", "1980-1999", "ab 2000", "unbekannt"]
CAT_ORT_ORDER = ["KG", "RG", "DG"]
CAT_ART_ORDER = ["AW", "IW", "FB", "D"]
CAT_ORT_LABEL = {"KG": "Keller", "RG": "Regelgeschoss", "DG": "Dachgeschoss"}
CAT_ART_LABEL = {"AW": "Außenwand", "IW": "Innenwand", "FB": "Boden", "D": "Dach"}


def _cat_idx(order, v):
    return order.index(v) if v in order else len(order)


def _cat_grid():
    """Sinnvolle (Bauperiode, Ort, Art)-Zellen: KG/RG/DG mit AW/IW/FB, Dach nur DG."""
    for bp in CAT_PERIOD_ORDER:
        if bp == "unbekannt":
            continue  # keine Vorhersage ohne Periode
        for ort in CAT_ORT_ORDER:
            for art in ["AW", "IW", "FB"] + (["D"] if ort == "DG" else []):
                yield bp, ort, art


def catalog(k=3):
    """VOLLSTAENDIGER Aufbauten-Katalog: jede sinnvolle (Bauperiode, Ort, Art)-Zelle
    bekommt typische Aufbauten. Wo gemessen -> observed_top (quelle 'gemessen'),
    sonst fuellt das Markov-Modell per Backoff (quelle 'modell'). Das errechnete
    'Buch', das es als Referenz nirgends gibt. Basis fuer alle drei Ebenen (ganz
    Wien / eigener Bestand / einzelnes Gebaeude, gefiltert nach Bauperiode)."""
    # Vereinigung: das sinnvolle Grid PLUS jede tatsaechlich gemessene Zelle
    # (damit keine Messung verloren geht, z.B. seltene Ort/Art-Kombis).
    combos = set(_cat_grid())
    measured = mk.df.groupby(["bauperiode", "ort", "art"]).size().reset_index(name="n")
    for _, r in measured.iterrows():
        combos.add((r.bauperiode, r.ort, r.art))
    ordered = sorted(combos, key=lambda t: (_cat_idx(CAT_PERIOD_ORDER, t[0]),
                                            _cat_idx(CAT_ORT_ORDER, t[1]),
                                            _cat_idx(CAT_ART_ORDER, t[2])))
    cells = []
    for bp, ort, art in ordered:
        tops = mk.observed_top(bp, ort, art, k)
        if tops:
            quelle = "gemessen"
        else:
            tops = mk.predict(bp, ort, art, k)   # Modell fuellt die Luecke (Backoff)
            quelle = "modell"
        if not tops:
            continue
        n_mess = int(len(mk.df[(mk.df.bauperiode == bp) & (mk.df.ort == ort) & (mk.df.art == art)]))
        cells.append({
            "bauperiode": bp, "ort": ort, "art": art,
            "ort_label": CAT_ORT_LABEL.get(ort, ort),
            "art_label": CAT_ART_LABEL.get(art, art),
            "quelle": quelle,
            "n": n_mess,
            "aufbauten": [{"folge": mats, "anteil": round(float(share), 4)}
                          for mats, share in tops],
        })
    # _cat_grid liefert schon sortiert (Periode->Ort->Art)
    return {"cells": cells, "period_order": CAT_PERIOD_ORDER,
            "ort_order": CAT_ORT_ORDER, "art_order": CAT_ART_ORDER}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path.rstrip("/") != "/check":
            self._send(404, {"error": "not found"})
            return
        try:
            n = int(self.headers.get("Content-Length", 0) or 0)
            data = json.loads(self.rfile.read(n) or b"{}")
            mats = data.get("materials")
            if not mats:
                mats = [l.get("material") for l in data.get("layers", []) if l.get("material")]
            self._send(200, plausibility(data.get("period", ""), data.get("floor_type", ""),
                                         data.get("part_type", ""), mats))
        except Exception as e:
            self._send(400, {"error": str(e)})

    def do_GET(self):
        p = self.path.rstrip("/")
        if p == "/health":
            self._send(200, {"status": "ok", "vocab": len(mk.VOCAB)})
            return
        if p == "/vocab":
            self._send(200, vocab_report())
            return
        if p == "/catalog":
            self._send(200, catalog())
            return
        self._send(404, {"error": "not found"})

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    HOST = os.environ.get("PLAUSIBILITY_HOST", "127.0.0.1")   # Container setzt 0.0.0.0
    PORT = int(os.environ.get("PLAUSIBILITY_PORT", "8971"))
    v = vocab_report()
    print(f"plausibility-service on {HOST}:{PORT}  (POST /check, GET /health, GET /vocab)")
    print(f"  Vokabular: {len(v['direkt'])} von {v['mhub']} m-hub-Materialien direkt im Katalog, "
          f"{len(v['uebersetzt'])} uebersetzt, {len(v['ohne_entsprechung'])} ohne Entsprechung")
    if v["ohne_entsprechung"]:
        print("  ohne Entsprechung: " + ", ".join(v["ohne_entsprechung"]))
    HTTPServer((HOST, PORT), Handler).serve_forever()
