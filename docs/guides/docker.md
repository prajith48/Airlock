# Docker Deployment Guide 🐳

Complete guide for deploying Airlock using Docker and Docker Compose for easy sharing and production deployment.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Docker Architecture](#docker-architecture)
- [Building the Image](#building-the-image)
- [Running Containers](#running-containers)
- [Docker Compose](#docker-compose)
- [Configuration](#configuration)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### Prerequisites

- Docker 20.10+ installed ([Get Docker](https://docs.docker.com/get-docker/))
- Docker Compose 2.0+ (included with Docker Desktop)
- 2GB free disk space for images

### Fastest Way to Run

```bash
# Clone and navigate to project
cd /path/to/Airlock

# Build the Docker image
docker-compose build

# Start protected server
docker-compose up airlock-guard

# Access at: http://localhost:3000
```

That's it! Airlock is now protecting a test development server.

---

## 🏗️ Docker Architecture

### Multi-Stage Build

The Dockerfile uses a 3-stage build for optimal image size and security:

1. **Builder Stage** - Compiles TypeScript source code
2. **Dependencies Stage** - Installs production-only dependencies
3. **Production Stage** - Minimal runtime image (Alpine Linux)

**Image Sizes:**
- Full image: ~180MB
- Base Alpine: ~50MB
- Node.js runtime: ~110MB
- Airlock code: ~20MB

### Security Features

- ✅ Non-root user (`airlock:1001`)
- ✅ Minimal Alpine Linux base
- ✅ No unnecessary build tools in production
- ✅ `dumb-init` for proper signal handling
- ✅ Health checks for container orchestration
- ✅ Security labels and metadata

---

## 🔨 Building the Image

### Basic Build

```bash
# Build with default tag
docker build -t airlock:latest .

# Build with specific version
docker build -t airlock:1.0.0 .

# Build without cache (fresh build)
docker build --no-cache -t airlock:latest .
```

### Build with Compose

```bash
# Build all services
docker-compose build

# Build specific service
docker-compose build airlock-guard

# Build with no cache
docker-compose build --no-cache
```

### Verify Build

```bash
# Check image size
docker images airlock

# Inspect image layers
docker history airlock:latest

# Verify security (non-root user)
docker run --rm airlock:latest id
# Output: uid=1001(airlock) gid=1001(airlock)
```

---

## 🏃 Running Containers

### Component A: Dev Server Guard

Protect a development server from DNS rebinding attacks.

```bash
# Run with test server (interactive)
docker run -it --rm \
  -p 3000:3000 \
  airlock:latest \
  node dist/cli.js guard --port 3000 node test-server.js

# Run in background
docker run -d \
  --name airlock-guard \
  -p 3000:3000 \
  --restart unless-stopped \
  airlock:latest \
  node dist/cli.js guard --port 3000 node test-server.js

# Custom port mapping (host:container)
docker run -it --rm \
  -p 8080:3000 \
  airlock:latest \
  node dist/cli.js guard --port 3000 node test-server.js
# Access at: http://localhost:8080
```

### Component B: MCP Watch

Monitor AI agent file operations for security violations.

```bash
# Mount your project directory
docker run -it --rm \
  -v $(pwd):/workspace \
  airlock:latest \
  node dist/cli.js mcp-watch \
    --root /workspace \
    npx -y @modelcontextprotocol/server-filesystem /workspace
```

### Component C: Secret Gate

Store secrets in memory instead of `.env` files.

```bash
# Mount your .env file
docker run -it --rm \
  -v $(pwd)/.env:/app/.env \
  -v airlock-secrets:/tmp/airlock \
  airlock:latest \
  node dist/cli.js secret-gate start --env /app/.env

# The .env file will be deleted after loading into memory
```

### View Logs

```bash
# Follow logs from running container
docker logs -f airlock-guard

# Last 100 lines
docker logs --tail 100 airlock-guard

# With timestamps
docker logs -f --timestamps airlock-guard
```

### Stop Containers

```bash
# Stop gracefully
docker stop airlock-guard

# Force stop (if hung)
docker kill airlock-guard

# Remove stopped container
docker rm airlock-guard

# Stop and remove in one command
docker rm -f airlock-guard
```

---

## 🎼 Docker Compose

Docker Compose orchestrates multiple Airlock components together.

### Configuration Profiles

The `docker-compose.yml` defines three profiles:

1. **Default** - Protected server only
2. **Demo** - Protected server + attacker demonstration
3. **Full** - All components (guard + attacker + secret gate)

### Start Services

```bash
# Default: Protected server only
docker-compose up

# With attacker demo
docker-compose --profile demo up

# All components
docker-compose --profile full up

# Detached mode (background)
docker-compose up -d

# Specific service only
docker-compose up airlock-guard
```

### Service Health

```bash
# Check service status
docker-compose ps

# Check health status
docker-compose ps airlock-guard

# View service logs
docker-compose logs -f airlock-guard
docker-compose logs -f attacker-demo
```

### Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Force recreation on next start
docker-compose down && docker-compose up --force-recreate
```

### Access Points

When running with Docker Compose:

- **Protected Server**: http://localhost:3000
- **Attacker Dashboard**: http://localhost:8888/attack (with `--profile demo`)
- **Logs**: `docker-compose logs -f`

---

## ⚙️ Configuration

### Environment Variables

Configure Airlock behavior via environment variables:

```yaml
# docker-compose.yml
services:
  airlock-guard:
    environment:
      - NODE_ENV=production       # production | development
      - LOG_LEVEL=info            # debug | info | warn | error
      - HOST=127.0.0.1            # Bind address
      - PORT=3000                 # Internal port
```

### Volume Mounts

Persist data across container restarts:

```bash
# Mount project directory (for MCP Watch)
docker run -v $(pwd):/workspace airlock ...

# Mount .env file (for Secret Gate)
docker run -v $(pwd)/.env:/app/.env airlock ...

# Named volume for logs
docker run -v airlock-logs:/app/logs airlock ...
```

### Network Configuration

Containers communicate via the `airlock-net` bridge network:

```yaml
networks:
  airlock-net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16
```

Access containers by service name:
- `http://airlock-guard:3000` (from within network)
- `http://localhost:3000` (from host machine)

---

## 🚀 Production Deployment

### Production Checklist

Before deploying Airlock to production:

- [ ] Use specific version tags (not `latest`)
- [ ] Configure resource limits
- [ ] Set up log rotation
- [ ] Configure health checks
- [ ] Use secrets management (not `.env` files)
- [ ] Enable automatic restarts
- [ ] Configure monitoring/alerting
- [ ] Review security settings

### Resource Limits

Prevent containers from consuming excessive resources:

```yaml
# docker-compose.yml
services:
  airlock-guard:
    deploy:
      resources:
        limits:
          cpus: '1.0'        # Max 1 CPU core
          memory: 512M       # Max 512MB RAM
        reservations:
          cpus: '0.5'        # Guaranteed 0.5 cores
          memory: 256M       # Guaranteed 256MB
```

Or via Docker CLI:

```bash
docker run -d \
  --name airlock-guard \
  --cpus="1.0" \
  --memory="512m" \
  -p 3000:3000 \
  airlock:latest \
  node dist/cli.js guard --port 3000 node test-server.js
```

### Log Rotation

Prevent logs from filling disk:

```yaml
services:
  airlock-guard:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"      # Max 10MB per log file
        max-file: "3"        # Keep 3 rotated files
```

### Automatic Restarts

Configure restart policy:

```yaml
services:
  airlock-guard:
    restart: unless-stopped  # Options: no | always | on-failure | unless-stopped
```

### Health Monitoring

Health checks for orchestration systems (Kubernetes, Docker Swarm):

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http = require('http'); \
    http.get('http://localhost:3000', (r) => { \
      process.exit(r.statusCode >= 200 && r.statusCode < 500 ? 0 : 1); \
    }).on('error', () => process.exit(1));"
```

Check health status:

```bash
docker inspect --format='{{.State.Health.Status}}' airlock-guard
# Output: healthy | unhealthy | starting
```

### Secrets Management

**DO NOT** commit `.env` files or embed secrets in images!

Use Docker secrets (Swarm) or mounted files:

```bash
# Create Docker secret
echo "sk-proj-MySecretKey" | docker secret create openai_key -

# Use in service
docker service create \
  --name airlock-guard \
  --secret openai_key \
  airlock:latest
```

Or mount from secure location:

```bash
docker run -d \
  -v /secure/path/.env:/app/.env:ro \
  airlock:latest \
  node dist/cli.js secret-gate start --env /app/.env
```

### Production Docker Compose

Example production configuration:

```yaml
version: '3.8'

services:
  airlock-guard:
    image: airlock:1.0.0  # Specific version, not latest
    container_name: airlock-guard-prod
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=warn
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "..."]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - airlock-net

networks:
  airlock-net:
    driver: bridge
```

---

## 🐛 Troubleshooting

### Port Already in Use

**Error:** `Error starting userland proxy: listen tcp4 0.0.0.0:3000: bind: address already in use`

**Solution:**

```bash
# Find what's using the port
lsof -i :3000

# Kill the process
kill $(lsof -t -i:3000)

# Or use a different port
docker run -p 8080:3000 airlock ...
```

### Permission Denied

**Error:** `permission denied while trying to connect to the Docker daemon socket`

**Solution:**

```bash
# Add your user to docker group
sudo usermod -aG docker $USER

# Log out and back in, or run:
newgrp docker

# Or use sudo (not recommended)
sudo docker run ...
```

### Container Exits Immediately

**Symptoms:** Container starts then immediately stops

**Diagnosis:**

```bash
# Check exit code and logs
docker ps -a
docker logs airlock-guard

# Run interactively to see errors
docker run -it --rm airlock:latest node dist/cli.js --help
```

**Common causes:**
- Command syntax error
- Missing required arguments
- Port already bound inside container

### Build Fails

**Error:** `npm ERR! code ELIFECYCLE`

**Solution:**

```bash
# Clean build (no cache)
docker build --no-cache -t airlock:latest .

# Check Node.js version in Dockerfile
grep "FROM node" Dockerfile
# Should be: FROM node:22-alpine

# Ensure you have enough disk space
docker system df
docker system prune  # Clean up unused images/containers
```

### Health Check Failing

**Symptoms:** Container shows as "unhealthy" in `docker ps`

**Diagnosis:**

```bash
# Check health check logs
docker inspect --format='{{.State.Health.Log}}' airlock-guard

# Test health check command manually
docker exec airlock-guard node -e "require('http').get('http://localhost:3000', ...)"
```

**Solutions:**
- Increase `start-period` if service is slow to start
- Check if service is actually listening on expected port
- Verify health check command syntax

### Out of Memory

**Error:** Container killed with exit code 137

**Solution:**

```bash
# Increase memory limit
docker run --memory="1g" airlock ...

# Or in docker-compose.yml:
deploy:
  resources:
    limits:
      memory: 1G
```

### Network Issues

**Error:** Containers can't communicate

**Diagnosis:**

```bash
# List networks
docker network ls

# Inspect network
docker network inspect airlock-net

# Check container network
docker inspect airlock-guard | grep -A 10 Networks
```

**Solution:**

```bash
# Recreate network
docker-compose down
docker network rm airlock-net
docker-compose up
```

### Volume Permission Issues

**Error:** `EACCES: permission denied` when accessing mounted volumes

**Solution:**

```bash
# Fix permissions on host
chmod -R 755 $(pwd)

# Or run container with same UID as host user
docker run --user $(id -u):$(id -g) ...
```

---

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [Airlock Architecture](./ARCHITECTURE.md)
- [Airlock Quick Start](./QUICKSTART.md)

---

## 🆘 Getting Help

If you encounter issues not covered here:

1. **Check logs**: `docker logs -f airlock-guard`
2. **Read the docs**: See [README.md](./README.md) and [ARCHITECTURE.md](./ARCHITECTURE.md)
3. **GitHub Issues**: Open an issue with logs and system info
4. **Community**: Join discussions on GitHub

---

## 📝 Docker Cheat Sheet

Quick reference for common Docker commands:

```bash
# Build
docker build -t airlock:latest .
docker-compose build

# Run
docker run -it --rm -p 3000:3000 airlock
docker-compose up

# Manage
docker ps                          # List running containers
docker ps -a                       # List all containers
docker logs -f <container>         # Follow logs
docker exec -it <container> sh     # Shell into container
docker stop <container>            # Stop gracefully
docker rm <container>              # Remove container

# Images
docker images                      # List images
docker rmi airlock:latest         # Remove image
docker image prune                 # Remove unused images

# System
docker system df                   # Show disk usage
docker system prune -a            # Clean up everything
```

---

**Last Updated:** 2026-09-11
