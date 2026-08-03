"""Suite: idempotenter reserve (Upload-Resume).

Beweist, dass ein abgebrochener Upload beim Fortsetzen DIESELBE documents-Zeile trifft
statt Waisen zu erzeugen: Dedup gleicher Datei+Groesse, Race -> genau eine Zeile,
48h-Upload-Token, und nach attach (file_url gesetzt) eine neue Reservierung.
"""
import json
import threading

from harness import NODE, b64u_decode, derive_identity, http, mint, psql


def run(r):
    owner, ub, building = derive_identity()
    tok = mint(owner)

    def reserve(name, fname, fsize, ftype="laz", desc=None):
        payload = {"building_id": building, "user_building_id": ub, "name": name,
                   "is_public": True, "file_type": ftype, "file_original_name": fname, "file_size": fsize}
        if desc is not None:
            payload["description"] = desc
        sc, body = http("POST", NODE + "/api/documents/reserve", payload, token=tok)
        return sc, json.loads(body or b"{}")

    sc1, r1 = reserve("resume-test-A", "big.laz", 12345, desc="erst")
    id1 = (r1.get("document") or {}).get("id")
    r.check("reserve A -> 201 + doc + upload.token",
            sc1 == 201 and id1 and (r1.get("upload") or {}).get("token"), f"sc={sc1}")

    sc2, r2 = reserve("resume-test-A2", "big.laz", 12345, desc="zweit")
    id2 = (r2.get("document") or {}).get("id")
    r.check("reserve B (gleiche datei+groesse) -> SELBE id", id2 == id1, f"id1={id1} id2={id2}")
    r.check("idempotent: metadaten aktualisiert (name=A2)",
            psql(f"SELECT name FROM documents WHERE id='{id1}';") == "resume-test-A2")

    _, r3 = reserve("resume-test-C", "big.laz", 99999)
    id3 = (r3.get("document") or {}).get("id")
    r.check("reserve C (andere groesse) -> ANDERE id", id3 and id3 != id1, f"id3={id3}")

    race_ids = []

    def _race():
        _, rr = reserve("resume-test-conc", "conc.laz", 555)
        race_ids.append((rr.get("document") or {}).get("id"))

    threads = [threading.Thread(target=_race) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    same = len({i for i in race_ids if i}) == 1
    dbcount = psql(f"SELECT count(*) FROM documents WHERE owner_id='{owner}'::uuid "
                   f"AND user_building_id='{ub}'::uuid AND file_original_name='conc.laz' "
                   f"AND file_size=555 AND file_url IS NULL;")
    r.check("race: 2 parallele reserve -> selbe id, genau 1 DB-Zeile",
            same and dbcount == "1", f"ids={race_ids} dbcount={dbcount}")

    tok_u = (r1.get("upload") or {}).get("token", "")
    try:
        payload = json.loads(b64u_decode(tok_u.split(".")[1]))
        ttl = payload.get("exp", 0) - payload.get("iat", 0)
    except Exception:
        ttl = -1
    r.check("upload-token TTL = 48h", abs(ttl - 48 * 3600) <= 120, f"ttl={ttl}s")

    psql(f"UPDATE documents SET file_url='/x/y/big.laz' WHERE id='{id1}';")
    _, r6 = reserve("resume-test-after", "big.laz", 12345)
    id6 = (r6.get("document") or {}).get("id")
    r.check("nach attach (file_url gesetzt): reserve -> NEUE id", id6 and id6 != id1, f"id1={id1} id6={id6}")

    psql("DELETE FROM documents WHERE name LIKE 'resume-test-%';")
