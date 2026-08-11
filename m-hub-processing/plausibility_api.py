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
INNEN Wolfgangs Katalogvokabular (58 Begriffe). Ohne Uebersetzung ueberschneiden
sich die beiden nur in 14 Begriffen, und der Check schlaegt bei voellig normalen
Eingaben Fehlalarm (m-hub kennt nur "Beton", der Katalog nennt die tragende
Stahlbetonwand "STB" -> Beton/Styropor/Putz kam als "unplausibel" zurueck).

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
# Quelle rechts: mk.VOCAB aus Wolfgangs Katalog. Ein m-hub-Begriff ist teils
# groeber als der Katalog (m-hub "Beton" = Katalog "STB" ODER "Beton"), deshalb
# Kandidatenlisten und nicht 1:1. Nicht gelistete Materialien gehen unveraendert
# durch: stehen sie im Katalog, passt es; sonst meldet der Check sie ehrlich als
# unbekannt (Estrichbelaege wie Teppich/Laminat/PVC kommen im Katalog schlicht
# nicht vor).
ALIAS = {
    "Beton": ("STB", "Beton", "Betonfertigteil"),
    "Blähbeton": ("Leichtbeton",),
    "Ytong": ("Leichtbeton",),          # Porenbeton; naechster Katalogbegriff
    "Mineralwolle": ("Dämmung-weich",),
    "Mineralfaser": ("Dämmung-weich",),
    "Styropor": ("Styropor", "Dämmung-hart"),
    "Rigips": ("Gips", "Rigipswand"),
    "Naturstein": ("Stein",),
    "Eternit": ("Faserzement",),        # Eternit IST Faserzement
    "Fliesen": ("Keramik",),
    "Steinzeug": ("Keramik",),
    "Bitumen": ("Bitumen", "Abdichtung"),
    "Asphalt": ("Abdichtung",),
    "Heraklith": ("Heraklith", "Heraklith/Holz"),
    "Stahl": ("Stahl", "Stahlträger", "Metall"),
    "Aluminium": ("Aluminium", "Metall"),
    "Kupfer": ("Metall",),
    "Messing": ("Metall",),
    "Blei": ("Metall",),
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
