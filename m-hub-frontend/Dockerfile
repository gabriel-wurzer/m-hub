# ---- Build stage: compile Angular ----
FROM node:20-alpine AS build
WORKDIR /app

# git is required to resolve the 'gitlab:jkuebart/Leaflet.VectorTileLayer'
# dependency in package.json. Rewrite SSH->HTTPS so no SSH key is needed.
RUN apk add --no-cache git \
 && git config --global url."https://gitlab.com/".insteadOf "ssh://git@gitlab.com/"

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Serve stage: busybox httpd ----
FROM lipanski/docker-static-website:latest

# Built Angular bundle + httpd config go next to each other so that
# busybox-httpd finds httpd.conf automatically from its CWD (/home/static).
COPY --from=build /app/dist/m-hub-frontend/browser /home/static
COPY httpd.conf /home/static/httpd.conf

EXPOSE 8080
CMD ["/busybox-httpd", "-f", "-v", "-p", "8080"]
