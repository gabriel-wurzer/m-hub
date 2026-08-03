"""Gemeinsame Helfer der m-hub Teststrecke.

E2E gegen den LAUFENDEN docker-compose-Stack (kein Mock). Konfiguration per Umgebungs-
variablen; Defaults zeigen auf den lokalen Stack. JWT_SECRET wird aus der .env gelesen,
damit fuer die Tests gueltige Tokens gemintet werden koennen. Nur Python-stdlib.
"""
import base64
import hashlib
import hmac
import json
import os
import subprocess
import time
import urllib.error
import urllib.request

_HERE = os.path.dirname(os.path.abspath(__file__))

# --- Konfiguration (Default = lokaler Stack) ---
DB_CONT = os.environ.get("P2I_DB_CONT", "m-hub-m-hub-db-1")
DB_USER = os.environ.get("P2I_DB_USER", "postgres")
DB_NAME = os.environ.get("P2I_DB_NAME", "mhubdb")
NODE = os.environ.get("P2I_NODE", "http://localhost:1880")
SEAWEED = os.environ.get("P2I_SEAWEED", "http://localhost:8888")
P2I = os.environ.get("P2I_P2I", "http://localhost:8972")
P2I_CONT = os.environ.get("P2I_P2I_CONT", "m-hub-m-hub-point2ifc-1")
ENV_FILE = os.environ.get("P2I_ENV", os.path.join(_HERE, "..", ".env"))
PC_FILE = os.environ.get("P2I_PC_FILE", "")  # Punktwolke fuer die Verarbeitungs-Suiten


class Results:
    """Sammelt PASS/FAIL ueber alle Suiten."""

    def __init__(self):
        self.rows = []

    def check(self, name, ok, detail=""):
        ok = bool(ok)
        self.rows.append((name, ok))
        print(("PASS " if ok else "FAIL ") + name + (("  -> " + detail) if detail else ""), flush=True)
        return ok

    def skip(self, name, reason):
        print("SKIP " + name + "  -> " + reason, flush=True)

    def passed(self):
        return sum(1 for _, ok in self.rows if ok)

    def total(self):
        return len(self.rows)


def _b64u(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=")


def b64u_decode(s):
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def jwt_secret():
    for line in open(ENV_FILE, encoding="utf-8"):
        if line.startswith("JWT_SECRET="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("JWT_SECRET nicht in " + ENV_FILE + " gefunden")


def mint(sub, secret=None, ttl=3600):
    """Signiert ein m-hub-Session-JWT (HS256) fuer den gegebenen owner (sub)."""
    secret = secret or jwt_secret()
    header = _b64u(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    now = int(time.time())
    payload = _b64u(json.dumps({"sub": sub, "iat": now, "exp": now + ttl}, separators=(",", ":")).encode())
    sig = _b64u(hmac.new(secret.encode(), header + b"." + payload, hashlib.sha256).digest())
    return (header + b"." + payload + b"." + sig).decode()


def http(method, url, data=None, token=None, ctype="application/json"):
    """HTTP-Request; gibt (status, body_bytes) zurueck, auch bei 4xx/5xx."""
    req = urllib.request.Request(url, method=method)
    if token:
        req.add_header("Authorization", "Bearer " + token)
    body = None
    if data is not None:
        body = data if isinstance(data, (bytes, bytearray)) else json.dumps(data).encode()
        if ctype:
            req.add_header("Content-Type", ctype)
    try:
        with urllib.request.urlopen(req, body, timeout=120) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def psql(sql):
    """Fuehrt SQL im DB-Container aus (psql -tAc) und gibt den getrimmten Output zurueck."""
    r = subprocess.run(
        ["docker", "exec", DB_CONT, "psql", "-U", DB_USER, "-d", DB_NAME, "-tAc", sql],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        raise RuntimeError("psql fehlgeschlagen: " + r.stderr)
    return r.stdout.strip()


def derive_identity():
    """owner_id, user_building_id, building_id aus einem Bestandsdokument ableiten
    (kein Hardcoding -> laeuft gegen lokal UND prod)."""
    row = psql(
        "SELECT owner_id||'|'||user_building_id||'|'||building_id FROM documents "
        "WHERE owner_id IS NOT NULL AND user_building_id IS NOT NULL LIMIT 1;"
    )
    if "|" not in row:
        raise SystemExit("kein Bestandsdokument, aus dem owner/ub/building abgeleitet werden kann")
    return row.split("|")
