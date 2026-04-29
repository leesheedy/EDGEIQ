FROM node:20-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./
RUN npm ci --only=production=false

# Copy and build backend
COPY backend/ .
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
