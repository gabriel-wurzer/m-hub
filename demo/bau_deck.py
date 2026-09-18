# Baut das Workshop-Deck: Clips einbetten, Folien ergaenzen, Sprechtext in die Notizen.
#
# Quelle ist der zuletzt aus Drive geholte Stand. Das Ergebnis wird als neue
# Datei geschrieben, das Original bleibt unangetastet.
#
#   python bau_deck.py <quelle.pptx> <ziel.pptx>

import copy
import os
import sys

from pptx import Presentation
from pptx.util import Inches

HIER = os.path.dirname(os.path.abspath(__file__))
VIDEO = os.path.join(HIER, "video")
GRAFIK = os.path.join(HIER, "bilder", "wandtypen.png")
HARVESTMAP = os.path.join(HIER, "video-branding", "m-hub_branding-harvestmap.mp4")

QUELLE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HIER, "deck_quelle.pptx")
ZIEL = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HIER, "deck_neu.pptx")

# --standbild: statt der Videos nur das Standbild einsetzen. Fuer die Fassung,
# die nach Google Slides geht: Slides spielt eingebettete pptx-Videos nicht ab,
# dort wird das Standbild per Hand gegen ein Drive-Video getauscht.
NUR_STANDBILD = "--standbild" in sys.argv

# Kapitel -> Folientitel. Titel, die es noch nicht gibt, werden angelegt.
CLIPS = {
    "Suche und Abfrage": "karte",
    "Einloggen → Einbringen": "einbringen",
    "Materialeingabe und Schadstoff-Querverweis": "schadstoff",
    "Materieller Gebäudepass & Materialkataster": "mgp",
    "Materialkataster": "kataster",
    "Impulsvorträge: KI im m-hub": "katalog",
    "Punktwolke → IFC": "punktwolke",
    "IFC im Browser": "ifc",
    "Splats hochladen → Marktplatz": "splat",
    "Marktplatz": "markt",
}

NEUE_FOLIEN = [
    ("Schwarzspanierstraße 18 (1/4)", "GW"),
    ("Schwarzspanierstraße 18 (2/4)", "GW"),
    ("Schwarzspanierstraße 18 (3/4)", "GW"),
    ("Schwarzspanierstraße 18 (4/4)", "GW"),
    ("Materialeingabe und Schadstoff-Querverweis", "OM"),
    ("Materialkataster", "PK"),
    ("IFC im Browser", "CK"),
]

REIHENFOLGE = [
    "Ablauf des Workshops", "EINFÜHRUNG", "Warum m-hub?", "Der m-hub Prozess",
    "Konsortium & Rollen", "m-hub DEMO UND VORTRÄGE",
    "Suche und Abfrage",
    "Im Hintergrund",
    "Schwarzspanierstraße 18 (1/4)", "Schwarzspanierstraße 18 (2/4)",
    "Schwarzspanierstraße 18 (3/4)", "Schwarzspanierstraße 18 (4/4)",
    "Einloggen → Einbringen",
    "Materialeingabe und Schadstoff-Querverweis",
    "Materieller Gebäudepass & Materialkataster",
    "Materialkataster",
    "Impulsvorträge: KI im m-hub",
    "Punktwolke → IFC",
    "IFC im Browser",
    "Splats hochladen → Marktplatz",
    "Plan2D → Daten der Stadt Wien",
    "Marktplatz",
    "m-hub → Archicad",
    "Rosina: m-hub / HarvestMap",
    "Bauwerksbuch",
    "PAUSE", "FEEDBACK-RUNDE", "Die fünf Tischgespräche", "MITTAGESSEN & POSTER",
    "Poster & Demos beim Mittagessen", "ERGEBNISSE & AUSBLICK",
    "Ergebnisse, Feedback & Ausblick", "Danke & Vernetzung",
]

prs = Presentation(QUELLE)


def titel(slide):
    return slide.shapes.title.text.strip() if slide.shapes.title is not None else "(ohne)"


def body_entfernen(slide):
    for shape in list(slide.shapes):
        if shape.is_placeholder and shape.placeholder_format.idx == 1:
            shape._element.getparent().remove(shape._element)


def clip_einbetten(slide, mp4, png=None):
    if not os.path.exists(mp4):
        print("   fehlt:", os.path.basename(mp4))
        return False
    breite = Inches(8.60)
    if NUR_STANDBILD:
        if png and os.path.exists(png):
            slide.shapes.add_picture(png, Inches((13.33 - 8.60) / 2), Inches(1.85),
                                     width=breite)
        return True
    slide.shapes.add_movie(
        mp4, Inches((13.33 - 8.60) / 2), Inches(1.85), breite, Inches(8.60 / 1.6),
        poster_frame_image=png if png and os.path.exists(png) else None,
        mime_type="video/mp4")
    return True


