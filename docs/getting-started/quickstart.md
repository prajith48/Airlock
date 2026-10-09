# Airlock - Quick Start Guide

Get Airlock running in 30 seconds!

## 🚀 Fastest Way to Start

```bash
# Clone and setup
git clone <your-repo-url>
cd Airlock
npm install
npm run build

# Start Airlock (easiest)
./start.sh
```

That's it! Airlock is now protecting your dev server at `http://127.0.0.1:3000`

---

## 📋 All Startup Options

### Option 1: Shell Scripts (Recommended)

**Start Airlock Guard**
```bash
./start.sh              # Production build + start
./start-dev.sh          # Fast dev mode (no build)
```

**Start Attack Demo**
```bash
./attack-demo/demo-attack.sh    # Full automated demo
```

**Start Secret Gate**
```bash
./start-secret-gate.sh          # With default .env
./start-secret-gate.sh my.env   # Custom env file
```

**Stop Everything**
```bash
./stop.sh               # Stops all Airlock processes
```

---

### Option 2: NPM Scripts

```bash
# Guard
npm run guard           # Build + start with test server
npm run guard:dev       # Fast dev mode (uses tsx)
npm run quick:guard     # Skip build, just run

# Secret Gate
npm run secret-gate     # Build + start
npm run quick:secret-gate  # Skip build

# MCP Watch
npm run mcp-watch       # Build + start MCP watcher

# Utilities
npm run build           # Build TypeScript
npm run clean           # Remove dist and sockets
```

---

### Option 3: Docker (Production)

```bash
# Using Docker Compose (easiest)
docker-compose up                  # Start all services
docker-compose up airlock-guard    # Start only guard
docker-compose down                # Stop all

# Using Docker directly
docker build -t airlock .
docker run -it --rm -p 3000:3000 airlock \
  node dist/cli.js guard --port 3000 node test-server.js
```

See [DOCKER.md](DOCKER.md) for detailed Docker usage.

---

### Option 4: Direct CLI

```bash
# Build first
npm run build

# Then run any component
node dist/cli.js guard --port 3000 node test-server.js
node dist/cli.js guard --port 8080 npm run dev
node dist/cli.js mcp-watch --root . your-mcp-command
node dist/cli.js secret-gate start --env .env

# Or install globally
npm link
airlock guard --port 3000 npm run dev
```

---

## 🎯 See The Attack Demo

**Automated (Easiest)**
```bash
./attack-demo/demo-attack.sh
```

**Manual Steps:**
```bash
# Terminal 1: Start attacker
node attack-demo/attacker-server.js

# Terminal 2: WITHOUT Airlock (vulnerable)
node test-server.js
# Browser: http://127.0.0.1:8888/attack
# Result: All data stolen! 💀

# Terminal 2: WITH Airlock (protected)
./start.sh
# Browser: http://127.0.0.1:8888/attack  
# Result: All attacks blocked! 🛡️
```

---

## 🛠️ Common Scenarios

**Just want to test Airlock?**
```bash
./start.sh
# Opens on http://127.0.0.1:3000
```

**Port 3000 already in use?**
```bash
./stop.sh                   # Stops all Airlock
# or
kill $(lsof -t -i:3000)    # Kill specific port
# or
node dist/cli.js guard --port 8080 node test-server.js
```

**Want to protect your own dev server?**
```bash
# Replace "node test-server.js" with your command
./start.sh  # Edit script, or:
node dist/cli.js guard --port 3000 npm run dev
node dist/cli.js guard --port 3000 yarn start
```

**Developing Airlock itself?**
```bash
npm run guard:dev   # Auto-reload with tsx
```

---

## 🐛 Troubleshooting

### Port Already in Use

**Error:** `EADDRINUSE: address already in use`

**Fix:**
```bash
./stop.sh                      # Use stop script
# or manually
lsof -i :3000                  # Find what's using it
kill $(lsof -t -i:3000)        # Kill it
```

### Permission Denied

**Error:** `EACCES: permission denied`

**Fix:** Use port > 1024 or run with sudo (not recommended)
```bash
airlock guard --port 8000 npm run dev
```

### Command Not Found

**Error:** `tsx: command not found` or `airlock: command not found`

**Fix:**
```bash
npm install           # Reinstall dependencies
npm run build         # Rebuild
npm link              # Link CLI globally (optional)
```

### Docker Issues

**Port conflicts:**
```bash
docker-compose down   # Stop all containers
docker ps             # Check running containers
```

**Build issues:**
```bash
docker-compose build --no-cache
docker system prune   # Clean up
```

---

## 📚 Next Steps

- **See the attack:** `./attack-demo/demo-attack.sh`
- **Read architecture:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Deploy with Docker:** [DOCKER.md](DOCKER.md)
- **Run tests:** `npm test`
- **View logs:** Check `airlock.log` or [MONITORING.md](MONITORING.md)

---

## 💡 Pro Tips

1. **First time?** Run `./start.sh` - handles everything
2. **Developing?** Use `npm run guard:dev` for fast iteration
3. **Done?** Always run `./stop.sh` to clean up
4. **Port conflicts?** Scripts auto-detect and help resolve
5. **Docker?** Use `docker-compose up` for easy deployment

---

**Need Help?**
- Check [README.md](README.md) for full documentation
- See [TESTING.md](TESTING.md) for test suite
- Read [attack-demo/README.md](attack-demo/README.md) for attack details

