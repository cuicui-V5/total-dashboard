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

# Install tzdata and set timezone to China Standard Time (Asia/Shanghai, CST, UTC+8)
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

ENV TZ=Asia/Shanghai
ENV NODE_ENV=production
ENV PORT=3344

# Copy package definitions and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built frontend assets from builder stage
COPY --from=builder /app/dist ./dist

# Copy backend server code
COPY server ./server

# Create persistent data directory for SQLite timeseries
RUN mkdir -p /app/data
ENV DATA_DIR=/app/data
VOLUME ["/app/data"]

# Expose default port
EXPOSE 3344

CMD ["node", "server/index.js"]
