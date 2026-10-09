#!/bin/bash

# Airlock Stop Script
# Stops all running Airlock processes and cleans up

echo "🛑 Stopping Airlock..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Kill Airlock guard processes
GUARD_PIDS=$(pgrep -f "airlock guard" || true)
if [ -n "$GUARD_PIDS" ]; then
    echo "Stopping Airlock Guard processes..."
    kill $GUARD_PIDS 2>/dev/null || true
    echo -e "${GREEN}✓ Guard stopped${NC}"
fi

# Kill Secret Gate processes
SECRET_PIDS=$(pgrep -f "airlock secret-gate" || true)
if [ -n "$SECRET_PIDS" ]; then
    echo "Stopping Secret Gate processes..."
    kill $SECRET_PIDS 2>/dev/null || true
    echo -e "${GREEN}✓ Secret Gate stopped${NC}"
fi

# Kill test server if running
TEST_PIDS=$(pgrep -f "test-server.js" || true)
if [ -n "$TEST_PIDS" ]; then
    echo "Stopping test server..."
    kill $TEST_PIDS 2>/dev/null || true
    echo -e "${GREEN}✓ Test server stopped${NC}"
fi

# Clean up socket
SOCKET_PATH="/tmp/airlock-secrets.sock"
if [ -S "$SOCKET_PATH" ]; then
    echo "Cleaning up socket..."
    rm "$SOCKET_PATH"
    echo -e "${GREEN}✓ Socket cleaned${NC}"
fi

# Free port 3000 if anything else is using it
PORT_3000_PIDS=$(lsof -t -i:3000 2>/dev/null || true)
if [ -n "$PORT_3000_PIDS" ]; then
    echo -e "${YELLOW}⚠ Other processes still using port 3000${NC}"
    echo "PIDs: $PORT_3000_PIDS"
    read -p "Kill them too? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill $PORT_3000_PIDS 2>/dev/null || true
        echo -e "${GREEN}✓ Port 3000 freed${NC}"
    fi
fi

echo ""
echo -e "${GREEN}✓ Airlock stopped successfully${NC}"
