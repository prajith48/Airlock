# Installation Guide

Complete installation instructions for Airlock.

## Prerequisites

- **Node.js** 18.0.0 or higher
- **npm** 9.0.0 or higher
- **Git** (for cloning the repository)
- **Docker** (optional, for containerized deployment)

## Quick Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/airlock.git
cd airlock
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build the Project

```bash
npm run build
```

### 4. Verify Installation

```bash
node dist/cli.js --help
```

You should see the Airlock CLI help message.

## Installation Methods

### Method 1: Local Development

Best for development and testing:

```bash
# Clone and install
git clone https://github.com/yourusername/airlock.git
cd airlock
npm install
npm run build

# Run directly
node dist/cli.js guard --port 3000 npm run dev
```

### Method 2: Global Installation

Install Airlock globally to use the `airlock` command anywhere:

```bash
cd airlock
npm link
```

Now you can use `airlock` from any directory:

```bash
airlock guard --port 3000 npm run dev
```

### Method 3: Docker

Use Docker for isolated, reproducible deployments:

```bash
# Build the image
docker build -t airlock:latest .

# Run with Docker Compose
docker-compose up
```

See the [Docker Guide](../guides/docker.md) for complete Docker documentation.

## Verification

### Test the Installation

```bash
# Start the guard with test server
./scripts/start.sh

# In another terminal, test the endpoint
curl http://localhost:3000

# Stop
./scripts/stop.sh
```

### Run Tests

```bash
npm test
```

### Check Version

```bash
node dist/cli.js --version
```

## Troubleshooting

### "Command not found"

If `npm link` doesn't work:
```bash
# Add to your PATH manually
export PATH="$PATH:$(pwd)/dist"
```

### Port Already in Use

```bash
# Find what's using the port
lsof -i :3000

# Kill it
kill $(lsof -t -i:3000)
```

### Build Errors

```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

### Permission Errors

```bash
# Fix script permissions
chmod +x scripts/*.sh
```

## Next Steps

- **Quick Start**: See [Quick Start Guide](quickstart.md)
- **Architecture**: Understand the system in [Architecture Overview](../architecture/overview.md)
- **Docker**: Deploy with [Docker Guide](../guides/docker.md)
- **Demo**: Run the [Attack Demonstration](../demo/attack-demo.md)

---

[Back to documentation index](../README.md)
