"""Suite: das nachbarkontakt-Flag persistiert durch den Bauteil-Endpoint.

Regression fuer einen echten Fund: POST/PUT /api/parts baut part_structure NEU zusammen
(normalizePartStructure) statt es durchzureichen -> ein neues Flag faellt still raus, wenn
es nicht in die Whitelist kommt. Genau das war bei nachbarkontakt der Fall. Diese Suite
haette den Bug gefangen: Bauteil mit nachbarkontakt=true anlegen -> zuruecklesen -> muss ueberleben.
"""
import uuid

from harness import NODE, http, mint, psql


def run(r):
    # owner/ub/building/location aus einem Bestands-Bauteil ableiten (gueltige location noetig)
    def derive(sql):
        row = psql(sql)
        return row.split("|") if row.count("|") == 3 else None

    ident = derive("SELECT owner_id||'|'||user_building_id||'|'||building_id||'|'||location "
                   "FROM building_parts WHERE part_type IN ('Außenwand','Brandwand') AND owner_id IS NOT NULL LIMIT 1;") \
        or derive("SELECT owner_id||'|'||user_building_id||'|'||building_id||'|'||location "
                  "FROM building_parts WHERE owner_id IS NOT NULL LIMIT 1;")
    if not ident:
        r.skip("wandkontakt", "kein Bestands-Bauteil, aus dem owner/ub/building/location ableitbar ist")
        return

    owner, ub, building, location = ident
    tok = mint(owner)
    tag = uuid.uuid4().hex[:8]
    name_bw = "wandkontakt-test-bw-" + tag
    name_aw = "wandkontakt-test-aw-" + tag

    def make_part(name, part_type, structure):
        return {"building_id": building, "user_building_id": ub, "category": "Bauteil",
                "name": name, "location": location, "part_type": part_type,
                "is_public": True, "is_hazardous": False, "part_structure": structure}

    layers = [{"layer_index": 1, "material": "Ziegel", "thickness": 250}]

    # Brandwand MIT Flag -> muss persistieren
    sc, body = http("POST", NODE + "/api/parts",
                    make_part(name_bw, "Brandwand",
                              {"type": "wall", "length": 3.0, "layers": layers, "nachbarkontakt": True}),
                    token=tok)
    r.check("create Bauteil mit nachbarkontakt -> 2xx", 200 <= sc < 300, f"sc={sc} {body[:150]}")
    stored = psql(f"SELECT COALESCE(part_structure->>'nachbarkontakt','<absent>') FROM building_parts WHERE name='{name_bw}';")
    r.check("nachbarkontakt persistiert (nicht still weggefallen)", stored == "true", f"stored={stored!r}")

    # Aussenwand OHNE Flag -> keine Verunreinigung (false/absent)
    http("POST", NODE + "/api/parts",
         make_part(name_aw, "Außenwand", {"type": "wall", "length": 3.0, "layers": layers}), token=tok)
    stored2 = psql(f"SELECT COALESCE(part_structure->>'nachbarkontakt','<absent>') FROM building_parts WHERE name='{name_aw}';")
    r.check("ohne Flag: nachbarkontakt=false/absent (keine Verunreinigung)", stored2 in ("false", "<absent>"), f"stored2={stored2!r}")

    psql(f"DELETE FROM building_parts WHERE name IN ('{name_bw}','{name_aw}');")
