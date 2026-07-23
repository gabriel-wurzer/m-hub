FROM node:20-alpine AS build
WORKDIR /app
# "/" standalone; "/plantool/" when served under m-hub's /plantool path.
ARG BASE_HREF="/"
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build -- --base-href="$BASE_HREF"

FROM nginx:alpine
COPY --from=build /app/dist/m-hub-planimport-frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
