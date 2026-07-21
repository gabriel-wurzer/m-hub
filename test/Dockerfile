FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
# node --test runs every *.test.mjs; exit code propagates to CI.
CMD ["node", "--test"]
