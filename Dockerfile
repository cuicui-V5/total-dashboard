# Multi-stage build for optimal image size and security
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code and config
COPY . .

# Build Vite frontend assets
RUN npm run build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3344
ENV UPTIME_KUMA_DB_PATH=/data/kuma.db

# Copy package definitions and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built frontend assets from builder stage
COPY --from=builder /app/dist ./dist

# Copy backend server code
COPY server ./server

# Expose default port
EXPOSE 3344

CMD ["node", "server/index.js"]
