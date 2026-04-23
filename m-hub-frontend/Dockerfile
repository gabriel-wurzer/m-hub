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

# ---- Serve stage: nginx ----
FROM nginx:alpine

COPY --from=build /app/dist/m-hub-frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Angular's build output can end up with umask-dependent modes the nginx
# worker user cannot read. Normalize: everyone can read files, traverse dirs.
RUN chmod -R a+rX /usr/share/nginx/html

EXPOSE 8080
