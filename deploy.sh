#!/usr/bin/env bash
#
# Build and deploy the m-hub stack with Docker.
# Works on Linux and on Windows under Git Bash.
#
set -euo pipefail

cd "$(dirname "$0")"

# -------- Preflight --------
if [ ! -f .env ]; then
  echo "[ERROR] .env missing. Copy .env.example to .env and configure." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] docker not found in PATH." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "[ERROR] docker daemon not running." >&2
  exit 1
fi

# -------- Compose CLI detection --------
# Prefer the Compose v2 plugin ('docker compose'); fall back to the
# legacy standalone 'docker-compose' binary if that's all that's installed.
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
  echo "[INFO] Using legacy 'docker-compose' binary. Consider upgrading to the Compose v2 plugin."
else
  echo "[ERROR] Neither 'docker compose' (v2 plugin) nor 'docker-compose' (legacy) found." >&2
  exit 1
fi

# -------- Angular environment.ts bootstrap --------
ENV_TS="m-hub-frontend/src/environments/environment.ts"
ENV_TEMPLATE="m-hub-frontend/src/environments/environment.template.ts"
if [ ! -f "$ENV_TS" ] && [ -f "$ENV_TEMPLATE" ]; then
  echo "[INIT] $ENV_TS missing - copying from template."
  echo "       Edit it to set a real mapboxToken if you need Mapbox working."
  cp "$ENV_TEMPLATE" "$ENV_TS"
fi

# -------- Platform hint for PostGIS on ARM --------
ARCH=$(uname -m 2>/dev/null || echo "")
if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
  echo "[INFO] ARM host detected - forcing DOCKER_PLATFORM=linux/amd64 for PostGIS."
  export DOCKER_PLATFORM=linux/amd64
fi

# -------- Build --------
echo "[BUILD] Building all Docker images..."
$DC build

# -------- Teardown existing stack --------
echo "[CLEANUP] Removing old containers and volumes..."
$DC down -v --remove-orphans

# -------- DB first --------
echo "[START] Postgres..."
$DC up -d m-hub-db

echo "[WAIT] For Postgres to be ready..."
$DC exec -T m-hub-db \
  sh -c 'until pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do sleep 2; done'
echo "[OK] Postgres accepting connections."

# -------- GeoPackage import --------
echo "[IMPORT] GeoPackage into Postgres..."
if ! $DC run --rm gdal; then
  echo "[ERROR] GeoPackage import failed. Check ./data/mhub_wien.gpkg exists." >&2
  $DC logs --tail 200 m-hub-db >&2 || true
  exit 1
fi
echo "[OK] GeoPackage import finished."

# -------- Remaining services --------
echo "[START] Backend, Frontend, Postgis-API and SeaweedFS..."
$DC up -d seaweed-filer m-hub-postgis-api m-hub-backend m-hub-frontend

echo
echo "[OK] Stack deployed."
echo "     Frontend: http://localhost/"
echo "     Logs:     ${DC} logs -f"
