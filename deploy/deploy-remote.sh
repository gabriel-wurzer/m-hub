#!/usr/bin/env bash
#
# One-command remote deploy for the m-hub stack.
#
# Reads the target host from deploy/targets.conf, then on that host runs:
#   git pull --ff-only  ->  ./deploy.sh  ->  smoke-test /karte
#
# The deploy preserves data (no --reset): Postgres, SeaweedFS and node-red
# flows survive. It refuses to run if the target has uncommitted changes to
# tracked files, so it never silently discards work on the server.
#
# Usage:
#   ./deploy/deploy-remote.sh <target>     deploy to <target>
#   ./deploy/deploy-remote.sh              list configured targets
#
set -euo pipefail
cd "$(dirname "$0")"

CONF="targets.conf"
[ -f "$CONF" ] || { echo "[ERROR] $CONF not found next to this script." >&2; exit 1; }

list_targets() {
  echo "Configured targets (from $CONF):" >&2
  grep -vE '^[[:space:]]*(#|$)' "$CONF" | sed -E 's/[[:space:]]*=.*//; s/^/  /' >&2
}

TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  echo "Usage: $0 <target>" >&2
  list_targets
  exit 1
fi

SPEC=$(grep -E "^[[:space:]]*${TARGET}[[:space:]]*=" "$CONF" | head -1 | sed -E 's/^[^=]*=[[:space:]]*//')
if [ -z "$SPEC" ]; then
  echo "[ERROR] Unknown target: $TARGET" >&2
  list_targets
  exit 1
fi
SSH_DEST="${SPEC%%:*}"
REMOTE_PATH="${SPEC#*:}"

echo "=========================================================="
echo " m-hub deploy  ->  target '$TARGET'"
echo "   host: $SSH_DEST"
echo "   path: $REMOTE_PATH"
echo "=========================================================="

# All remote steps run in one SSH session. BatchMode fails fast (no password
# prompt) if key auth is not set up. The repo path is passed as $1.
ssh -o BatchMode=yes "$SSH_DEST" 'bash -s' -- "$REMOTE_PATH" <<'REMOTE'
set -euo pipefail
REPO="$1"
cd "$REPO"

# Never deploy over local edits: abort on tracked working-tree changes.
# Untracked runtime files (sessions, node-red caches) are ignored on purpose.
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "[ERROR] Tracked changes on the target - refusing to deploy:" >&2
  git status -s >&2
  echo "Resolve them on $REPO, then re-run." >&2
  exit 1
fi

echo "[git] Fetching origin..."
git fetch --quiet origin
BEFORE=$(git rev-parse --short HEAD)
git pull --ff-only
AFTER=$(git rev-parse --short HEAD)
if [ "$BEFORE" = "$AFTER" ]; then
  echo "[git] Already up to date at $AFTER."
else
  echo "[git] $BEFORE -> $AFTER"
  git --no-pager log --oneline "$BEFORE..$AFTER" | sed 's/^/       /'
fi

echo "[deploy] Running ./deploy.sh ..."
./deploy.sh

echo "[smoke] Checking frontend on localhost:8910 ..."
CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8910/karte || echo "000")
echo "[smoke] GET /karte -> HTTP $CODE"
[ "$CODE" = "200" ] || { echo "[WARN] Frontend did not return 200." >&2; exit 1; }
REMOTE

echo
echo "[OK] Deploy to '$TARGET' finished."
