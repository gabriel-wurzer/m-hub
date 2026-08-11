"""Suite: Plausibilitaetscheck (node-red /api/plausibility -> Python-Service -> Markov).

Prueft die Kette bis ins Modell und vor allem die Vokabular-Uebersetzung: m-hub kennt
nur "Beton", der Katalog nennt die tragende Wand "STB". Ohne Uebersetzung kam die
haeufigste Nachkriegs-Aussenwand als "unplausibel" zurueck (Fehlalarm im zugesagten
Deliverable). Braucht nur den laufenden Stack, keine Testdaten.
"""
import json

from harness import NODE, http


def _check(payload):
    sc, body = http("POST", NODE + "/api/plausibility", payload)
    try:
        return sc, json.loads(body or b"{}")
    except Exception:
        return sc, {}


def run(r):
    aw = {"period": "1980-1999", "floor_type": "RG", "part_type": "AW"}

    sc, res = _check({**aw, "materials": ["STB", "Styropor", "Putz"]})
    r.check("route erreichbar + katalog-schreibweise passt (stufe 3)",
            sc == 200 and res.get("stufe") == 3, f"sc={sc} res={res}")

    sc, res = _check({**aw, "materials": ["Beton", "Styropor", "Putz"]})
    r.check("m-hub-schreibweise 'Beton' wird als STB gelesen (stufe 3)",
            sc == 200 and res.get("stufe") == 3 and res.get("gelesen_als", [None])[0] == "STB",
            f"sc={sc} res={res}")

    sc, res = _check({**aw, "materials": ["Putz", "Styropor", "Beton"]})
    r.check("umgekehrt eingegeben wird trotz uebersetzung erkannt",
            sc == 200 and res.get("stufe") == 2 and res.get("umgekehrt") is True, f"res={res}")

    sc, res = _check({"period": "bis 1918", "floor_type": "RG", "part_type": "AW",
                      "materials": ["Putz", "Ziegel", "Putz"]})
    r.check("gruenderzeit Putz+Ziegel+Putz passt (stufe 3, keine falsche umkehr-warnung)",
            sc == 200 and res.get("stufe") == 3 and res.get("umgekehrt") is False, f"res={res}")

    sc, res = _check({**aw, "materials": ["STB", "Karton", "Putz"]})
    r.check("erfundenes material -> stufe 2 unbekannt",
            sc == 200 and res.get("stufe") == 2 and "Karton" in res.get("detail", ""), f"res={res}")

    # node-red baut materials[] auch aus layers[] (so schickt es das Frontend).
    sc, res = _check({**aw, "layers": [{"layer_index": 1, "material": "Beton", "thickness": 200},
                                       {"layer_index": 2, "material": "Styropor", "thickness": 80},
                                       {"layer_index": 3, "material": "Putz", "thickness": 20}]})
    r.check("layers[] statt materials[] liefert dasselbe (stufe 3)",
            sc == 200 and res.get("stufe") == 3, f"res={res}")
