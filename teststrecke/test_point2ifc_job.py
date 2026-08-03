"""Suite: Point2IFC-Job — durabler Status.

Beweist, dass der Job-Status die Wahrheit in der DB fuehrt (nicht im RAM): start ->
queued/running -> done, Race-Dedup, python-404 -> "abgebrochen", fertiger Job ueberlebt
einen point2ifc-Neustart (OOM-Rehydrate), und Fehler kommen kurz+pfadfrei beim Browser an
(voller Traceback nur im Container-Log). Braucht eine echte Punktwolke (P2I_PC_FILE).
"""
import json
import os
import subprocess
import time
import uuid

from harness import NODE, P2I, P2I_CONT, PC_FILE, SEAWEED, derive_identity, http, mint, psql


def run(r):
    if not PC_FILE or not os.path.isfile(PC_FILE):
        r.skip("point2ifc-job", "keine Punktwolke (P2I_PC_FILE nicht gesetzt/gefunden)")
        return

    owner, ub, building = derive_identity()
    tok = mint(owner)
    created = []

    def make_doc(name, file_url, file_type="las"):
        did = str(uuid.uuid4())
        psql("INSERT INTO documents (id, building_id, owner_id, user_building_id, name, is_public, file_url, file_type) "
             f"VALUES ('{did}','{building}','{owner}','{ub}','{name}',true,'{file_url}','{file_type}');")
        created.append(did)
        return did

    def dcol(did, col):
        return psql(f"SELECT COALESCE({col}::text,'') FROM documents WHERE id='{did}';")

    sc, _ = http("POST", NODE + "/api/point2ifc/start", {"document_id": "x"}, token="bogus.bogus.bogus")
    r.check("auth: bogus token -> 401", sc == 401, f"status={sc}")

    seaweed_path = f"/mhub/documents/testp2i/{uuid.uuid4()}/scan{os.path.splitext(PC_FILE)[1]}"
    with open(PC_FILE, "rb") as f:
        sc, _ = http("PUT", SEAWEED + seaweed_path, data=f.read(), ctype="application/octet-stream")
    r.check("seaweed upload punktwolke", sc in (200, 201), f"status={sc}")

    did = make_doc("p2i-e2e-happy", seaweed_path)
    sc, body = http("POST", NODE + "/api/point2ifc/start", {"document_id": did}, token=tok)
    j = json.loads(body or b"{}")
    r.check("start -> 202 + job_id", sc == 202 and bool(j.get("job_id")), f"status={sc}")
    jobA = j.get("job_id")
    time.sleep(1)
    r.check("DB: job_id persistiert nach start", dcol(did, "p2i_job_id") == (jobA or ""))
    r.check("DB: status queued/running nach start", dcol(did, "p2i_status") in ("queued", "running"))

    _, body2 = http("POST", NODE + "/api/point2ifc/start", {"document_id": did}, token=tok)
    j2 = json.loads(body2 or b"{}")
    r.check("race: 2. start liefert selben job_id (kein Doppel-Queue)",
            j2.get("job_id") == jobA, f"first={jobA} second={j2.get('job_id')}")

    print("... warte auf done", flush=True)
    seen, final, t0 = set(), None, time.time()
    while time.time() - t0 < 360:
        st = dcol(did, "p2i_status")
        if st:
            seen.add(st)
        if st in ("done", "error"):
            final = st
            break
        time.sleep(4)
    r.check("poller: status-transitions in DB geschrieben", "running" in seen or final == "done", f"seen={sorted(seen)}")
    r.check("happy path: final = done", final == "done", f"final={final}")
    res = dcol(did, "p2i_result")
    r.check("done: p2i_result mit walls/storeys befuellt",
            final == "done" and '"walls"' in res and '"storeys"' in res, f"result={res[:120]}")

    if final == "done" and jobA:
        subprocess.run(["docker", "restart", P2I_CONT], capture_output=True, text=True)
        ok = False
        for _ in range(30):
            try:
                sc, body = http("GET", P2I + "/point2ifc/" + jobA)
                if sc == 200 and json.loads(body).get("status") == "done":
                    ok = True
                    break
            except Exception:
                pass
            time.sleep(2)
        r.check("rehydrate: fertiger Job ueberlebt point2ifc-Neustart (kein 404)", ok, f"GET /point2ifc/{jobA}")

    did404 = make_doc("p2i-e2e-404", seaweed_path)
    psql(f"UPDATE documents SET p2i_status='running', p2i_job_id='deadbeef0000' WHERE id='{did404}';")
    ok, err = False, ""
    for _ in range(20):
        if dcol(did404, "p2i_status") == "error":
            err = dcol(did404, "p2i_error")
            ok = True
            break
        time.sleep(3)
    r.check("404: poller setzt error 'abgebrochen'", ok and "abgebrochen" in err.lower(), f"err={err[:80]}")

    bad_url = f"/mhub/documents/testp2i/{uuid.uuid4()}/nichtda.laz"
    didbad = make_doc("p2i-e2e-badfile", bad_url)
    http("POST", NODE + "/api/point2ifc/start", {"document_id": didbad}, token=tok)
    errb = ""
    for _ in range(40):
        if dcol(didbad, "p2i_status") == "error":
            errb = dcol(didbad, "p2i_error")
            break
        time.sleep(3)
    pathfree = (errb and "traceback" not in errb.lower() and "/app" not in errb.lower()
                and "c:\\" not in errb.lower() and len(errb) <= 200)
    r.check("sanitize: error kurz + pfadfrei im Browser/DB", bool(errb) and pathfree, f"err={errb!r}")
    logs = subprocess.run(["docker", "logs", "--tail", "200", P2I_CONT], capture_output=True, text=True)
    r.check("sanitize: voller Traceback nur im Container-Log", "Traceback" in ((logs.stdout or "") + (logs.stderr or "")))

    # cleanup: Quell- UND vom Poller angelegte IFC-Doks (name-Prefix) + seaweed-Testuploads
    psql("DELETE FROM documents WHERE name LIKE 'p2i-e2e-%';")
    http("DELETE", SEAWEED + "/mhub/documents/testp2i/?recursive=true")
    r.check("bestand: alle Testdokumente wieder entfernt",
            psql("SELECT count(*) FROM documents WHERE name LIKE 'p2i-e2e-%';") == "0")
