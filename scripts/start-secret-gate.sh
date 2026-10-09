#!/bin/bash

# Airlock Secret Gate Start Script
# Loads secrets from .env and starts the broker

set -e

echo "🔐 Starting Airlock Secret Gate..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

ENV_FILE="${1:-.env}"

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚠ Warning: $ENV_FILE not found${NC}"
    echo ""
    echo "Starting with empty keystore. Secrets can be loaded later."
    echo ""
fi

# Clean up old socket if it exists
SOCKET_PATH="/tmp/airlock-secrets.sock"
if [ -S "$SOCKET_PATH" ]; then
    echo -e "${YELLOW}⚠ Cleaning up old socket at $SOCKET_PATH${NC}"
    rm "$SOCKET_PATH"
    echo -e "${GREEN}✓ Socket cleaned${NC}"
    echo ""
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

# Start Secret Gate broker
echo "🚀 Starting Secret Gate broker..."
echo ""
node dist/cli.js secret-gate start --env "$ENV_FILE"
