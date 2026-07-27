# m-hub-processing — Nacht-Optimierung Findings (Branch `nacht-opt`)

Vom `/loop` erzeugt. Jede Runde: eine sichere Verbesserung, ODER eine untersuchte,
aber domänen-abhängige Frage, die Gabriel/Wolfgang entscheiden (nicht geraten).

## 2026-07-24 — Dach (art=D) überzählt ~10× für bp=unbekannt/ab-2000

**Befund:** Das Dach der unbekannt- und ab-2000-Gebäude (zusammen ~80 % des Bestands)
wird als **787 mm massiver Ziegel = 1416 kg/m²** modelliert. Real: ~100–200 kg/m².
Das erklärt die DG-D-Position der Diagnose (81 Mt / 9 %) — grob ~75 Mt davon sind Luft.

kg/m² je Periode (roof_check):
```
unbekannt  T= 787mm  Summe= 787mm  1416 kg/m2   [Ziegel 787mm]
bis 1918   T=1108mm  Summe=  20mm    10 kg/m2   [Ziegel 0, Latten 0, Sparren 20mm]
1919-1944  T=  91mm  Summe=  91mm    32 kg/m2   [Dämmung-hart/-weich, Abdichtung, Gips, Pfetten, Latten]
1945-1979  T=  31mm  Summe=  41mm    20 kg/m2   [Holz 41mm]
1980-1999  T= 138mm  Summe= 138mm   128 kg/m2   [Metall, Abdichtung×2, Dämmung-hart, Schüttung, Beton]
ab 2000    T= 787mm  Summe= 787mm  1416 kg/m2   [Ziegel 787mm]
```

**Ursache:** `catalog_T("DG","D")` backt für unbekannt auf ~787 mm ab — das ist die
**Dach-Bautiefe** (Sparrenraum, überwiegend Luft), NICHT Vollmaterial-Dicke. Der
Markov-Backoff sagt für unbekannt eine Einzelschicht „Ziegel" (Dachziegel) vorher,
und Modell C streckt diese eine variable Schicht auf die volle Bautiefe → 787 mm
Vollziegel.

**Nebenbefund (predict_C-Inkonsistenz):** Ein sauberes Mehrschicht-Dach mit lauter
Fix-Schichten (bis-1918: Ziegel+Latten+Sparren) lässt den Rest fallen (T=1108 mm,
Summe nur ~20 mm) → ~10 kg/m² (zufällig plausibel, weil Dächer leicht sind). Eine
Einzel-Variable-Schicht füllt die volle Tiefe → 1416 kg/m². Gleiche Lage,
gegensätzliches Ergebnis.

**Warum NICHT autonom gefixt:** die richtige Behandlung ist ein Dach-Materialmodell
(Dachziegel/Lattung/Sparren als dünne bzw. Linienelemente, NICHT Fläche × Voll-Dicke).
Das ist Wolfgangs Dach-Territorium (vgl. Dach-Neigungsmodell). Kein Raten.

**Empfehlung:** art=D braucht eine eigene Dicken-/Massenbehandlung statt `catalog_T`
als Vollmaterial. Bis dahin ist die DG-D-Masse (81 Mt) für ~80 % des Bestands ~10× zu
hoch.
