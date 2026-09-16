# Flugstrecke: Bildschirmvideos fuer den Abschlussworkshop

Geskriptete Demo-Clips, gedreht mit Playwright. **Ein Clip je Demo-Folie.**

Der Demo-Block am 23.9. dauert 90 Minuten und hat elf Vortragende. Ein
durchlaufendes Video hilft da niemandem. Jede Folie bekommt ihren eigenen,
lautlosen Clip, der laeuft waehrend die Person spricht und von vorne anfaengt,
wenn sie laenger braucht. Gesprochen wird live, die Clips sind stumm.

## Kapitel

| Kapitel | Folie | Was zu sehen ist |
|---|---|---|
| `karte` | 8 Karte → Suche → Zusammensetzung | Adresssuche Schwarzspanierstraße 18, Gebaeude markiert, Materialzusammensetzung und Dokumente |
| `einbringen` | 9 Einloggen → Einbringen | Angemeldet als Demo, eigene Gebaeudeliste |
| `schadstoff` | 10 Tippen → Querverweis Schad- und Stoerstoff | Der signierte Pruefbericht am Gebaeude |
| `mgp` | 11a Materieller Gebaeudepass | Materialbilanz je Gruppe, CSV-Download |
| `kataster` | 11b Materialkataster | Stadtweit, je Bauperiode waehlbar |
| `katalog` | 12 Aufbauten-Katalog | Typische Schichtfolgen, gemessen gegen Modell |
| `punktwolke` | 13a Punktwolke | Laserscan Stiegenhaus im Browser |
| `ifc` | 13b IFC | Bauteile einzeln im IFC-Viewer |
| `splat` | 14 Splats → Marktplatz | Handwaschbecken als Gaussian Splat |
| `markt` | 16 Marktplatz | Angebot und Nachfrage |

Nicht dabei, weil kein UI-Ablauf dahintersteht: Plan2D (eigene Anwendung unter
`/plantool`), Archicad, die KI-Impulsvortraege und Rosina. Rosina braucht
HarvestMAP-Branding und hat deshalb einen eigenen, vorproduzierten Clip.

## Aendern

Das ganze Drehbuch steht in `flugstrecke.mjs` unter `CHAPTERS`. Schritte
umsortieren, Untertitel umschreiben, Zeiten anpassen, dann das Kapitel neu
drehen. Wer einen Untertitel anders formuliert haben will, aendert ihn dort und
ruft `node flugstrecke.mjs <kapitel>` auf, das dauert unter einer Minute.

Aktions-Vokabular je Schritt:

```
{ goto:'/pfad' }                 Seite aufrufen
{ caption:'Text' }               Untertitel einblenden ('' blendet aus)
{ hold:ms }                      stehenbleiben
{ waitFor:'Text|.selector' }     auf Inhalt warten
{ click:'.selector' }            klicken
{ clickText:'Text' }             erstes Element mit diesem Text klicken
{ type:['.selector','Text'] }    tippen
{ press:'Enter' }                Taste
{ followLink:'.selector' }       dem href folgen, im selben Fenster
{ fill:['.selector','wert'] }    Eingabefeld oder Regler setzen
{ scrollTo:'.selector' }         Element in den Blick scrollen
{ wheel:[x,y,dy,n] }             Mausrad
```

Ein Schritt, der scheitert, bricht das Kapitel nicht ab. Im Log steht dann,
welcher es war. Am Ende jedes Kapitels wird zusaetzlich ein Standbild
(`video/<kapitel>.png`) abgelegt, damit man ohne Abspielen sieht, ob der Clip
das Richtige zeigt.

## Drehen

```bash
npm i playwright          # einmalig, Browser sind meist schon im Cache
node flugstrecke.mjs                  # alle Kapitel
node flugstrecke.mjs karte splat      # nur diese
```

Standardziel ist dev (`http://localhost:8910`). Gegen prod:

```bash
DEMO_BASE=https://m-hub.dap.tuwien.ac.at node flugstrecke.mjs
```

**Angemeldete Kapitel brauchen ein Token.** Entweder `DEMO_TOKEN` setzen oder in
`demo/.token` legen (gitignored). Das Token gehoert dem User `Demo`
(`demo@m-hub.at`) und laeuft nach ein paar Stunden ab. Neu ausstellen:

```bash
docker exec m-hub-m-hub-backend-1 sh -c 'cd /data && node -e "
  console.log(require(\"jsonwebtoken\").sign(
    {sub:\"<user-uuid>\",username:\"Demo\",email:\"demo@m-hub.at\"},
    process.env.JWT_SECRET, {expiresIn:\"4h\"}))"'
```

## Nach mp4 wandeln

Playwright schreibt `.webm`. Fuer PowerPoint und YouTube braucht es mp4:

```bash
cd video
for f in *.webm; do
  docker run --rm -v "$(pwd -W):/w" jrottenberg/ffmpeg -y -loglevel error \
    -i "/w/$f" -c:v libx264 -pix_fmt yuv420p -movflags +faststart "/w/${f%.webm}.mp4"
done
```

Playwrights mitgeliefertes ffmpeg reicht dafuer nicht, das kann kein mp4.

## Einbetten

Google Slides bettet nur YouTube oder Drive ein, keine lokalen Dateien. Die
Clips gehen also nach Drive oder als nicht gelistete YouTube-Videos hoch. Eine
lokale Kopie am Praesentationslaptop bleibt trotzdem die Rueckfallebene, falls
das Netz im Funkhaus streikt.

`video/` ist gitignored, die Clips liegen nicht im Repo.
