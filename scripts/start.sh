#!/bin/bash

# Airlock Quick Start Script
# Builds and runs Airlock Guard with the test server

set -e

echo "🔒 Starting Airlock..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if port 3000 is in use
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${YELLOW}⚠ Port 3000 is already in use${NC}"
    echo ""
    echo "Processes using port 3000:"
    lsof -i :3000
    echo ""
    read -p "Kill these processes and continue? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Killing processes on port 3000..."
        kill $(lsof -t -i:3000) 2>/dev/null || true
        sleep 1
        echo -e "${GREEN}✓ Port 3000 freed${NC}"
    else
        echo "Aborted. Choose a different port with: node dist/cli.js guard --port <PORT> node test-server.js"
        exit 1
    fi
fi

# Build the project
echo "📦 Building Airlock..."
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build successful${NC}"
echo ""

# Start Airlock Guard with test server
echo "🚀 Starting Airlock Guard on port 3000..."
echo ""
node dist/cli.js guard --port 3000 node test-server.js
