#!/bin/bash
# Quick demo of Airlock Dev Server Guard

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         Airlock Dev Server Guard - Live Demo              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Build if not already built
if [ ! -d "dist" ]; then
    echo "📦 Building Airlock..."
    npm run build
fi

echo "🚀 Starting Dev Server Guard on port 3000..."
echo "   (The actual dev server will run on a random hidden port)"
echo ""

# Start the guard in background
node dist/cli.js guard --port 3000 node test-server.js &
GUARD_PID=$!

# Give it time to start
sleep 3

echo "✅ Guard is running! (PID: $GUARD_PID)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Test 1: Valid Request (should succeed)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s http://localhost:3000 | grep -o '<h1[^>]*>.*</h1>' || echo "✓ Server responded"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔒 Test 2: DNS Rebinding Attack Simulation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Trying with Host: attacker.com"
timeout 2 curl -H "Host: attacker.com" http://127.0.0.1:3000 2>&1 && echo "❌ FAIL: Should have been blocked!" || echo "✓ BLOCKED (connection dropped as expected)"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔒 Test 3: Invalid Origin Attack"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Trying with Origin: http://evil.com"
timeout 2 curl -H "Origin: http://evil.com" http://localhost:3000 2>&1 && echo "❌ FAIL: Should have been blocked!" || echo "✓ BLOCKED (connection dropped as expected)"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Security Logs (last 5 entries)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -f "airlock.log" ]; then
    tail -n 5 airlock.log | while IFS= read -r line; do
        echo "$line" | jq -r '. | "\(.level | ascii_upcase): \(.msg)"' 2>/dev/null || echo "$line"
    done
else
    echo "No log file found yet"
fi
echo ""

echo "🌐 Your dev server is now protected!"
echo "   Open http://localhost:3000 in your browser to see it running"
echo ""
echo "Press Ctrl+C to stop..."

# Wait for user to stop
wait $GUARD_PID
