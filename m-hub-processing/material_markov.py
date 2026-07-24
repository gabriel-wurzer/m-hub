"""
material_markov.py — self-trained SECOND-ORDER sequence (Markov) baseline.

Gabriel's idea: the build-up is an ORDERED sequence, model "given the previous
materials, what comes next". Second order: P(next | prev2, prev1), weighted by how
common each build-up is (Nettofläche), per (Bauperiode, Ort, Art). Predict by beam
search. Backoff: 2nd-order from the most specific context down to global, then fall
to 1st-order.

Second order fixes the first-order early-termination: from "(<S>, Putz)" it knows
Ziegel follows (not END), because it sees the two-material context, whereas
first-order only saw "Putz" and could take the rare Putz→END.

No API, no hallucination, self-hosted, fit for production. Empty cells (bp5) and
the rare tail are the gap an offline LLM (fable) fills during development.
"""
import math
from collections import defaultdict

import pandas as pd

SRC = "../data/useCasesAufbauten.xlsx"
S, E = "<S>", "<E>"


def parse_materials(mat):
    """'(Putz, 0.015; Ziegel, 0.16; Putz, 0.025)' -> ['Putz', 'Ziegel', 'Putz']"""
    s = str(mat).strip().strip("()")
    return [lay.split(",")[0].strip() for lay in s.split(";") if lay.split(",")[0].strip()]


df = pd.read_excel(SRC, sheet_name="Ergebnis")
df.columns = ["bauperiode", "ort", "art", "mat", "nettoflaeche",
              "anteil", "pct_po", "stk", "staerke"]
df = df.dropna(subset=["mat"]).copy()
df["seq"] = df["mat"].map(parse_materials)
df["w"] = df["nettoflaeche"].fillna(0).clip(lower=0) + 0.01


def levels(bp, ort, art):
    return [(bp, ort, art), (ort, art), (art,), ()]


# weighted transition counts, 2nd- and 1st-order, at every backoff level
t2 = defaultdict(lambda: defaultdict(float))   # t2[lvl][(p2, p1, nxt)] += w
t1 = defaultdict(lambda: defaultdict(float))   # t1[lvl][(p1, nxt)] += w
for _, r in df.iterrows():
    s2 = [S, S] + r["seq"] + [E]
    s1 = [S] + r["seq"] + [E]
    for lvl in levels(r.bauperiode, r.ort, r.art):
        for a, b, c in zip(s2, s2[1:], s2[2:]):
            t2[lvl][(a, b, c)] += r.w
        for a, b in zip(s1, s1[1:]):
            t1[lvl][(a, b)] += r.w


def next_dist(p2, p1, bp, ort, art, min_mass=0.5):
    """P(next | p2, p1): 2nd-order (specific→global), then 1st-order backoff."""
    for lvl in levels(bp, ort, art):
        d = {c: w for (a, b, c), w in t2[lvl].items() if a == p2 and b == p1}
        if d and sum(d.values()) >= min_mass:
            tot = sum(d.values())
            return {c: w / tot for c, w in d.items()}
    for lvl in levels(bp, ort, art):
        d = {b: w for (a, b), w in t1[lvl].items() if a == p1}
        if d and sum(d.values()) >= min_mass:
            tot = sum(d.values())
            return {b: w / tot for b, w in d.items()}
    return {}


def predict(bp, ort, art, k=3, beam=12, max_len=6):
    beams, finished = [([], 1.0)], []       # ([generated materials], prob)
    for _ in range(max_len + 1):
        nxt = []
        for gen, p in beams:
            p2 = gen[-2] if len(gen) >= 2 else S
            p1 = gen[-1] if len(gen) >= 1 else S
            dist = next_dist(p2, p1, bp, ort, art)
            if not dist:
                if gen:
                    finished.append((gen, p))
                continue
            for m, pm in dist.items():
                if m == E:
                    if gen:
                        finished.append((gen, p * pm))
                else:
                    nxt.append((gen + [m], p * pm))
        if not nxt:
            break
        nxt.sort(key=lambda x: x[1], reverse=True)
        beams = nxt[:beam]
    finished += [(g, p) for g, p in beams if g]

    best = {}
    for gen, p in finished:
        key = tuple(gen)
        if key and (key not in best or p > best[key]):
            best[key] = p
    ranked = sorted(best.items(), key=lambda x: x[1], reverse=True)[:k]
    tot = sum(p for _, p in ranked) or 1.0
    return [(list(key), p / tot) for key, p in ranked]


def observed_top(bp, ort, art, k=3):
    sub = df[(df.bauperiode == bp) & (df.ort == ort) & (df.art == art)]
    if sub.empty:
        return []
    agg = (sub.groupby(sub["mat"].map(lambda m: tuple(parse_materials(m))))["nettoflaeche"]
           .sum().sort_values(ascending=False))
    tot = agg.sum() or 1.0
    return [(list(seq), w / tot) for seq, w in agg.head(k).items()]


# ---------------------------------------------------------------------------
# Plausibilitätscheck: dasselbe Modell, das vorhersagt, bewertet auch Eingaben.
# ---------------------------------------------------------------------------
VOCAB = {m for seq in df["seq"] for m in seq}


