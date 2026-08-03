"""Suite: reduziertes IFC wird ein eigenes Dokument.

Beweist den Vollpfad: Punktwolke -> point2ifc legt das fertige IFC selbst in seaweed ab ->
node-red-Poller macht daraus atomar+idempotent eine documents-Zeile (file_type=ifc), die
abrufbar ist und deren Dateiname aus der Quelle stammt (nicht generisch 'input.ifc').
Braucht eine echte Punktwolke (P2I_PC_FILE).
"""
import json
import os
import time
import uuid

from harness import NODE, PC_FILE, SEAWEED, derive_identity, http, mint, psql


def run(r):
    if not PC_FILE or not os.path.isfile(PC_FILE):
        r.skip("ifc-dokument", "keine Punktwolke (P2I_PC_FILE nicht gesetzt/gefunden)")
        return

    owner, ub, building = derive_identity()
    tok = mint(owner)
    tag = uuid.uuid4().hex[:8]
    src_name = "ifcdoc-test-" + tag
    ifc_name = src_name + " (reduziertes IFC)"

    sc, body = http("GET", NODE + "/api/documents/by-building/" + building, token=tok)
    try:
        is_list = isinstance(json.loads(body or b"[]"), list)
    except Exception:
        is_list = False
    r.check("summary-query (by-building) liefert liste", sc == 200 and is_list, f"sc={sc}")

    sp = f"/mhub/documents/testifc/{uuid.uuid4()}/{os.path.basename(PC_FILE)}"
    with open(PC_FILE, "rb") as f:
        sc, _ = http("PUT", SEAWEED + sp, data=f.read(), ctype="application/octet-stream")
    r.check("seaweed upload punktwolke", sc in (200, 201), f"sc={sc}")
    src = str(uuid.uuid4())
    psql("INSERT INTO documents (id, building_id, owner_id, user_building_id, name, is_public, file_url, file_type) "
         f"VALUES ('{src}','{building}','{owner}','{ub}','{src_name}',true,'{sp}','las');")

    sc, _ = http("POST", NODE + "/api/point2ifc/start", {"document_id": src}, token=tok)
    r.check("start -> 202", sc == 202, f"sc={sc}")

    print("... warte auf done", flush=True)
    final, t0 = None, time.time()
    while time.time() - t0 < 360:
        st = psql(f"SELECT COALESCE(p2i_status,'') FROM documents WHERE id='{src}';")
        if st in ("done", "error"):
            final = st
            break
        time.sleep(4)
    r.check("quelle: p2i_status=done", final == "done", f"final={final}")

    row = psql("SELECT id||'|'||COALESCE(file_url,'')||'|'||file_type FROM documents "
               f"WHERE name='{ifc_name}' AND file_type='ifc';")
    parts = row.split("|") if row else []
    ifc_id = parts[0] if len(parts) == 3 else ""
    ifc_url = parts[1] if len(parts) == 3 else ""
    r.check("IFC-Dokument angelegt (file_type=ifc)", bool(ifc_id), f"row={row!r}")
    r.check("IFC file_url zeigt in seaweed (/mhub/point2ifc/..)", ifc_url.startswith("/mhub/point2ifc/"), f"url={ifc_url}")
    r.check("IFC-Dateiname aus Quelle (nicht input.ifc)",
            ifc_url.endswith(".ifc") and not ifc_url.endswith("/input.ifc"), f"url={ifc_url}")

    if ifc_url:
        sc, data = http("GET", SEAWEED + ifc_url)
        r.check("IFC aus seaweed abrufbar (200 + nicht leer)", sc == 200 and len(data) > 0, f"sc={sc} bytes={len(data)}")

    cnt = psql(f"SELECT count(*) FROM documents WHERE name='{ifc_name}' AND file_type='ifc';")
    r.check("idempotent: genau 1 IFC-Dokument", cnt == "1", f"count={cnt}")

    psql(f"DELETE FROM documents WHERE name IN ('{src_name}','{ifc_name}');")
    http("DELETE", SEAWEED + "/mhub/documents/testifc/?recursive=true")
