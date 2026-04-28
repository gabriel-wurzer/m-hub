FROM nodered/node-red:latest

# Install /data dependencies (node-red palette nodes + libs used by settings.js)
# directly into the image's /data/node_modules.
#
# At runtime /data is a host bind-mount which would normally shadow this, but
# docker-compose layers a named volume on top of /data/node_modules so the
# image-installed deps survive. See docker-compose.yaml for the volume.
COPY --chown=node-red:node-red data/package.json data/package-lock.json /data/
RUN cd /data && npm install --legacy-peer-deps --no-audit --no-fund
