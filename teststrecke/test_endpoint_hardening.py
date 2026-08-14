"""Suite: die in Hardening Phase 1 entfernten toten/unauthentifizierten Endpoints
sind wirklich weg (404) und die lebenden Nachbarn existieren weiter.

Regression-Guard: keine der 7 Routen darf still zurueckkommen. Gegenprobe stellt sicher,
dass beim Entfernen nicht versehentlich ein lebender Endpoint mitgeloescht wurde
(POST /api/documents muss weiter da sein, nur auth-guarded -> 401, nicht 404).
"""
from harness import NODE, http

# (Methode, URL) der 7 entfernten Endpoints — muessen jetzt 404 liefern
REMOVED = [
    ("GET", "/api/documents"),                       # bare list-all, unauth, Aufrufer war auskommentiert
    ("GET", "/api/user/u1/buildings"),               # legacy JSON-file user-buildings (IDOR)
    ("POST", "/api/user/u1/buildings"),
    ("GET", "/api/user/u1/buildings/b1/data"),
    ("POST", "/api/user/u1/buildings/b1/data"),
    ("PUT", "/api/user/u1/buildings/b1/data"),
    ("PUT", "/api/building/b1"),                      # unauth Schreibzugriff, kein Aufrufer
]


def run(r):
    for m, u in REMOVED:
        body = {} if m in ("POST", "PUT") else None
        sc, _ = http(m, NODE + u, body)
        r.check(f"{m} {u} -> 404 (entfernt)", sc == 404, f"sc={sc}")

    # Gegenprobe: lebender Nachbar auf gleicher URL wurde NICHT mitgeloescht.
    # POST /api/documents existiert weiter -> ohne Token 401 (nicht 404).
    sc, _ = http("POST", NODE + "/api/documents", {})
    r.check("POST /api/documents lebt weiter (401 ohne token, nicht 404)", sc == 401, f"sc={sc}")
    # GET /api/documents/building/:ID existiert weiter -> ohne Token 401 (nicht 404).
    sc, _ = http("GET", NODE + "/api/documents/building/x")
    r.check("GET /api/documents/building/:ID lebt weiter (401, nicht 404)", sc == 401, f"sc={sc}")
