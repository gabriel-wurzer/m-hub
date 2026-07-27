"""
material_thickness.py — Stufe 2 des Materialschritts: Schichtdicken.

Stufe 1 (material_markov.py) sagt die Material*folge* vorher. Hier kommen die
*Dicken*. Kernbefund aus den Daten: derselbe Aufbau tritt bei verschiedener
Gesamtwandstärke auf (Gips+Dämmung+Gips bei 0.155 UND 0.425 m). Die Folge fixiert
die Dicke also nicht, die Gesamtstärke T ist ein unabhängiger Input, der die
Schichten streckt. Beim Apply-Stage ist T bekannt (parametrisches Modell / User).

Drei Modelle, verglichen auf dem Katalog (T = Summe der beobachteten Schichten):
  A  Mittel je Material (Backoff), unconstrained  -> Summe trifft T nicht
  B  A, proportional auf T skaliert               -> nutzt T, aber dünne Fixschichten wachsen mit
  C  fixe Schichten (niedrige CV) fix, variable Schicht absorbiert den Rest
"""
import statistics
from collections import defaultdict

import pandas as pd

SRC = "../data/useCasesAufbauten.xlsx"


def parse_layers(mat):
    """'(Putz, 0.01; Ziegel, 0.245; Putz, 0.015)' -> [('Putz',0.01),('Ziegel',0.245),('Putz',0.015)]"""
    out = []
    for lay in str(mat).strip().strip("()").split(";"):
        parts = [p.strip() for p in lay.split(",")]
        if not parts or not parts[0]:
            continue
        thick = None
        for p in parts[1:]:
            try:
                thick = float(p.replace(",", "."))
                break
            except ValueError:
                pass
        if thick is not None:
            out.append((parts[0], thick))
    return out


df = pd.read_excel(SRC, sheet_name="Ergebnis")
df.columns = ["bauperiode", "ort", "art", "mat", "nettoflaeche",
              "anteil", "pct_po", "stk", "staerke"]
df = df.dropna(subset=["mat"]).copy()
df["layers"] = df["mat"].map(parse_layers)
df["w"] = df["nettoflaeche"].fillna(0).clip(lower=0) + 0.01


def levels(bp, ort, art):
    return [(bp, ort, art), (ort, art), (art,), ()]


# weighted thickness observations per (level, material)
obs = defaultdict(lambda: defaultdict(list))   # obs[level][material] = [(thick, weight), ...]
for _, r in df.iterrows():
    for name, t in r["layers"]:
        for lvl in levels(r.bauperiode, r.ort, r.art):
            obs[lvl][name].append((t, r.w))

# sequence-keyed observations fuer das Abfolge-Modell D (mit Zeilen-ID fuer Leave-one-out)
seq_obs = defaultdict(lambda: defaultdict(list))   # seq_obs[(level, seq)][position] = [(thick, weight, row_id)]
for idx, r in df.iterrows():
    seq = tuple(m for m, _ in r["layers"])
    for lvl in levels(r.bauperiode, r.ort, r.art):
        for i, (m, t) in enumerate(r["layers"]):
            seq_obs[(lvl, seq)][i].append((t, r.w, idx))


def mean_thick(material, bp, ort, art, min_n=2):
    """Gewichtete mittlere Dicke des Materials, spezifisch -> global (Backoff)."""
    for lvl in levels(bp, ort, art):
        lst = obs[lvl].get(material)
        if lst and len(lst) >= min_n:
            return sum(t * w for t, w in lst) / sum(w for _, w in lst)
    lst = obs[()].get(material, [])
    return (sum(t * w for t, w in lst) / sum(w for _, w in lst)) if lst else 0.0


# per-material MEDIAN-Dicke -> duenne Deckschicht (fix) vs dicke Trag-/Daemmschicht (variabel)
_allt = defaultdict(list)
for _, r in df.iterrows():
    for name, t in r["layers"]:
        _allt[name].append(t)
MED = {name: statistics.median(ts) for name, ts in _allt.items()}
FIXED_MAX = 0.03   # Median < 3cm => fixe Deckschicht (Putz, Gips, Abdichtung, Fliesen...)


def predict_A(seq, bp, ort, art):
    return [mean_thick(m, bp, ort, art) for m in seq]


def predict_B(seq, bp, ort, art, T):
    base = predict_A(seq, bp, ort, art)
    s = sum(base)
    return [b * T / s for b in base] if s > 0 else base


def predict_C(seq, bp, ort, art, T):
    base = predict_A(seq, bp, ort, art)
    is_fixed = [MED.get(m, 1.0) < FIXED_MAX for m in seq]
    fixed_sum = sum(b for b, f in zip(base, is_fixed) if f)
    var_sum = sum(b for b, f in zip(base, is_fixed) if not f)
    residual = T - fixed_sum
    out = []
    for b, f in zip(base, is_fixed):
        if f:
            out.append(b)
        elif var_sum > 0:
            out.append(max(0.0, residual * b / var_sum))
        else:
            out.append(b)
    return out


