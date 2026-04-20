FROM nodered/node-red:latest

# settings.js in /data (bind-mounted at runtime) does `require('bcrypt')` etc.
# The bind mount shadows anything we'd install into /data from the image, so
# we install those deps into a separate path and expose it via NODE_PATH.
USER root
RUN mkdir -p /opt/data-deps && chown node-red:node-red /opt/data-deps
USER node-red
COPY --chown=node-red:node-red data/package.json data/package-lock.json /opt/data-deps/
RUN cd /opt/data-deps && npm install --legacy-peer-deps --no-audit --no-fund
