#!/usr/bin/env bash
#
# Schema-Drift-Pruefung fuer m-hub. NUR LESEND, aendert nichts.
#
# Hintergrund: Postgres fuehrt m-hub-db/init/*.sql nur einmal aus, auf leerem
# Volume. prod behaelt sein pgdata ueber jeden Deploy, jede spaetere Aenderung
# kommt also nur per Hand dorthin (bewusste Entscheidung, siehe
# m-hub-db/SCHEMA-AENDERUNGEN.md). Damit das nicht unbemerkt auseinanderlaeuft,
# vergleicht dieses Skript die laufende DB gegen ein frisch initialisiertes
# Wegwerf-Postgres aus demselben init-Ordner.
#
# Verglichen werden Spalten (Name + Typ) sowie Indizes und Constraints.
# Tabellen, die nicht aus dem init stammen (GeoPackage-Import, bp-Vorhersage),
# bleiben aussen vor.
#
# Usage:
#   ./deploy/schema-check.sh            gegen den lokalen Stack
#   ./deploy/schema-check.sh prod       gegen ein Ziel aus targets.conf (via ssh)
#
# Exit 0 = kein Drift, Exit 1 = Abweichungen (werden aufgelistet).
set -euo pipefail
cd "$(dirname "$0")"

TARGET="${1:-local}"
DB_CONT="${SCHEMA_CHECK_DB_CONT:-m-hub-m-hub-db-1}"
DB_USER="${SCHEMA_CHECK_DB_USER:-postgres}"
DB_NAME="${SCHEMA_CHECK_DB_NAME:-mhubdb}"

REF_IMAGE="m-hub-db-schemacheck"
REF_CONT="m-hub-schemacheck-$$"
WORK=$(mktemp -d)
cleanup() {
  docker rm -f "$REF_CONT" >/dev/null 2>&1 || true
  docker image rm "$REF_IMAGE" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

# Tabellen, die das init NICHT anlegt: kommen aus dem GeoPackage-Import bzw. der
# Bauperioden-Vorhersage und wuerden sonst als "nur auf prod" auftauchen.
SKIP="'spatial_ref_sys','buildings_details','buildingblocks','building_period_prediction'"

SQL_COLS="SELECT table_name||'.'||column_name||':'||data_type FROM information_schema.columns WHERE table_schema='public' AND table_name NOT IN ($SKIP) ORDER BY 1;"
SQL_IDX="SELECT 'IDX '||tablename||' :: '||indexdef FROM pg_indexes WHERE schemaname='public' AND tablename NOT IN ($SKIP) UNION ALL SELECT 'CON '||conrelid::regclass||' :: '||conname||' :: '||pg_get_constraintdef(oid) FROM pg_constraint WHERE connamespace='public'::regnamespace AND conrelid::regclass::text NOT IN ($SKIP) ORDER BY 1;"

# --- Zugriff auf das Ziel: lokal per docker exec, sonst per ssh --------------
if [ "$TARGET" = "local" ]; then
  TARGET_LABEL="lokaler Stack ($DB_CONT)"
  query_target() { docker exec "$DB_CONT" psql -U "$DB_USER" -d "$DB_NAME" -tAc "$1"; }
else
  CONF="targets.conf"
  [ -f "$CONF" ] || { echo "[ERROR] $CONF nicht gefunden." >&2; exit 1; }
  SPEC=$(grep -E "^[[:space:]]*${TARGET}[[:space:]]*=" "$CONF" | head -1 | sed -E 's/^[^=]*=[[:space:]]*//')
  [ -n "$SPEC" ] || { echo "[ERROR] Unbekanntes Ziel: $TARGET" >&2; exit 1; }
  SSH_DEST="${SPEC%%:*}"
  TARGET_LABEL="$TARGET ($SSH_DEST)"
  query_target() { ssh -o BatchMode=yes "$SSH_DEST" "docker exec $DB_CONT psql -U $DB_USER -d $DB_NAME -tAc \"$1\""; }
fi

echo "=========================================================="
echo " m-hub Schema-Check"
echo "   Ziel     : $TARGET_LABEL"
echo "   Referenz : frisches Postgres aus m-hub-db/init"
echo "=========================================================="

# --- Referenz hochziehen ----------------------------------------------------
echo "[ref] Baue Referenz-Image..."
docker build -q -t "$REF_IMAGE" ../m-hub-db >/dev/null

echo "[ref] Starte Wegwerf-Container..."
docker run -d --name "$REF_CONT" \
  -e POSTGRES_PASSWORD=schemacheck -e POSTGRES_USER="$DB_USER" -e POSTGRES_DB="$DB_NAME" \
  "$REF_IMAGE" >/dev/null

echo "[ref] Warte auf den init-Durchlauf..."
DEADLINE=$((SECONDS + 180))
until docker logs "$REF_CONT" 2>&1 | grep -q 'PostgreSQL init process complete'; do
  if [ "$SECONDS" -gt "$DEADLINE" ]; then
    echo "[ERROR] init wurde in 180s nicht fertig. Letzte Logzeilen:" >&2
    docker logs --tail 30 "$REF_CONT" >&2 || true
    exit 1
  fi
  sleep 2
done
sleep 2   # der Server startet nach dem init einmal neu

# --- Auslesen und vergleichen -----------------------------------------------
norm() { tr -d '\r' | sed '/^$/d; s/^\xef\xbb\xbf//' | sort; }

docker exec "$REF_CONT" psql -U "$DB_USER" -d "$DB_NAME" -tAc "$SQL_COLS" | norm > "$WORK/ref_cols"
docker exec "$REF_CONT" psql -U "$DB_USER" -d "$DB_NAME" -tAc "$SQL_IDX"  | norm > "$WORK/ref_idx"
query_target "$SQL_COLS" | norm > "$WORK/tgt_cols"
query_target "$SQL_IDX"  | norm > "$WORK/tgt_idx"

DRIFT=0
report() {   # $1 = Ueberschrift, $2 = ref-Datei, $3 = ziel-Datei
  local only_target only_ref
  only_target=$(comm -13 "$2" "$3" || true)
  only_ref=$(comm -23 "$2" "$3" || true)
  echo
  echo "--- $1: Referenz $(wc -l < "$2" | tr -d ' ') / Ziel $(wc -l < "$3" | tr -d ' ') ---"
  if [ -z "$only_target" ] && [ -z "$only_ref" ]; then
    echo "    keine Abweichung"
    return
  fi
  DRIFT=1
  if [ -n "$only_ref" ]; then
    echo "    FEHLT AUF DEM ZIEL (steht im init):"
    echo "$only_ref" | sed 's/^/      /'
  fi
  if [ -n "$only_target" ]; then
    echo "    NUR AUF DEM ZIEL (kennt das init nicht):"
    echo "$only_target" | sed 's/^/      /'
  fi
}

report "Spalten" "$WORK/ref_cols" "$WORK/tgt_cols"
report "Indizes und Constraints" "$WORK/ref_idx" "$WORK/tgt_idx"

echo
if [ "$DRIFT" -eq 0 ]; then
  echo "[OK] Kein Drift."
else
  echo "[DRIFT] Abweichungen gefunden. Vorgehen siehe m-hub-db/SCHEMA-AENDERUNGEN.md:"
  echo "        init-SQL und prod von Hand nachziehen, Eingriff dort protokollieren."
  exit 1
fi
