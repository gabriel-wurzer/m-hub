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

# -------- node-red /data perms --------
# Handled inside the m-hub-backend image: a root entrypoint chowns the bind-mounted
# /data to node-red (uid 1000) then drops privileges (su-exec) before starting
# node-red. Runs on every `up` incl. the mhub.service boot path. No host-side chmod.

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

# -------- Building period prediction (ML snapshot) --------
# Separate table, so the gdal buildings_details re-import above does not wipe it.
# Snapshot keyed on bw_geb_id, tied to the current mhub_wien.gpkg; regenerate if
# the dataset changes. Load is idempotent (TRUNCATE + COPY).
PRED_GZ="m-hub-db/building_period_prediction.csv.gz"
if [ -f "$PRED_GZ" ]; then
  echo "[DB] Loading building period prediction..."
  $DC exec -T m-hub-db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
CREATE TABLE IF NOT EXISTS building_period_prediction (
  bw_geb_id varchar(10) PRIMARY KEY,
  bp5       smallint NOT NULL,   -- 1 bis1918, 2 1919-44, 3 1945-79, 4 1980-99, 5 ab2000
  coarse3   text     NOT NULL,   -- vertrauenswuerdige Grobklasse (bis 1918 / 1919-1945 / nach 1945)
  source    text     NOT NULL,   -- known_bp | known_coarse | predicted
  conf      real     NOT NULL,   -- Konfidenz der bp5-Zuordnung (1.0 = bekannt)
  p_bp3     real, p_bp4 real, p_bp5 real  -- Nachkriegs-Subwahrscheinlichkeiten (weiche Nutzung)
);
TRUNCATE building_period_prediction;
SQL
  gunzip -c "$PRED_GZ" | $DC exec -T m-hub-db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\copy building_period_prediction FROM STDIN WITH (FORMAT csv, HEADER true)"'
  echo "[OK] Building period prediction loaded."
else
  echo "[SKIP] $PRED_GZ missing; skipping period prediction load."
fi

# -------- Remaining services --------
echo "[START] Backend, Upload, Frontend, Postgis-API and SeaweedFS..."
$DC up -d seaweed-filer m-hub-postgis-api m-hub-backend m-hub-upload m-hub-frontend m-hub-plausibility m-hub-point2ifc

echo
echo "[OK] Stack deployed."
echo "     Frontend: http://localhost:8910/karte"
echo "     Logs:     ${DC} logs -f"