def _step_probs(seq, bp, ort, art):
    """Wahrscheinlichkeit, die das Modell jedem Übergang dieser Sequenz gibt."""
    padded = [S, S] + list(seq) + [E]
    return [next_dist(a, b, bp, ort, art).get(c, 0.0)
            for a, b, c in zip(padded, padded[1:], padded[2:])]


def geomean(ps):
    """Geometrisches Mittel der Übergänge (längenrobust); 0 wenn ein Schritt unmöglich."""
    if not ps or min(ps) <= 0.0:
        return 0.0
    return math.exp(sum(math.log(p) for p in ps) / len(ps))


def reference(bp, ort, art, min_n=2):
    """Beobachtete Aufbauten als Referenzbereich, backt ab wenn die Zelle dünn ist."""
    for filt in [(df.bauperiode == bp) & (df.ort == ort) & (df.art == art),
                 (df.ort == ort) & (df.art == art),
                 (df.art == art)]:
        seqs = {tuple(s) for s in df[filt]["seq"]}
        if len(seqs) >= min_n:
            return seqs
    return set()


def check(seq, bp, ort, art, rev_factor=3.0):
    """
    Bewertet einen eingegebenen Aufbau:
      Stufe 3 = passt ins übliche Bild (im Referenzbereich)
      Stufe 2 = divergent, bitte bestätigen (unbekanntes Material / umgekehrt / ungewöhnlich)
      Stufe 1 = unplausibel (nie gesehene Materialfolge, Umkehrung rettet nicht)
    """
    seq = list(seq)
    unknown = [m for m in seq if m not in VOCAB]
    fwd = geomean(_step_probs(seq, bp, ort, art))
    rev = geomean(_step_probs(seq[::-1], bp, ort, art))
    ref = reference(bp, ort, art)
    floor = min((geomean(_step_probs(list(s), bp, ort, art)) for s in ref), default=0.0)
    n_ref = len(ref)

    if unknown:
        return dict(tier=2, label="neues/unbekanntes Material",
                    detail=f"unbekannt: {', '.join(unknown)}", fwd=fwd, rev=rev, n_ref=n_ref)
    if len(seq) >= 2 and fwd < floor and rev >= floor and rev >= fwd * rev_factor and rev > 0.0:
        return dict(tier=2, label="vermutlich UMGEKEHRT eingegeben",
                    detail="die Umkehrung ergibt einen typischen Aufbau", fwd=fwd, rev=rev, n_ref=n_ref)
    if fwd <= 0.0:
        return dict(tier=1, label="unplausibel",
                    detail="enthält eine nie gesehene Materialfolge", fwd=fwd, rev=rev, n_ref=n_ref)
    if n_ref and fwd >= floor:
        return dict(tier=3, label="passt ins übliche Bild",
                    detail="im Referenzbereich", fwd=fwd, rev=rev, n_ref=n_ref)
    return dict(tier=2, label="ungewöhnliche Kombination",
                detail="unter dem Referenzbereich", fwd=fwd, rev=rev, n_ref=n_ref)


if __name__ == "__main__":
    demo = [("bis 1918", "RG", "AW"), ("bis 1918", "RG", "IW"),
            ("1945-1979", "RG", "AW"), ("1980-1999", "RG", "AW"),
            ("bis 1918", "DG", "D")]
    for bp, ort, art in demo:
        print("=" * 64)
        print(f"{bp} | {ort} | {art}")
        print("  gemessen (top-3):")
        for mats, p in observed_top(bp, ort, art):
            print(f"    {p*100:5.1f}%  {' + '.join(mats)}")
        print("  markov  (top-3):")
        for mats, p in predict(bp, ort, art):
            print(f"    {p*100:5.1f}%  {' + '.join(mats)}")

    cells = df.groupby(["bauperiode", "ort", "art"]).size().reset_index(name="n")
    match = tot = 0
    for _, row in cells.iterrows():
        obs = observed_top(row.bauperiode, row.ort, row.art, 1)
        pred = predict(row.bauperiode, row.ort, row.art, 1)
        if obs and pred:
            tot += 1
            match += tuple(obs[0][0]) == tuple(pred[0][0])
    print("\n" + "#" * 64)
    print(f"top-1 reproduziert den haeufigsten gemessenen Aufbau in {match}/{tot} Zellen ({100*match/max(tot,1):.0f}%)")

    print("\n" + "#" * 64)
    print("PLAUSIBILITAETSCHECK (Demo)")
    tests = [
        ("1980-1999", "RG", "AW", ["STB", "Styropor", "Putz"], "korrekt"),
        ("1980-1999", "RG", "AW", ["Putz", "Styropor", "STB"], "umgekehrt eingegeben"),
        ("1980-1999", "RG", "AW", ["STB", "Karton", "Putz"], "erfundenes Material"),
        ("1980-1999", "RG", "AW", ["Latten", "Sparren", "Ziegel"], "wirre Folge"),
        ("bis 1918", "RG", "AW", ["Putz", "Ziegel", "Putz"], "korrekt (symmetrisch)"),
    ]
    for bp, ort, art, seq, note in tests:
        r = check(seq, bp, ort, art)
        print(f"\n  [{note}]  {bp} | {ort} | {art}:  {' + '.join(seq)}")
        print(f"     -> Stufe {r['tier']}: {r['label']}  ({r['detail']})")
        print(f"        fwd={r['fwd']:.4f}  rev={r['rev']:.4f}  n_ref={r['n_ref']}")
