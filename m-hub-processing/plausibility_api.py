"""
plausibility_api.py — kleiner HTTP-Service fuer den Plausibilitaetscheck.

POST /check  {period, floor_type, part_type, materials:[...] | layers:[{material,..}]}
  -> {stufe, label, detail, umgekehrt, referenz_n}
GET  /health -> {status, vocab}

Nutzt material_markov.check() (Markov + Referenzbereich + Umkehr-Erkennung). Zero-deps
(nur stdlib), damit node-red ihn per http-request-Node aufrufen kann. Der erste Baustein
der Processing-Core; spaeter ggf. FastAPI, wenn Point-Cloud-Endpoints dazukommen.

Start:  cd m-hub-processing && python plausibility_api.py   (lauscht auf 127.0.0.1:8971)
"""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

import material_markov as mk

# --- Mapping Frontend-Enums -> Katalog --------------------------------------
ORT = {"KG": "KG", "RG": "RG", "D": "DG", "DG": "DG"}                      # FloorType -> Katalog-Ort
ART = {"IW": "IW", "AW": "AW", "BW": "AW", "BA": "FB", "DA": "D",          # PartType -> Katalog-Art
       "KS": "AW", "A": "AW"}
BP = {"unbekannt": "unbekannt", "vor 1919": "bis 1918", "bis 1918": "bis 1918",
      "1919-1944": "1919-1944", "1945-1979": "1945-1979", "1980-1999": "1980-1999",
      "nach 2000": "ab 2000", "ab 2000": "ab 2000"}


def plausibility(period, floor_type, part_type, materials):
    bp = BP.get(period, period)
    ort = ORT.get(floor_type, floor_type)
    art = ART.get(part_type, part_type)
    r = mk.check(materials, bp, ort, art)
    return {
        "stufe": r["tier"],
        "label": r["label"],
        "detail": r["detail"],
        "umgekehrt": r["label"].startswith("vermutlich UMGEKEHRT"),
        "referenz_n": r["n_ref"],
    }


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
        if self.path.rstrip("/") == "/health":
            self._send(200, {"status": "ok", "vocab": len(mk.VOCAB)})
            return
        self._send(404, {"error": "not found"})

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    PORT = 8971
    print(f"plausibility-service on 127.0.0.1:{PORT}  (POST /check, GET /health)")
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
