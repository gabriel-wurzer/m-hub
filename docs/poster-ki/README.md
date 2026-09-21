# Poster "KI in m-hub" (A0 hochkant)

`poster.html` ist die Quelle, `KI-in-m-hub_A0.pdf` das Druckergebnis,
841 × 1189 mm, eine Seite. `vorschau.png` ist nur zum Draufschauen.

## Neu rendern

Nach jeder Änderung an `poster.html`:

```bash
export PATH="$APPDATA/fnm/aliases/default:$PATH"
cd ../../demo && node poster-rendern.mjs
```

Das Skript liegt in `demo/`, weil playwright dort installiert ist.

Das Skript prüft nebenbei, ob der Inhalt noch auf eine Seite passt. Die Höhe
darf 4494 px (= 1189 mm bei 96 dpi) nicht überschreiten, sonst kippt der Rest
auf eine zweite Seite.

## Schriften

Bahnschrift für die Überschriften, Segoe UI für den Lauftext. Beide liegen unter
Windows bei, es wird nichts nachgeladen. Auf einem anderen System fällt es auf
Arial zurück und das Poster wird länger.

## Abbildungen

| Datei | Herkunft |
|---|---|
| `bilder/bp_stadt.png` | Stadtweite Vorhersage, `m-hub-processing/bauperioden/` |
| `bilder/bp_genauigkeit.png` | Confusion-Matrizen, räumlich kreuzvalidiert |
| `bilder/parametrik.png` | Parametrisches Modell, Schwarzspanierstraße 18 |
| `bilder/logos.png` | Logoleiste aus AP6-DISSEMINATION |

Das Schema der Plausibilitätsprüfung steckt als SVG direkt im HTML, damit es im
Druck scharf bleibt.

Die Rasterbilder landen im Druck bei rund 130 dpi. Für A0 aus zwei Metern
Betrachtungsabstand reicht das; wer mehr will, muss die Matplotlib-Figuren mit
höherem `dpi` neu erzeugen.
