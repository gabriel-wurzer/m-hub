#!/usr/bin/env bash
#
# Fetch latest sources from git. Works on Linux and on Windows under Git Bash.
#
set -euo pipefail

cd "$(dirname "$0")"

echo "[PULL] Fetching latest changes from git..."
git pull --ff-only

echo
echo "[OK] Sources updated."
echo
echo "NOTE: For a fresh checkout (or if the building dataset changed), follow the"
echo "      README to download mhub_wien.gpkg into ./data/. Without that file the"
echo "      GeoPackage import step of deploy.sh will fail."
