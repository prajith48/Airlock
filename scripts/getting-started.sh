#!/bin/bash
# Airlock - Complete Getting Started Guide
# This script walks you through testing everything we built

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

clear

echo -e "${BLUE}${BOLD}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║              AIRLOCK - GETTING STARTED GUIDE                  ║
║           Interactive Walkthrough & Testing Suite             ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${CYAN}Welcome! This script will walk you through testing Airlock.${NC}"
echo -e "${CYAN}We'll cover three main components:${NC}"
echo ""
echo -e "  ${GREEN}1.${NC} Dev Server Guard (DNS rebinding protection)"
echo -e "  ${GREEN}2.${NC} Attack Demonstration (showing what Airlock blocks)"
echo -e "  ${GREEN}3.${NC} Docker Deployment (easy sharing)"
echo ""
read -p "Press Enter to begin..."

# ═══════════════════════════════════════════════════════════════
# STEP 1: Environment Check
# ═══════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}STEP 1: Checking Your Environment${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Check Node.js
echo -n "Checking Node.js... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Found: $NODE_VERSION${NC}"

    # Check version is 18+
    NODE_MAJOR=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -lt 18 ]; then
        echo -e "${YELLOW}⚠ Warning: Node.js 18+ recommended (you have v$NODE_MAJOR)${NC}"
    fi
else
    echo -e "${RED}✗ Node.js not found${NC}"
    echo "Please install Node.js 18+ from: https://nodejs.org/"
    exit 1
fi

# Check npm
echo -n "Checking npm... "
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓ Found: $NPM_VERSION${NC}"
else
    echo -e "${RED}✗ npm not found${NC}"
    exit 1
fi

# Check Docker (optional)
echo -n "Checking Docker... "
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
    echo -e "${GREEN}✓ Found: $DOCKER_VERSION${NC}"
    DOCKER_AVAILABLE=true
else
    echo -e "${YELLOW}⚠ Not found (optional for local testing)${NC}"
    DOCKER_AVAILABLE=false
fi

echo ""
echo -e "${GREEN}✓ Environment check complete!${NC}"
read -p "Press Enter to continue..."

# ═══════════════════════════════════════════════════════════════
# STEP 2: Install Dependencies
# ═══════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}STEP 2: Installing Dependencies${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [ ! -d "node_modules" ]; then
    echo "Installing npm packages (this may take a minute)..."
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi

echo ""
read -p "Press Enter to continue..."

# ═══════════════════════════════════════════════════════════════
# STEP 3: Build the Project
# ═══════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}STEP 3: Building Airlock${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [ ! -d "dist" ] || [ ! -f "dist/cli.js" ]; then
    echo "Building TypeScript source..."
    npm run build
    echo -e "${GREEN}✓ Build complete${NC}"
else
    echo -e "${GREEN}✓ Already built${NC}"
    echo -n "Rebuild? [y/N]: "
    read rebuild
    if [ "$rebuild" = "y" ] || [ "$rebuild" = "Y" ]; then
        npm run build
        echo -e "${GREEN}✓ Rebuilt${NC}"
    fi
fi

echo ""
read -p "Press Enter to continue..."

# ═══════════════════════════════════════════════════════════════
# STEP 4: Choose What to Test
# ═══════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}STEP 4: What Would You Like to Test?${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""

echo "Choose an option:"
echo ""
echo -e "  ${GREEN}1)${NC} ${BOLD}Quick Test${NC} - Start Airlock and access it in browser (2 minutes)"
echo "     → Fastest way to see Airlock working"
echo ""
echo -e "  ${GREEN}2)${NC} ${BOLD}Full Attack Demo${NC} - Automated before/after demonstration (5 minutes)"
echo "     → See attacks succeed without Airlock, fail with Airlock"
echo ""
echo -e "  ${GREEN}3)${NC} ${BOLD}Docker Test${NC} - Test Docker deployment (3 minutes)"
echo "     → Verify Docker setup for easy sharing"
echo ""
echo -e "  ${GREEN}4)${NC} ${BOLD}Manual Exploration${NC} - I'll guide you through manual testing"
echo "     → Most flexible, for hands-on learning"
echo ""
echo -e "  ${GREEN}5)${NC} Exit"
echo ""
echo -n "Enter choice [1-5]: "
read choice

