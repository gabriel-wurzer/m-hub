#!/usr/bin/env bash
#
# Build and deploy the m-hub stack with Docker.
# Works on Linux and on Windows under Git Bash.
#
# By default this preserves user data (Postgres + SeaweedFS + node-red flows).
# Pass --reset to wipe ALL named volumes and start with a clean slate
# (useful for the very first deploy or for full recovery).
#
set -euo pipefail

cd "$(dirname "$0")"

RESET=0
for arg in "$@"; do
  case "$arg" in
    --reset|-r) RESET=1 ;;
    -h|--help)
      echo "Usage: $0 [--reset]"
      echo "  --reset, -r   Wipe all named volumes (pgdata, seaweed_data, backend deps)."
      echo "                Without this flag, user data is preserved across deploys."
      exit 0
      ;;
    *) echo "[WARN] Unknown argument: $arg (use --help)" >&2 ;;
  esac
done

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

# -------- Host-side perms for bind-mounted node-red data --------
# The node-red container runs as UID 1000 and bind-mounts ./m-hub-backend/data.
# Ensure those files are readable+writable by that UID regardless of the host's
# umask (Photon OS defaults can produce 0600 files the container can't open).
if [ -d m-hub-backend/data ]; then
  chmod -R a+rwX m-hub-backend/data
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
# Default: keep data volumes (pgdata, seaweed_data) so user content survives.
# Always refresh the backend deps volume so package.json updates propagate
# from the freshly built image (named volumes are only initialised once).
if [ "$RESET" -eq 1 ]; then
  echo "[CLEANUP] --reset: removing old containers AND ALL volumes (data loss!)..."
  $DC down -v --remove-orphans
else
  echo "[CLEANUP] Removing old containers (data volumes preserved)..."
  $DC down --remove-orphans
  echo "[CLEANUP] Refreshing backend deps volume so new package.json takes effect..."
  docker volume rm m-hub_m-hub-backend-deps >/dev/null 2>&1 || true
fi

# -------- DB first --------
echo "[START] Postgres..."
$DC up -d m-hub-db

echo "[WAIT] For Postgres to be ready..."
DEADLINE=$((SECONDS + 60))
until $DC exec -T m-hub-db \
        sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; do
  if [ "$SECONDS" -gt "$DEADLINE" ]; then
    echo "[ERROR] Postgres did not become ready within 60s. Recent logs:" >&2
    $DC logs --tail 100 m-hub-db >&2 || true
    exit 1
  fi
  sleep 2
done
echo "[OK] Postgres accepting connections."

# -------- GeoPackage import --------
echo "[IMPORT] GeoPackage into Postgres..."
if ! $DC run --rm gdal; then
  echo "[ERROR] GeoPackage import failed. Check ./data/mhub_wien.gpkg exists." >&2
  $DC logs --tail 200 m-hub-db >&2 || true
  exit 1
fi
echo "[OK] GeoPackage import finished."

echo "[DB] Creating spatial indexes..."
$DC exec -T m-hub-db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE INDEX IF NOT EXISTS idx_buildings_details_geom_geography ON public.buildings_details USING GIST ((geom::geography));"'
echo "[OK] Spatial indexes ready."

# -------- Remaining services --------
echo "[START] Backend, Upload, Frontend, Postgis-API and SeaweedFS..."
$DC up -d seaweed-filer m-hub-postgis-api m-hub-backend m-hub-upload m-hub-frontend

echo
echo "[OK] Stack deployed."
echo "     Frontend: http://localhost:8910/karte"
echo "     Logs:     ${DC} logs -f"
