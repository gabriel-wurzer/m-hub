# m-hub-postgis-api/Dockerfile
FROM node:22-slim

# Install git (needed for npm GitHub installs)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Create and set working directory
WORKDIR /usr/src/app

# Copy package definition and install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy source code
COPY . .

# Expose port
EXPOSE 3002

# Default command
CMD ["npm", "start"]
