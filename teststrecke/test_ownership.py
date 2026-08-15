"""Suite: Ownership-Enforcement auf den auth'd Mutationen.
Auth beweist nur "eingeloggt" — hier wird bewiesen, dass ein eingeloggter FREMDER
(User B) ein Bauteil von User A NICHT aendern/loeschen kann. Der Handler scoped jede
Mutation per `WHERE owner_id = <token.sub>`; faellt dieser Scope je raus (Phase-1-Klasse:
still weggelassene WHERE-Bedingung), schlaegt dieser Test an.

Bauteil (building_parts) steht stellvertretend fuer alle owner_id-Tabellen (market_listings,
building_objects, documents) — der Audit hat gezeigt dass sie exakt dasselbe WHERE-Muster teilen.
"""
import json
import uuid

from harness import NODE, http, mint, psql


def run(r):
    ident = psql("SELECT owner_id||'|'||user_building_id||'|'||building_id||'|'||location "
                 "FROM building_parts WHERE owner_id IS NOT NULL LIMIT 1;")
    if ident.count("|") != 3:
        r.skip("ownership", "kein Bestands-Bauteil zum Ableiten der Identitaet")
        return
    owner_a, ub, building, location = ident.split("|")
    tok_a = mint(owner_a)
    tok_b = mint(str(uuid.uuid4()))          # eingeloggter Fremder, besitzt nichts
    tag = uuid.uuid4().hex[:8]
    name0 = "ownership-test-" + tag
    layers = [{"layer_index": 1, "material": "Ziegel", "thickness": 250}]
    part = {"building_id": building, "user_building_id": ub, "category": "Bauteil",
            "name": name0, "location": location, "part_type": "Innenwand",
            "is_public": True, "is_hazardous": False,
            "part_structure": {"type": "wall", "length": 3.0, "layers": layers}}

    sc, body = http("POST", NODE + "/api/parts", part, token=tok_a)
    pid = json.loads(body)["id"] if 200 <= sc < 300 else None
    r.check("A legt Bauteil an -> 2xx", pid is not None, f"sc={sc} {body[:120]}")
    if not pid:
        return

    # B versucht umzubenennen -> A's Bauteil muss unveraendert bleiben
    put = dict(part); put["name"] = "HACKED-by-B"
    sc_put, _ = http("PUT", NODE + f"/api/parts/{pid}", put, token=tok_b)
    name_now = psql(f"SELECT name FROM building_parts WHERE id='{pid}';")
    r.check("B kann A's Bauteil NICHT umbenennen (name unveraendert)",
            name_now == name0, f"put_sc={sc_put} name={name_now!r}")

    # B versucht zu loeschen -> A's Bauteil muss noch existieren
    sc_del, _ = http("DELETE", NODE + f"/api/parts/{pid}", token=tok_b)
    still = psql(f"SELECT count(*) FROM building_parts WHERE id='{pid}';")
    r.check("B kann A's Bauteil NICHT loeschen (existiert noch)",
            still == "1", f"del_sc={sc_del} count={still}")

    # Gegenprobe: A darf sein eigenes Bauteil loeschen (Cleanup)
    http("DELETE", NODE + f"/api/parts/{pid}", token=tok_a)
    gone = psql(f"SELECT count(*) FROM building_parts WHERE id='{pid}';")
    r.check("A loescht sein eigenes Bauteil (owner darf, cleanup)", gone == "0", f"count={gone}")