def seq_base(seq, i, bp, ort, art, exclude_id=None, min_n=2):
    """Mittlere Dicke der i-ten Schicht unter Aufbauten MIT DERSELBEN FOLGE (Backoff)."""
    key = tuple(seq)
    for lvl in levels(bp, ort, art):
        lst = [(t, w) for (t, w, rid) in seq_obs[(lvl, key)].get(i, []) if rid != exclude_id]
        if len(lst) >= min_n:
            return sum(t * w for t, w in lst) / sum(w for _, w in lst)
    return None


def predict_D(seq, bp, ort, art, T, exclude_id=None):
    """Abfolge-Modell: Basis-Dicken aus derselben Materialfolge (sonst Einzelmaterial), dann Allokation auf T wie C."""
    base = []
    for i, m in enumerate(seq):
        b = seq_base(seq, i, bp, ort, art, exclude_id)
        base.append(b if b is not None else mean_thick(m, bp, ort, art))
    is_fixed = [MED.get(m, 1.0) < FIXED_MAX for m in seq]
    fixed_sum = sum(b for b, f in zip(base, is_fixed) if f)
    var_sum = sum(b for b, f in zip(base, is_fixed) if not f)
    residual = T - fixed_sum
    out = []
    for b, f in zip(base, is_fixed):
        if f:
            out.append(b)
        elif var_sum > 0:
            out.append(max(0.0, residual * b / var_sum))
        else:
            out.append(b)
    return out


def _mae(pred, obs_layers):
    return sum(abs(p - o) for p, (_, o) in zip(pred, obs_layers)) / len(obs_layers)


if __name__ == "__main__":
    # Demo: der Streck-Fall
    print("=" * 70)
    print("DEMO: Gips + Daemmung-weich + Gips, Gesamtstaerke T = 0.425 m")
    seq = ["Gips", "Dämmung-weich", "Gips"]
    for name, fn in [("A", lambda: predict_A(seq, "1980-1999", "RG", "AW")),
                     ("B", lambda: predict_B(seq, "1980-1999", "RG", "AW", 0.425)),
                     ("C", lambda: predict_C(seq, "1980-1999", "RG", "AW", 0.425)),
                     ("D", lambda: predict_D(seq, "1980-1999", "RG", "AW", 0.425))]:
        p = fn()
        print(f"  {name}: " + "  ".join(f"{m}={t*1000:.0f}mm" for m, t in zip(seq, p))
              + f"   (Summe {sum(p)*1000:.0f}mm)")

    # Auswertung ueber den Katalog: Fehler je Schicht, gesamt und nur duenne Schichten
    err = {k: [] for k in ("A", "B", "C", "D")}   # (abs_fehler, ist_duenn)
    n_auf = 0
    for idx, r in df.iterrows():
        layers = r["layers"]
        if not layers:
            continue
        T = sum(t for _, t in layers)
        if T <= 0:
            continue
        n_auf += 1
        seq = [m for m, _ in layers]
        preds = {"A": predict_A(seq, r.bauperiode, r.ort, r.art),
                 "B": predict_B(seq, r.bauperiode, r.ort, r.art, T),
                 "C": predict_C(seq, r.bauperiode, r.ort, r.art, T),
                 "D": predict_D(seq, r.bauperiode, r.ort, r.art, T, exclude_id=idx)}
        for k, p in preds.items():
            for pi, (_, oi) in zip(p, layers):
                err[k].append((abs(pi - oi), oi < FIXED_MAX))

    def mm(vals):
        return 1000 * sum(vals) / len(vals) if vals else 0.0

    print("\n" + "=" * 70)
    print(f"Schichtdicken-Fehler ueber {n_auf} Aufbauten (MAE, kleiner = besser):")
    for k in ("A", "B", "C", "D"):
        alle = [e for e, _ in err[k]]
        duenn = [e for e, thin in err[k] if thin]
        label = {"A": "A  Mittel (unconstrained)",
                 "B": "B  auf T skaliert (2-stufig)",
                 "C": "C  fixe Deckschichten fix",
                 "D": "D  Abfolge (LOO) + C-Allok."}[k]
        print(f"  {label:30s}  gesamt {mm(alle):6.1f} mm   duenne(<30mm) {mm(duenn):6.1f} mm")

    print("\nals FIX (Deckschicht) eingestuft, Median < %.0fmm:" % (FIXED_MAX * 1000))
    print("  " + ", ".join(sorted(m for m, md in MED.items() if md < FIXED_MAX)))
