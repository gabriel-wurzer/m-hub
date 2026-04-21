# ---- Build stage: compile Angular ----
FROM node:20-alpine AS build
WORKDIR /app
ARG MAPBOX_TOKEN=""

# git is required to resolve the 'gitlab:jkuebart/Leaflet.VectorTileLayer'
# dependency in package.json. Rewrite SSH->HTTPS so no SSH key is needed.
RUN apk add --no-cache git \
 && git config --global url."https://gitlab.com/".insteadOf "ssh://git@gitlab.com/"

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN node -e 'const fs=require("fs"); const token=process.argv[1] || ""; fs.writeFileSync("src/environments/environment.production.ts", `export const environment = {\n  production: true,\n  mapboxToken: ${JSON.stringify(token)}\n};\n`);' "$MAPBOX_TOKEN"
RUN npm run build

# ---- Serve stage: nginx ----
FROM nginx:1.27-alpine

COPY --from=build /app/dist/m-hub-frontend/browser/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
