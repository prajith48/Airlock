#!/bin/bash
# Airlock - Real-Time Security Monitor
# Tails airlock.log and formats events with color-coded output

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

LOG_FILE="${1:-airlock.log}"

clear

echo -e "${CYAN}${BOLD}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║        AIRLOCK — REAL-TIME SECURITY MONITOR             ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "  ${DIM}Started:${NC} $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "  ${DIM}Watching:${NC} ${BOLD}${LOG_FILE}${NC}"
echo ""
echo -e "  ${GREEN}✔ INFO${NC}   Normal operation"
echo -e "  ${YELLOW}⚠ WARN${NC}   Security event"
echo -e "  ${RED}✘ ERROR${NC}  System error"
echo ""
echo -e "  ${CYAN}${DIM}──────────────────────────────────────────────────────────${NC}"
echo ""

# Function to pretty-print a JSON log line from pino
format_line() {
    local line="$1"

    # Try JSON parse (pino writes JSON to file)
    if echo "$line" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
        local level msg component time
        level=$(echo "$line" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('level','info'))" 2>/dev/null)
        msg=$(echo "$line" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('msg',''))" 2>/dev/null)
        component=$(echo "$line" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('component',''))" 2>/dev/null)
        time=$(date '+%H:%M:%S')

        # Map pino numeric levels to labels
        case "$level" in
            10|"trace") level="TRACE" ;;
            20|"debug") level="DEBUG" ;;
            30|"info")  level="INFO"  ;;
            40|"warn")  level="WARN"  ;;
            50|"error") level="ERROR" ;;
            60|"fatal") level="FATAL" ;;
        esac

        case "$level" in
            INFO)
                echo -e "  ${GREEN}✔${NC}  ${DIM}[${time}]${NC} ${DIM}[${component}]${NC} ${msg}"
                ;;
            WARN)
                echo -e "  ${YELLOW}⚠${NC}  ${DIM}[${time}]${NC} ${DIM}[${component}]${NC} ${YELLOW}${msg}${NC}"

                # Highlight specific security events
                if echo "$line" | grep -q "Invalid Host"; then
                    local host
                    host=$(echo "$line" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('host','?'))" 2>/dev/null)
                    echo -e "          ${RED}→ DNS rebinding blocked — Host: ${host}${NC}"
                elif echo "$line" | grep -q "Invalid Origin"; then
                    local origin
                    origin=$(echo "$line" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('origin','?'))" 2>/dev/null)
                    echo -e "          ${RED}→ Cross-origin attack blocked — Origin: ${origin}${NC}"
                elif echo "$line" | grep -q "Path traversal"; then
                    local path
                    path=$(echo "$line" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('path','?'))" 2>/dev/null)
                    echo -e "          ${RED}→ Path traversal detected — Path: ${path}${NC}"
                elif echo "$line" | grep -q "Sensitive path"; then
                    local path
                    path=$(echo "$line" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('path','?'))" 2>/dev/null)
                    echo -e "          ${MAGENTA}→ Sensitive file access — Path: ${path}${NC}"
                elif echo "$line" | grep -q "Suspicious MCP"; then
                    local tool
                    tool=$(echo "$line" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool','?'))" 2>/dev/null)
                    echo -e "          ${MAGENTA}→ Suspicious MCP tool call — Tool: ${tool}${NC}"
                fi
                ;;
            ERROR|FATAL)
                echo -e "  ${RED}✘${NC}  ${DIM}[${time}]${NC} ${DIM}[${component}]${NC} ${RED}${msg}${NC}"
                ;;
            *)
                echo -e "  ${DIM}·${NC}  ${DIM}[${time}]${NC} ${msg}"
                ;;
        esac
    else
        # Fallback: print raw line dimmed
        echo -e "  ${DIM}${line}${NC}"
    fi
}

# Create log file if it doesn't exist
touch "$LOG_FILE"

echo -e "  ${MAGENTA}⏳ Waiting for events — keep this open while Airlock runs...${NC}"
echo ""

# Stream and format
while IFS= read -r line; do
    [ -z "$line" ] && continue
    format_line "$line"
done < <(tail -f "$LOG_FILE")
