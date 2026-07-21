FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
ENV UPLOAD_DIR=/data/tus
EXPOSE 3300
CMD ["node", "dist/index.js"]
