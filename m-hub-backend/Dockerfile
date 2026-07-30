FROM nodered/node-red:latest

# Install /data dependencies (node-red palette nodes + libs used by settings.js)
# directly into the image's /data/node_modules.
#
# At runtime /data is a host bind-mount which would normally shadow this, but
# docker-compose layers a named volume on top of /data/node_modules so the
# image-installed deps survive. See docker-compose.yaml for the volume.
COPY --chown=node-red:node-red data/package.json data/package-lock.json /data/
RUN cd /data && npm install --legacy-peer-deps --no-audit --no-fund

# node-red runs as its own user (uid 1000), but its bind-mounted /data userDir is
# a git-tracked, root-owned checkout it must WRITE (flows.json, .config, lib/). A
# root entrypoint chowns /data to node-red then drops privileges via su-exec, so
# perms are fixed on EVERY start (deploy.sh AND the mhub.service boot path) without
# running node-red as root and without a chmod sidecar.
USER root
RUN apk add --no-cache su-exec
COPY fix-data-perms.sh /usr/local/bin/fix-data-perms
RUN chmod +x /usr/local/bin/fix-data-perms
ENTRYPOINT ["/usr/local/bin/fix-data-perms"]
