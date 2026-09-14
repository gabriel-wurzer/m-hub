"""Suite: Plausibilitaetscheck (node-red /api/plausibility -> Python-Service -> Markov).

Prueft die Kette bis ins Modell. Seit Wolfgangs Kategorie-Katalog traegt das Modell die
m-hub-Begriffe direkt (Beton statt STB), die Uebersetzung ist auf wenige Faelle
geschrumpft. Deckt ab: direkte Erkennung, Umkehr, ab-2000 (bp5-Referenz), unbekanntes
Material und nie-gesehene-Folge (Stufe 2). Braucht nur den laufenden Stack, keine Testdaten.
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

    # Beton wird jetzt direkt erkannt (Kategorie-Katalog), keine Uebersetzung mehr noetig.
    sc, res = _check({**aw, "materials": ["Beton", "Styropor", "Putz"]})
    r.check("'Beton' direkt erkannt (stufe 3, keine uebersetzung)",
            sc == 200 and res.get("stufe") == 3 and "gelesen_als" not in res, f"sc={sc} res={res}")

    sc, res = _check({**aw, "materials": ["Putz", "Styropor", "Beton"]})
    r.check("umgekehrt eingegeben wird erkannt (stufe 2)",
            sc == 200 and res.get("stufe") == 2 and res.get("umgekehrt") is True, f"res={res}")

    sc, res = _check({"period": "bis 1918", "floor_type": "RG", "part_type": "AW",
                      "materials": ["Putz", "Ziegel", "Putz"]})
    r.check("gruenderzeit Putz+Ziegel+Putz passt (stufe 3, keine falsche umkehr)",
            sc == 200 and res.get("stufe") == 3 and res.get("umgekehrt") is False, f"res={res}")

    # ab 2000 ist jetzt abgedeckt (bp5-Referenz): Stahlbeton-WDVS-Aussenwand.
    sc, res = _check({"period": "ab 2000", "floor_type": "RG", "part_type": "AW",
                      "materials": ["Putz", "Beton", "Fliesenkleber", "Styropor", "Putz"]})
    r.check("ab-2000 WDVS-wand abgedeckt (stufe 3, bp5-referenz)",
            sc == 200 and res.get("stufe") == 3, f"res={res}")

    sc, res = _check({**aw, "materials": ["Beton", "Karton", "Putz"]})
    r.check("erfundenes material -> stufe 2 unbekannt",
            sc == 200 and res.get("stufe") == 2 and "Karton" in res.get("detail", ""), f"res={res}")

    # Wolfgang 2026-08: nie gesehene Folge aus BEKANNTEN Materialien -> Stufe 2 (bestaetigen),
    # nicht mehr Stufe 1. Gruenderzeit-Aussenwand mit Innendaemmung kam in den 11 nie vor.
    sc, res = _check({"period": "bis 1918", "floor_type": "RG", "part_type": "AW",
                      "materials": ["Putz", "Mineralwolle", "Ziegel"]})
    r.check("nie gesehene folge aus bekannten materialien -> stufe 2 (nicht 1)",
            sc == 200 and res.get("stufe") == 2 and res.get("umgekehrt") is False
            and "unbekannt" not in res.get("label", "").lower(), f"res={res}")

    # node-red baut materials[] auch aus layers[] (so schickt es das Frontend).
    sc, res = _check({**aw, "layers": [{"layer_index": 1, "material": "Beton", "thickness": 200},
                                       {"layer_index": 2, "material": "Styropor", "thickness": 80},
                                       {"layer_index": 3, "material": "Putz", "thickness": 20}]})
    r.check("layers[] statt materials[] liefert dasselbe (stufe 3)",
            sc == 200 and res.get("stufe") == 3, f"res={res}")
