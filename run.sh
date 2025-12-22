#!/usr/bin/env bash

# Exit on unbound variables
set -u

# -------- helpers --------
error_exit() {
  echo "[FEHLER] $1"
  exit 1
}

ok() {
  echo "[OK] $1"
}

# -------- Environment check --------
if [ ! -f .env ]; then
  echo "[FEHLER] .env fehlt. hint: Kopiere .env.example und bennene es zu .env um."
  exit 1
fi

# -------- Platform detection (arm64) --------
ARCH=$(uname -m)

if [[ "$ARCH" == "arm64" ]]; then
  echo "[INFO] arm64 erkannt – erzwinge linux/amd64 PostGIS image"
  export DOCKER_PLATFORM=linux/amd64
fi

# -------- Docker check --------
if ! command -v docker >/dev/null 2>&1; then
  error_exit "docker ist derzeit nicht installiert. hint: https://www.docker.com/products/docker-desktop"
fi
ok "docker gefunden"

if ! docker info >/dev/null 2>&1; then
  error_exit "docker ist derzeit nicht gestartet. hint: Docker Desktop starten"
fi
ok "docker ist gestartet"

# -------- npm check --------
if ! command -v npm >/dev/null 2>&1; then
  error_exit "npm ist derzeit nicht installiert. hint: https://nodejs.org/en/download/prebuilt-binaries"
fi
ok "npm gefunden"

# -------- Angular CLI check --------
if ! command -v ng >/dev/null 2>&1; then
  error_exit "ng ist derzeit nicht installiert. hint: npm install -g @angular/cli"
fi
ok "ng gefunden"

echo

# -------- Backend install --------
echo "[INSTALL] Backend..."
(
  cd m-hub-backend/data \
  && npm install --legacy-peer-deps
) || error_exit "Backend npm install fehlgeschlagen"

# -------- Frontend install + build --------
echo "[INSTALL] Frontend..."
(
  cd m-hub-frontend \
  && npm install \
  && ng build
) || error_exit "Frontend build fehlgeschlagen"

# -------- Cleanup --------
echo "[CLEANUP] Remove old containers and volumes..."
docker compose down -v --remove-orphans

# -------- Start DB --------
echo "[START] Postgres database..."
docker compose up --build -d m-hub-db || error_exit "Postgres container konnte nicht gestartet werden"

# -------- Wait for DB --------
echo "[WAIT] Waiting for Postgres database to be ready..."
if ! docker compose exec -T m-hub-db sh -c \
  'until pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do sleep 2; done'
then
  echo "[FEHLER] Postgres did not become ready. See logs:"
  docker compose logs --tail 200 m-hub-db
  exit 1
fi
ok "Postgres accepting connections."

# -------- Import GeoPackage --------
echo "[IMPORT] GeoPackage into Postgres database..."
if ! docker compose run --rm gdal; then
  error_exit "Datenimport fehlgeschlagen"
fi
ok "GeoPackage import finished."

# -------- Start all services --------
echo "[START] Backend, Frontend and Postgis-API..."
docker compose up --build m-hub-postgis-api m-hub-backend m-hub-frontend

echo
echo "[DONE] m-hub successfully started."