case $choice in
    1)
        # Quick Test
        echo ""
        echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
        echo -e "${BOLD}Quick Test: Starting Airlock${NC}"
        echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
        echo ""

        # Check if port 3000 is available
        if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
            echo -e "${YELLOW}Port 3000 is in use. Killing existing process...${NC}"
            kill $(lsof -t -i:3000) 2>/dev/null || true
            sleep 2
        fi

        echo "Starting Airlock Guard (protecting test server on port 3000)..."
        echo ""
        echo -e "${CYAN}This will:${NC}"
        echo "  1. Start a test development server"
        echo "  2. Wrap it with Airlock's DNS rebinding protection"
        echo "  3. Open it on http://localhost:3000"
        echo ""
        echo -e "${GREEN}In your browser, visit: ${BOLD}http://localhost:3000${NC}"
        echo ""
        echo -e "${CYAN}Try clicking the endpoints to see the test data.${NC}"
        echo -e "${CYAN}These endpoints would be vulnerable WITHOUT Airlock!${NC}"
        echo ""
        echo -e "${YELLOW}Press Ctrl+C when done to stop.${NC}"
        echo ""

        ./start.sh
        ;;

    2)
        # Full Attack Demo
        echo ""
        echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
        echo -e "${BOLD}Full Attack Demonstration${NC}"
        echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
        echo ""

        echo -e "${CYAN}This demo shows:${NC}"
        echo "  ${RED}Phase 1:${NC} Unprotected server → Attacker STEALS data"
        echo "  ${GREEN}Phase 2:${NC} Airlock protected → Attacker BLOCKED"
        echo ""
        echo -e "${YELLOW}The demo will:${NC}"
        echo "  • Start an unprotected server"
        echo "  • Start an attacker server"
        echo "  • Ask you to visit the attack page in your browser"
        echo "  • Show you data being stolen in real-time"
        echo "  • Then protect with Airlock and show attacks blocked"
        echo ""
        read -p "Ready to begin? Press Enter..."

        ./attack-demo/demo-attack.sh
        ;;

    3)
        # Docker Test
        if [ "$DOCKER_AVAILABLE" = false ]; then
            echo ""
            echo -e "${RED}Docker is not installed.${NC}"
            echo "Install Docker from: https://docs.docker.com/get-docker/"
            exit 1
        fi

        echo ""
        echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
        echo -e "${BOLD}Docker Deployment Test${NC}"
        echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
        echo ""

        echo "Testing Docker setup..."
        echo ""

        # Run verification script
        if [ -f "verify-docker-setup.sh" ]; then
            chmod +x verify-docker-setup.sh
            ./verify-docker-setup.sh
        fi

        echo ""
        echo -e "${CYAN}Would you like to:${NC}"
        echo -e "  ${GREEN}1)${NC} Build Docker image (takes 2-3 minutes)"
        echo -e "  ${GREEN}2)${NC} Skip build (just show commands)"
        echo ""
        echo -n "Enter choice [1-2]: "
        read docker_choice

        if [ "$docker_choice" = "1" ]; then
            echo ""
            echo "Building Docker image..."
            docker build -t airlock:latest .
            echo ""
            echo -e "${GREEN}✓ Docker image built successfully!${NC}"
            echo ""
            echo -e "${CYAN}Test the image:${NC}"
            echo "  docker run -p 3000:3000 airlock node dist/cli.js guard --port 3000 node test-server.js"
            echo ""
            echo -e "${CYAN}Or use Docker Compose:${NC}"
            echo "  docker-compose up"
            echo ""
        else
            echo ""
            echo -e "${CYAN}Docker commands you can run:${NC}"
            echo ""
            echo "Build:"
            echo "  docker build -t airlock:latest ."
            echo ""
            echo "Run:"
            echo "  docker-compose up"
            echo ""
            echo "With attack demo:"
            echo "  docker-compose --profile demo up"
            echo ""
        fi

        echo -e "${GREEN}See DOCKER.md for complete documentation.${NC}"
        ;;

    4)
        # Manual Exploration
        echo ""
        echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
        echo -e "${BOLD}Manual Exploration Guide${NC}"
        echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
        echo ""

        echo -e "${CYAN}Here's how to explore Airlock manually:${NC}"
        echo ""

        echo -e "${BOLD}1. Start Airlock Guard:${NC}"
        echo "   ./start.sh"
        echo "   OR: node dist/cli.js guard --port 3000 node test-server.js"
        echo ""

        echo -e "${BOLD}2. Access the protected server:${NC}"
        echo "   Open browser to: http://localhost:3000"
        echo ""

        echo -e "${BOLD}3. Test legitimate access (should work):${NC}"
        echo "   curl http://localhost:3000/api/secrets"
        echo ""

        echo -e "${BOLD}4. Try a DNS rebinding attack (should be blocked):${NC}"
        echo "   curl -H \"Host: evil.com\" http://localhost:3000/api/secrets"
        echo "   → Connection will be dropped (no response)"
        echo ""

        echo -e "${BOLD}5. Test with the attacker server:${NC}"
        echo "   Terminal 1: ./start.sh"
        echo "   Terminal 2: node attack-demo/attacker-server.js"
        echo "   Browser: http://127.0.0.1:8888/attack"
        echo "   → Click 'Start Attack Demo' and watch attacks fail"
        echo ""

        echo -e "${BOLD}6. Check the logs:${NC}"
        echo "   tail -f airlock.log"
        echo ""

        echo -e "${CYAN}Key Files to Explore:${NC}"
        echo "  • README.md - Main documentation"
        echo "  • ARCHITECTURE.md - How Airlock works"
        echo "  • DOCKER.md - Docker deployment"
        echo "  • attack-demo/README.md - Attack details"
        echo "  • COMPLETION_SUMMARY.md - What we built"
        echo ""
        ;;

    5)
        echo ""
        echo -e "${GREEN}Goodbye!${NC}"
        exit 0
        ;;

    *)
        echo ""
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}Next Steps${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${CYAN}Learn More:${NC}"
echo "  • Full documentation: cat README.md"
echo "  • Architecture details: cat ARCHITECTURE.md"
echo "  • Docker deployment: cat DOCKER.md"
echo "  • What we built: cat COMPLETION_SUMMARY.md"
echo ""

echo -e "${CYAN}Quick Commands:${NC}"
echo "  • Start Airlock: ./start.sh"
echo "  • Stop Airlock: ./stop.sh"
echo "  • Run attack demo: ./attack-demo/demo-attack.sh"
echo "  • Docker: docker-compose up"
echo ""

echo -e "${GREEN}✓ Getting started guide complete!${NC}"
echo ""
