# Branding umstellen (m-hub <-> HarvestMAP)

Runbook fuer das Umschalten des Frontend-Brandings auf prod. Gedacht fuer den
Abschlussworkshop am 23.9.2026: prod laeuft normalerweise als HarvestMAP, fuer
die Live-Demo wird kurzfristig auf m-hub zurueckgestellt und danach wieder
zurueck.

## Das Wichtigste zuerst

Branding ist **Build-Zeit, nicht Laufzeit**. `FRONTEND_BRANDING` geht als
Docker-Build-ARG in `m-hub-frontend/Dockerfile` und wird dort von
`npm run build` ueber das `prebuild`-Skript `scripts/apply-branding.js` fest in
die ausgelieferten Dateien eingebacken (Assets, Theme-SCSS, `index.html`-Titel,
Favicon).

Daraus folgt die haeufigste Falle: **`docker-compose restart` oder
`docker-compose up -d` allein aendern gar nichts.** Ohne `build` bleibt das alte
Branding im Image.

## Was es gibt

Jeder Wert entspricht einem Ordner unter `m-hub-frontend/customization/`:

| `FRONTEND_BRANDING` | Ergebnis | appName |
|---|---|---|
| `default` | m-hub | `m-hub` |
| `materialnomaden` | HarvestMAP | `HarvestMAP` |

Ein unbekannter Wert faellt still auf `default` zurueck (mit Warnung im
Build-Log). Zweiter Schalter: `HIDE_NAME_SECTION` blendet den Schriftzug in der
Menueleiste aus.

## Umstellen (der minimale Weg)

Nur das Frontend anfassen. **Nicht** `./deploy.sh` benutzen: das baut alle
Services neu, re-importiert `buildings_details` ueber gdal und laedt die
Bauperioden-Tabelle neu. Am Workshop-Tag will man das nicht.

```bash
ssh root@locationbase.dap.tuwien.ac.at
cd /root/m-hub

# 1. Branding in der .env setzen
#    m-hub:      FRONTEND_BRANDING=default
#    HarvestMAP: FRONTEND_BRANDING=materialnomaden
nano .env

# 2. Nur das Frontend neu bauen und ersetzen
docker-compose build m-hub-frontend
docker-compose up -d m-hub-frontend
```

Der Build dauert ein paar Minuten. `npm ci` bleibt gecacht, nur der
Angular-Build laeuft neu, weil der geaenderte ARG genau diese Layer invalidiert.

## Verifizieren

Von aussen, ohne Browser:

```bash
curl -s https://m-hub.dap.tuwien.ac.at | grep -oE "<title>[^<]*</title>"
curl -s https://m-hub.dap.tuwien.ac.at/assets/branding/branding.json
```

Erwartung nach dem Umstellen auf m-hub:

```
<title>m-hub</title>
{ "appName": "m-hub", "menuLetters": ["m","h","u","b"], ... }
```

Erwartung im HarvestMAP-Zustand:

```
<title>HarvestMAP</title>
{ "appName": "HarvestMAP", ... }
```

Im Browser zusaetzlich hart neu laden (Strg+Shift+R) oder ein privates Fenster
nehmen. `index.html` selbst kann in der Zwischenschicht gecacht sein, Logo und
Favicon haengen an einem Versions-Hash und aktualisieren sich von selbst.

## Ablauf rund um den Workshop

1. **Vorher**, solange prod noch HarvestMAP ist: das Bildschirmvideo "mit
   Branding" aufnehmen (Karte zoomen, Objekt markieren). Danach ist dieser
   Zustand nicht mehr live verfuegbar, ohne wieder umzubauen.
2. **Am Vorabend oder Morgen des 23.9.**: auf `default` umstellen, verifizieren.
3. **Waehrend der Demo**: Folie "Rosina: m-hub / HarvestMap" laeuft ueber den
   vorproduzierten Clip, weil prod in diesem Moment m-hub zeigt.
4. **Danach**: zurueck auf `materialnomaden`, verifizieren.

## Wenn etwas schiefgeht

Der Rueckweg ist derselbe Befehl mit dem anderen Wert. Das vorige Image ist
nach dem Rebuild ueberschrieben, es gibt also kein Zurueckrollen ohne Neubau.
Zeit einplanen: einmal umstellen und pruefen dauert realistisch 10 Minuten.
