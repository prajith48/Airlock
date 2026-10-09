# Multi-stage Dockerfile for Airlock
# Optimized for production deployment with security best practices

# Stage 1: Build
FROM node:22-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./
COPY tsconfig.json ./
COPY vitest.config.ts ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci && \
    npm cache clean --force

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Stage 1.5: Production dependencies
FROM node:22-alpine AS deps

WORKDIR /app

COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 2: Production
FROM node:22-alpine

# Add security labels
LABEL maintainer="Airlock Security" \
      description="Local-first security layer for development servers" \
      version="1.0.0" \
      org.opencontainers.image.source="https://github.com/yourusername/airlock" \
      org.opencontainers.image.documentation="https://github.com/yourusername/airlock/blob/main/README.md"

# Security hardening
RUN apk add --no-cache dumb-init && \
    apk upgrade --no-cache

# Create non-root user
RUN addgroup -g 1001 airlock && \
    adduser -D -u 1001 -G airlock airlock

WORKDIR /app

# Copy built files from builder
COPY --from=builder --chown=airlock:airlock /app/dist ./dist
COPY --from=deps --chown=airlock:airlock /app/node_modules ./node_modules
COPY --from=builder --chown=airlock:airlock /app/package.json ./

# Copy test server and attack demo for demonstration
COPY --chown=airlock:airlock test-server.js ./
COPY --chown=airlock:airlock attack-demo ./attack-demo

# Create directories for logs and runtime data
RUN mkdir -p /app/logs /tmp/airlock && \
    chown -R airlock:airlock /app/logs /tmp/airlock

# Switch to non-root user
USER airlock

# Expose ports
# 3000 - Airlock Guard proxy (default public port)
# 8888 - Attack demo server (optional)
EXPOSE 3000 8888

# Health check - more robust version
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http = require('http'); \
    http.get('http://localhost:3000', (r) => { \
      process.exit(r.statusCode >= 200 && r.statusCode < 500 ? 0 : 1); \
    }).on('error', () => process.exit(1));"

# Use dumb-init for proper signal handling
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Default command - show help
CMD ["node", "dist/cli.js", "--help"]

# Example usage:
# Build:
#   docker build -t airlock:latest .
#
# Run Guard (protecting a test server):
#   docker run -it --rm -p 3000:3000 airlock node dist/cli.js guard --port 3000 node test-server.js
#
# Run Secret Gate:
#   docker run -it --rm -v $(pwd)/.env:/app/.env airlock node dist/cli.js secret-gate start --env /app/.env
#
# Run MCP Watch:
#   docker run -it --rm -v $(pwd):/workspace airlock node dist/cli.js mcp-watch --root /workspace npx @modelcontextprotocol/server-filesystem /workspace