def notiz_anhaengen(slide, text):
    rahmen = slide.notes_slide.notes_text_frame
    vorhanden = rahmen.text.strip()
    rahmen.text = (vorhanden + "\n\n" + text) if vorhanden else text


# Vortragendenzeile der Demo-Folien als Vorlage
vorlage = None
for slide in prs.slides:
    if titel(slide).startswith("Karte →"):
        for shape in slide.shapes:
            if not shape.is_placeholder and shape.has_text_frame:
                vorlage = shape._element
                break
        break


def folie_anlegen(text, vortragende):
    slide = prs.slides.add_slide(prs.slide_layouts[1])
    slide.shapes.title.text = text
    if vorlage is not None:
        kopie = copy.deepcopy(vorlage)
        slide.shapes._spTree.insert_element_before(kopie, "p:extLst")
        slide.shapes[-1].text_frame.text = vortragende
    return slide


# 1. Folie 8 umbenennen, Bodytext raus
for slide in prs.slides:
    if titel(slide).startswith("Karte →"):
        slide.shapes.title.text = "Suche und Abfrage"
        body_entfernen(slide)
        break

# 2. Erklaerfolie
erklaerung = folie_anlegen("Im Hintergrund", "GW / WL")
body = erklaerung.placeholders[1]
body.left, body.top = Inches(0.92), Inches(2.00)
body.width, body.height = Inches(5.10), Inches(4.20)
rahmen = body.text_frame
rahmen.word_wrap = True
zeilen = [
    ("FMZK  © OGD Wien, CC-BY", 0),
    ("⇒  Parametrisches Modell", 0),
    ("⇒  Mengen je Bauteil", 0),
    ("BAUP × Typ  ⇒  Material", 0),
    ("", 0),
    ("Geometrie gemessen", 1),
    ("Bauperiode vorhergesagt", 1),
    ("Material geschätzt", 1),
]
rahmen.text = zeilen[0][0]
for text, ebene in zeilen[1:]:
    absatz = rahmen.add_paragraph()
    absatz.text = text
    absatz.level = ebene
if os.path.exists(GRAFIK):
    erklaerung.shapes.add_picture(GRAFIK, Inches(6.35), Inches(1.75), width=Inches(6.10))

# 3. Restliche neue Folien
for text, vortragende in NEUE_FOLIEN:
    folie_anlegen(text, vortragende)

# 4. Clips einbetten, Sprechtext in die Notizen
for slide in prs.slides:
    name = CLIPS.get(titel(slide))
    if name:
        body_entfernen(slide)
        if clip_einbetten(slide, os.path.join(VIDEO, name + ".mp4"),
                          os.path.join(VIDEO, name + ".png")):
            print("  Clip:", titel(slide))
        sprechtext = os.path.join(VIDEO, name + ".txt")
        if os.path.exists(sprechtext):
            with open(sprechtext, encoding="utf-8") as datei:
                notiz_anhaengen(slide, datei.read().strip())
    elif titel(slide).startswith("Rosina"):
        body_entfernen(slide)
        if clip_einbetten(slide, HARVESTMAP):
            print("  Clip:", titel(slide))
        notiz_anhaengen(slide, "Clip zeigt bewusst das HarvestMAP-Branding, "
                               "prod läuft am Workshoptag unter m-hub.")

# 5. Reihenfolge herstellen. Die Titelfolie hat keinen Platzhalter und bleibt vorne.
liste = prs.slides._sldIdLst
nach_titel = {}
for element, slide in zip(list(liste), prs.slides):
    nach_titel.setdefault(titel(slide), []).append(element)

fehlend = [t for t in REIHENFOLGE if t not in nach_titel]
if fehlend:
    print("  nicht gefunden:", fehlend)

for element in list(liste):
    liste.remove(element)
for text in REIHENFOLGE:
    if nach_titel.get(text):
        liste.append(nach_titel[text].pop(0))
for rest in nach_titel.values():
    for element in rest:
        liste.append(element)
for element in [e for e, s in zip(list(liste), prs.slides) if titel(s) == "(ohne)"]:
    liste.remove(element)
    liste.insert(0, element)

prs.save(ZIEL)
print("\n%s  %.1f MB, %d Folien" % (os.path.basename(ZIEL),
                                    os.path.getsize(ZIEL) / 1048576, len(prs.slides)))
