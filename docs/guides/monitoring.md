# 🎯 How to Run and Monitor Airlock

## TL;DR - Quick Start (30 seconds)

```bash
# 1. Build the project
npm run build

# 2. Run the demo (Terminal 1)
./demo.sh

# 3. Watch security events in real-time (Terminal 2)
./monitor.sh

# 4. Open browser
# Visit: http://localhost:3000
```

---

## 📺 Monitoring Options

### ⭐ Option 1: Live Dashboard (RECOMMENDED)

**Terminal 1:** Run Airlock
```bash
node dist/cli.js guard --port 3000 node test-server.js
```

**Terminal 2:** Monitor with color-coded security events
```bash
./monitor.sh
```

**What you'll see:**
```
╔════════════════════════════════════════════════════════════╗
║          AIRLOCK - REAL-TIME SECURITY MONITOR              ║
╚════════════════════════════════════════════════════════════╝

Legend:
  ✓ INFO  - Normal operation
  ⚠ WARN  - Security event detected  
  ✗ ERROR - System error

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[14:52:30] ✓ INFO  Dev Server Guard active: 127.0.0.1:3000 → 127.0.0.1:43639
[14:52:35] ⚠ WARN  Invalid Host header detected
           → Blocked DNS rebinding attempt from: attacker.com
[14:52:36] ⚠ WARN  Request blocked by validation, dropping connection
```

### Option 2: JSON Logs

```bash
tail -f airlock.log | jq -C '.'
```

### Option 3: Pretty Logs

```bash
tail -f airlock.log | npx pino-pretty
```

---

## 🧪 Testing It Works

### Test 1: Normal Request (Should Work)
```bash
curl http://localhost:3000
# ✓ You'll see: <h1 class="success">✓ Dev Server Running!</h1>
```

### Test 2: DNS Rebinding Attack (Should Block)
```bash
curl -H "Host: attacker.com" http://127.0.0.1:3000
# ✗ Connection drops immediately, monitor shows: "⚠ WARN Blocked DNS rebinding"
```

### Test 3: Cross-Origin Attack (Should Block)
```bash
curl -H "Origin: http://evil.com" http://localhost:3000  
# ✗ Connection drops, monitor shows: "⚠ WARN Invalid Origin header"
```

---

## 🌐 Browser Testing

1. **Start Airlock:**
   ```bash
   node dist/cli.js guard --port 3000 node test-server.js
   ```

2. **Open browser:** `http://localhost:3000`

3. **You should see:** A green checkmark page saying "✓ Dev Server Running!"

4. **Check monitor:** Shows the request was validated and allowed

---

## 📊 What Gets Monitored

| Event Type | What It Means | Monitor Shows |
|------------|---------------|---------------|
| Valid Request | Normal traffic | `✓ INFO` (green) |
| DNS Rebinding | Attack blocked | `⚠ WARN → Blocked DNS rebinding from: attacker.com` (yellow/red) |
| Cross-Origin | Attack blocked | `⚠ WARN → Blocked cross-origin attack from: http://evil.com` (yellow/red) |
| Path Traversal | MCP violation | `⚠ WARN → Path traversal attempt: ../../../etc/passwd` (yellow/red) |
| Sensitive File | MCP violation | `⚠ WARN → Sensitive file access: .ssh/id_rsa` (yellow/red) |

---

## 🎬 Complete Demo Walkthrough

```bash
# Terminal 1: Start Airlock with the test server
npm run build
node dist/cli.js guard --port 3000 node test-server.js

# You'll see:
# ✓ INFO: Spawning child dev server on port 43639
# ✓ INFO: Dev Server Guard active: 127.0.0.1:3000 → 127.0.0.1:43639
# Test server listening on 127.0.0.1:43639
```

```bash
# Terminal 2: Watch security events
./monitor.sh

# You'll see the live dashboard with color-coded events
```

```bash
# Terminal 3: Test it!
curl http://localhost:3000                                    # ✓ Works
curl -H "Host: attacker.com" http://127.0.0.1:3000          # ✗ Blocked!
curl -H "Origin: http://evil.com" http://localhost:3000     # ✗ Blocked!

# Watch Terminal 2 light up with security warnings!
```

---

## 🚀 Running Your Own Dev Server

Replace `node test-server.js` with your actual dev command:

```bash
# Vite
node dist/cli.js guard --port 3000 npm run dev

# Next.js  
node dist/cli.js guard --port 3000 npm run dev

# Webpack Dev Server
node dist/cli.js guard --port 3000 webpack serve

# Any dev server
node dist/cli.js guard --port 3000 <your-command>
```

Airlock will:
1. Start your dev server on a hidden random port
2. Proxy traffic through port 3000 with security validation
3. Block DNS rebinding and cross-origin attacks automatically

---

## 📱 No GUI? Here's Why (and Alternatives)

**Airlock is CLI-first by design:**
- ✅ Works everywhere (Linux, Mac, Windows)
- ✅ Easy to integrate into workflows
- ✅ Scriptable and automatable
- ✅ Low resource usage

**But you CAN add a GUI:**

### Option A: Terminal Dashboard (Built-in)
```bash
./monitor.sh  # Color-coded live monitoring
```

### Option B: VS Code Integration
1. Install "Tail Log" extension
2. Open `airlock.log` in VS Code
3. Logs update in real-time with syntax highlighting

### Option C: Web Dashboard (DIY)
```bash
# Create a simple Node.js/Express dashboard that reads airlock.log
# and displays it in a browser with live updates via WebSocket
```

### Option D: Desktop Notifications
Add to `monitor.sh`:
```bash
if echo "$line" | grep -q "blocked"; then
    notify-send "🚨 Airlock" "Security threat blocked!"
fi
```

---

## 💡 Pro Tips

1. **Always run monitor.sh** - It's the easiest way to see what's happening
2. **Keep demo.sh handy** - Run it whenever you want to verify everything works
3. **Check airlock.log** - All events are permanently logged there
4. **Test attacks regularly** - Make sure Airlock is actually protecting you

---

## 🔍 Metrics You Can Extract

```bash
# Count blocked attacks
grep "blocked" airlock.log | wc -l

# Most common attack sources  
grep "Invalid Host" airlock.log | jq -r '.host' | sort | uniq -c

# Attack types breakdown
grep -o '"msg":"[^"]*blocked[^"]*"' airlock.log | sort | uniq -c

# Timeline of events
jq -r '.time + " | " + .level + " | " + .msg' airlock.log
```

---

## 🎯 Summary

**To run Airlock with monitoring:**
```bash
# Terminal 1
node dist/cli.js guard --port 3000 node test-server.js

# Terminal 2  
./monitor.sh
```

**To test it works:**
```bash
curl http://localhost:3000                          # Should work
curl -H "Host: evil.com" http://localhost:3000     # Should be blocked
```

**To view logs:**
```bash
./monitor.sh                              # Live dashboard
tail -f airlock.log | jq -C '.'          # Raw JSON
tail -f airlock.log | npx pino-pretty    # Pretty format
```

That's it! You now have real-time security monitoring for your dev servers! 🎉
