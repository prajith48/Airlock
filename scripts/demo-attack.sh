#!/bin/bash

# Attack Demonstration Script
# Shows the difference between protected and unprotected servers

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${RED}${BOLD}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║    AIRLOCK SECURITY DEMONSTRATION                        ║"
echo "║    DNS Rebinding Attack: Before & After                  ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${YELLOW}⚠️  WARNING: This demonstrates real attack vectors${NC}"
echo -e "${YELLOW}   Use only in controlled environments for education${NC}"
echo ""

# Check if ports are available
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${RED}✗ Port $1 is in use${NC}"
        return 1
    fi
    return 0
}

echo -e "${CYAN}📋 Pre-flight checks...${NC}"
if ! check_port 3000; then
    echo "  Killing processes on port 3000..."
    kill $(lsof -t -i:3000) 2>/dev/null || true
    sleep 1
fi

if ! check_port 8888; then
    echo "  Killing processes on port 8888..."
    kill $(lsof -t -i:8888) 2>/dev/null || true
    sleep 1
fi

echo -e "${GREEN}✓ Ports available${NC}"
echo ""

# Build Airlock
echo -e "${CYAN}📦 Building Airlock...${NC}"
npm run build >/dev/null 2>&1
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${RED}${BOLD}PHASE 1: UNPROTECTED SERVER (Vulnerable)${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Starting vulnerable test server on port 3000...${NC}"
echo -e "${RED}This server accepts ANY Host header (DANGEROUS!)${NC}"
echo ""

# Start unprotected server
node test-server.js &
VICTIM_PID=$!
sleep 2

echo -e "${GREEN}✓ Vulnerable server running (PID: $VICTIM_PID)${NC}"
echo ""

echo -e "${RED}${BOLD}Starting attacker server on port 8888...${NC}"
node attack-demo/attacker-server.js &
ATTACKER_PID=$!
sleep 2

echo ""
echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}${BOLD}⚠️  ATTACK SCENARIO 1: Unprotected Server${NC}"
echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}1. Open your browser to: ${BOLD}http://127.0.0.1:8888/attack${NC}"
echo -e "${CYAN}2. Click 'Start Attack Demo'${NC}"
echo -e "${CYAN}3. Watch the attack ${RED}${BOLD}SUCCEED${NC}${CYAN} - data is stolen!${NC}"
echo ""
echo -e "${RED}The attacker can read your localhost:3000 service!${NC}"
echo ""
read -p "Press Enter when you've seen the attack succeed..."

echo ""
echo -e "${YELLOW}Stopping unprotected scenario...${NC}"
kill $VICTIM_PID 2>/dev/null || true
kill $ATTACKER_PID 2>/dev/null || true
sleep 2

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}PHASE 2: AIRLOCK PROTECTED SERVER (Secure)${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}Starting Airlock Guard (DNS rebinding protection enabled)...${NC}"
echo ""

# Start Airlock protected server
node dist/cli.js guard --port 3000 node test-server.js &
AIRLOCK_PID=$!
sleep 3

echo ""
echo -e "${GREEN}✓ Airlock Guard running (PID: $AIRLOCK_PID)${NC}"
echo ""

echo -e "${RED}${BOLD}Restarting attacker server...${NC}"
node attack-demo/attacker-server.js &
ATTACKER_PID=$!
sleep 2

echo ""
echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}✓ ATTACK SCENARIO 2: Airlock Protected Server${NC}"
echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}1. Open your browser to: ${BOLD}http://127.0.0.1:8888/attack${NC}"
echo -e "${CYAN}2. Click 'Start Attack Demo' again${NC}"
echo -e "${CYAN}3. Watch the attack ${GREEN}${BOLD}FAIL${NC}${CYAN} - Airlock blocks it!${NC}"
echo ""
echo -e "${GREEN}${BOLD}Airlock validates the Host header and drops malicious requests!${NC}"
echo ""
read -p "Press Enter when you've seen Airlock block the attack..."

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}                    DEMONSTRATION COMPLETE                  ${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${GREEN}${BOLD}✓ Airlock successfully prevented DNS rebinding attack!${NC}"
echo ""
echo -e "${CYAN}Key Differences:${NC}"
echo -e "  ${RED}Without Airlock:${NC} Attacker reads localhost:3000 freely"
echo -e "  ${GREEN}With Airlock:${NC}    Connection dropped, attack fails"
echo ""

echo -e "${YELLOW}Cleaning up...${NC}"
kill $AIRLOCK_PID 2>/dev/null || true
kill $ATTACKER_PID 2>/dev/null || true
sleep 1

echo -e "${GREEN}✓ All processes stopped${NC}"
echo ""
echo -e "${CYAN}Learn more: See README.md and ARCHITECTURE.md${NC}"
