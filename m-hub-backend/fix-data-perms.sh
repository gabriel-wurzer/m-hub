#!/bin/sh
set -e
# Runs as root at container start. node-red's /data userDir is a git-tracked,
# root-owned bind mount; hand any root-owned files there to node-red (uid 1000)
# so it can write flows.json / .config / lib, then drop privileges and hand off
# to node-red's own entrypoint. Keeps node-red non-root and fixes perms on every
# start - deploy.sh AND the mhub.service boot path (docker-compose up -d).
find /data -not -user node-red -exec chown node-red:node-red {} + 2>/dev/null || true
exec su-exec node-red:node-red ./entrypoint.sh "$@"
