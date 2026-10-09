# Airlock Testing Guide

This guide shows you how to test each component of Airlock.

## Prerequisites

```bash
# Build the project first
npm run build

# Optionally link it globally (so you can use 'airlock' command)
npm link
```

---

## Component A: Dev Server Guard Testing

### Basic Test

1. **Start the guard with the test server:**
   ```bash
   node dist/cli.js guard --port 3000 node test-server.js
   ```

2. **Open your browser:**
   - Visit: `http://localhost:3000`
   - You should see the test page with green "✓ Dev Server Running!"

3. **Check the logs:**
   The terminal will show:
   - Proxy startup message
   - Test server startup on a random internal port
   - Request logs when you access the page

### Security Test - Valid Requests

```bash
# These should work (valid Host headers):
curl http://localhost:3000
curl http://127.0.0.1:3000
curl -H "Origin: http://localhost:3000" http://localhost:3000
```

### Security Test - Attack Simulation

```bash
# These should be BLOCKED and connection dropped:

# Invalid Host header (simulating DNS rebinding)
curl -H "Host: attacker.com" http://localhost:3000

# Invalid Origin header
curl -H "Host: localhost:3000" -H "Origin: http://attacker.com" http://localhost:3000

# External domain trying to access
curl -H "Host: evil.example.com" http://127.0.0.1:3000
```

**Expected behavior:** Connection drops immediately, no 403 response (for security)

### Watch the Logs

Blocked requests appear in `airlock.log`:
```bash
# In another terminal, tail the log file:
tail -f airlock.log
```

You'll see entries like:
```json
{"level":"warn","msg":"Invalid Host header detected","host":"attacker.com"}
{"level":"warn","msg":"Request blocked by validation, dropping connection"}
```

---

## Component B: MCP Watch Testing

This monitors AI agent file access. Testing requires an MCP server setup.

### Quick Test Setup

1. **Install the MCP filesystem server:**
   ```bash
   npm install -g @modelcontextprotocol/server-filesystem
   ```

2. **Run MCP Watch wrapper:**
   ```bash
   node dist/cli.js mcp-watch --root /home/Prajith/PROGRAMMING/Airlock npx @modelcontextprotocol/server-filesystem /home/Prajith/PROGRAMMING/Airlock
   ```

3. **Simulate MCP tool calls:**
   
   The watcher reads JSON-RPC from stdin. You can test by sending:
   ```bash
   echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"read_file","arguments":{"path":"../../../etc/passwd"}},"id":1}' | node dist/cli.js mcp-watch --root /home/Prajith/PROGRAMMING/Airlock cat
   ```

4. **Check logs:**
   ```bash
   tail -f airlock.log
   ```
   
   You should see warnings for:
   - Path traversal attempts (`../` escaping project root)
   - Sensitive file access (`.ssh`, `.env`, etc.)

### Real-World Test

To test with Claude Desktop:

1. Edit `~/.config/claude/claude_desktop_config.json` (Linux) or equivalent:
   ```json
   {
     "mcpServers": {
       "filesystem-secure": {
         "command": "/home/Prajith/PROGRAMMING/Airlock/dist/cli.js",
         "args": [
           "mcp-watch",
           "--root", "/home/Prajith/PROGRAMMING/Airlock",
           "npx", "-y", "@modelcontextprotocol/server-filesystem",
           "/home/Prajith/PROGRAMMING/Airlock"
         ]
       }
     }
   }
   ```

2. Restart Claude Desktop

3. Ask Claude to read files - watch `airlock.log` for monitoring

---

## Component C: Secret Gate Testing

### Test the Broker

1. **Create a test .env file:**
   ```bash
   cat > test.env << EOF
   API_KEY=secret_test_key_12345
   DATABASE_URL=postgresql://user:pass@localhost/db
   SECRET_TOKEN=super_secret_token
   EOF
   ```

2. **Start the secret gate daemon:**
   ```bash
   node dist/cli.js secret-gate start --env test.env
   ```

   The daemon will:
   - Load secrets into memory
   - Delete the original test.env file
   - Start listening on a UNIX socket

3. **Test fetching secrets** (in another terminal):
   
   Create a test client script:
   ```bash
   cat > test-client.js << 'EOF'
   import { getSecrets } from './dist/secretgate/client.js';

   (async () => {
     try {
       const secrets = await getSecrets(['API_KEY', 'DATABASE_URL', 'SECRET_TOKEN']);
       console.log('✓ Retrieved secrets:', secrets);
     } catch (err) {
       console.error('✗ Failed:', err.message);
     }
   })();
   EOF
   
   node test-client.js
   ```

4. **Verify the original file was wiped:**
   ```bash
   cat test.env
   # Should not exist or be empty
   ```

---

## Monitoring Dashboard (DIY)

While Airlock doesn't have a GUI, you can monitor it in real-time:

### Terminal Dashboard Setup

```bash
# Terminal 1: Run Airlock component
node dist/cli.js guard --port 3000 node test-server.js

# Terminal 2: Watch logs with color highlighting
tail -f airlock.log | jq -C '.'

# Terminal 3: Test attacks/requests
curl http://localhost:3000
curl -H "Host: attacker.com" http://localhost:3000
```

### Log Viewing with `pino-pretty`

For prettier logs:
```bash
# Install globally
npm install -g pino-pretty

# Watch logs with formatting
tail -f airlock.log | pino-pretty
```

### Simple Web Dashboard (Optional)

You could build a simple log viewer:

```bash
# Watch logs and serve them via HTTP
tail -f airlock.log | while read line; do echo "$line"; done &
python3 -m http.server 8080
# Then create an HTML page that fetches and displays the logs
```

---

## Automated Testing

Run the test suite:
```bash
npm test                 # Run all tests
npm run test:coverage    # With coverage report
npm run test:ui          # Interactive UI (if vitest UI is working)
```

---

## Quick Demo Script

Here's a complete demo you can run:

```bash
#!/bin/bash
# demo.sh - Complete Airlock demonstration

echo "=== Building Airlock ==="
npm run build

echo -e "\n=== Starting Dev Server Guard on port 3000 ==="
node dist/cli.js guard --port 3000 node test-server.js &
GUARD_PID=$!
sleep 2

echo -e "\n=== Testing Valid Request ==="
curl -s http://localhost:3000 | head -n 20

echo -e "\n\n=== Testing Attack (Invalid Host) ==="
curl -v -H "Host: attacker.com" http://localhost:3000 2>&1 | grep -A5 "Host:"

echo -e "\n\n=== Checking Logs ==="
tail -n 10 airlock.log | jq '.'

echo -e "\n=== Cleanup ==="
kill $GUARD_PID
```

---

## Expected Output Examples

### Successful Request
```
{"level":"info","msg":"Dev Server Guard active: 127.0.0.1:3000 → 127.0.0.1:54321"}
```

### Blocked Attack
```
{"level":"warn","host":"attacker.com","msg":"Invalid Host header detected"}
{"level":"warn","msg":"Request blocked by validation, dropping connection"}
```

### Path Traversal Detection
```
{"level":"warn","path":"../../../etc/passwd","msg":"Path traversal attempt detected"}
```
