# Airlock 🔒

**A local-first security layer for development servers and AI agent tooling built in TypeScript/Node.js.**

Airlock adds local development safeguards. It reduces specific risks, but it is not a complete endpoint-security product and does not guarantee that every attack is blocked.

## 🎯 What Airlock Protects Against

Airlock mitigates three developer-centric threat landscapes:
1. **DNS Rebinding Attacks** targeting local development servers (e.g. Vite, Webpack, Next.js).
2. **Path Traversal Violations** by AI models or MCP (Model Context Protocol) servers.
3. **Casual Credential Exposure** in plaintext `.env` files.

## 🚀 Quick Start

**See Airlock in action in 30 seconds:**

```bash
# Clone and setup
git clone https://github.com/prajith48/Airlock.git
cd airlock
npm install
npm run build

# Run the attack demo (automated)
./scripts/demo-attack.sh
```

This will show you:
1. **Before Airlock**: Attacker steals API keys, user data, credit cards 💀
2. **With Guard enabled**: malformed external Host/Origin requests are rejected 🛡️

**Or start using Airlock right away:**

```bash
# Simplest way - builds and starts with test server
./scripts/start.sh

# Development mode (fast, no build)
./scripts/start-dev.sh

# Using npm scripts
npm run guard        # Build + start
npm run guard:dev    # Dev mode (fast)
```

---

## Architecture Overview

```
                         ┌───────────────────────────────┐
                         │        AIRLOCK CLI            │
                         │   (single command: airlock)   │
                         └──────────────┬────────────────┘
                                         │
              ┌──────────────────────────┼────────────────────────────┐
              │                          │                            │
    ┌─────────▼──────────┐    ┌───────────▼────────────┐   ┌──────────▼───────────┐
    │  A. Dev Server     │    │  B. MCP Watch          │   │  C. Secret Gate      │
    │  Guard             │    │  (passive logger)      │   │  (secrets broker)    │
    │                    │    │                        │   │                      │
    │ Reverse proxy      │    │ Sidecar process reading│   │ Local daemon holding │
    │ localhost:3000 →   │    │ MCP stdio traffic      │   │ env values in memory,│
    │ hidden dev server  │    │ between AI agent and   │   │ never written to a   │
    │ Validates Host/    │    │ MCP server             │   │ readable .env file   │
    │ Origin headers     │    │ Flags path-traversal / │   │ App retrieves secrets│
    │                    │    │ suspicious calls       │   │ via local socket call│
    └────────────────────┘    └────────────────────────┘   └──────────────────────┘
```

Airlock is partitioned into three discrete security components running cohesively:
*   **Dev Server Guard (Component A)**: Injects an intermediate validation proxy between the web browser and the dev server. It drops calls lacking valid `Host` or `Origin` headers.
*   **MCP Watch (Component B)**: Intercepts `stdio` streams for Model Context Protocol (MCP) file systems, logging and alerting on suspicious path traversals or credential accesses.
*   **Secret Gate (Component C)**: Relocates credential contents from vulnerable plaintext `.env` files into a secure in-memory socket broker, serving them to key-consuming applications on request.

---

## Installation & Setup

Ensure you have **Node.js v18+** installed. Clone the repository and install dependencies:

```bash
git clone https://github.com/prajith48/Airlock.git
cd airlock
npm install
npm run build
```

**Optional: Install globally**
```bash
npm link # Installs the CLI globally as 'airlock' command
```

### Quick Commands

```bash
# Start Airlock with test server
./scripts/start.sh            # Production build + start
./scripts/start-dev.sh        # Fast dev mode (no build)

# Stop all Airlock processes
./scripts/stop.sh

# Run attack demonstration
./scripts/demo-attack.sh

# Using npm scripts
npm run guard                 # Build + start guard
npm run guard:dev             # Dev mode (fast)
npm run secret-gate           # Start secret gate
npm run clean                 # Clean up everything
```

See [the quick-start guide](docs/getting-started/quickstart.md) for detailed startup options and troubleshooting.

---

## Component A: Dev Server Guard

### Threat Model
A malicious website loaded in a browser can execute a series of DNS queries that switch targeting from an external source to `127.0.0.1`. If authorization constraints on localhost are weak (which is common for dev tools), the external attacker can access source code, API keys, user data, and internal endpoints.

**Real Attack Example:** An attacker hosts `evil-site.com`, which initially resolves to their server IP. A victim visits the site, which loads malicious JavaScript. The attacker's DNS server then changes `evil-site.com` to resolve to `127.0.0.1`. The JavaScript now makes requests to `evil-site.com:3000`, which the browser allows (same origin), but actually targets the victim's localhost:3000. All data from the victim's dev server is exfiltrated.

### Usage

**Easy Start:**
```bash
# Simplest way
./scripts/start.sh

# Development mode (no build)
./scripts/start-dev.sh

# Using npm
npm run guard        # Build + start
npm run guard:dev    # Fast dev mode
```

**CLI Commands:**
```bash
# General Syntax
airlock guard --port <proxyPort> [command]

# Examples:
# Spawns Vite on a random internal port and proxies public traffic to localhost:3000
airlock guard --port 3000 npm run dev

# Proxies to a command with custom args
airlock guard --port 4000 npm run dev -- --host

# With Next.js
airlock guard --port 3000 npm run dev

# Custom target port
airlock guard --port 3000 --target-port 8080 node server.js
```

### Security Mechanism
*   Spawns your dev server with custom `PORT` and `HOST=127.0.0.1` env configurations.
*   Checks the `Host` header (must be exactly `localhost` or `127.0.0.1`).
*   Verifies CORS-adjacent `Origin` and `Referer` headers.
*   Drops the connection immediately on failure (abrupt socket destruction to deny information disclosure).
*   **No 403 responses** - attackers get no feedback, making reconnaissance harder.

### What Gets Blocked
- ❌ Requests with forged `Host` headers (DNS rebinding attacks)
- ❌ Requests from malicious origins trying to access localhost
- ❌ WebSocket upgrade attempts from external domains
- ❌ Any request not explicitly targeting `127.0.0.1` or `localhost`

### What's Allowed
- ✅ Normal browser access to `http://localhost:3000`
- ✅ Normal browser access to `http://127.0.0.1:3000`
- ✅ WebSocket connections for HMR (Hot Module Replacement)
- ✅ API requests from your legitimate frontend

---

## Component B: MCP Watch

### Threat Model
AI programming assistants can be instructed to perform file reads. If path verification is missing on the client side, malicious context injected into files (e.g. prompt injection in a documentation page) can trick the tooling into reading private files (e.g., `.ssh/id_rsa`, `.aws/credentials`) and returning their contents to the agent.

### Usage
Wrap the MCP server registration in your IDE config (e.g. Claude Desktop config `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "filesystem-secure": {
      "command": "airlock",
      "args": [
        "mcp-watch",
        "--root", "/path/to/my/project",
        "npx", "-y", "@modelcontextprotocol/server-filesystem", "/path/to/my/project"
      ]
    }
  }
}
```

### Security Mechanism
*   Acts as a transparent `stdio` pipe in passive/fail-open monitoring mode. It reports suspicious calls; it does not block them. If the wrapper exits, the wrapped server's stdio connection also ends.
*   Intercepts JSON-RPC tool invocations (`tools/call`).
*   Resolves and evaluates folder coordinates to flag directory traversal attempts (`../` out-of-boundary calls).
*   Alerts on known denylist strings (`.ssh`, `.env`, etc.) and logs warning payloads to `airlock.log`.

---

## Component C: Secret Gate

### Threat Model
Placing `.env` configurations in the root directory leaves credentials vulnerable. Any arbitrary script or tool with standard directory permissions can read API tokens.

### Usage

1.  Initialize setup check:
    ```bash
    airlock secret-gate init --env .env
    ```
2.  Load secrets into the local broker. The source is retained unless you explicitly authorize deletion:
    ```bash
    airlock secret-gate start --env .env --delete-source
    ```
3.  Implement the client-fetch method in your project code:
    ```javascript
    import { getSecrets } from 'airlock/secretgate/client';

    // Fetches keys dynamically from socket broker in-memory
    const secrets = await getSecrets(['API_KEY', 'DATABASE_URL']);
    ```

---

## Security limits

Guard only accepts `localhost` and `127.0.0.1` authorities and is intentionally bound to loopback. It cannot protect a target process that ignores its `PORT`/`HOST` environment settings or services exposed independently.

MCP Watch is detection-only. It has no enforcement authority over the wrapped MCP server, and path alerts are not proof that a server will refuse a filesystem operation.

Secret Gate uses a per-user local socket with restrictive Unix permissions. It is not a hardware vault and does not protect secrets from malicious code running as the same OS user, process-memory inspection, debuggers, crash dumps, swap, backups, or filesystem snapshots. `--delete-source` performs ordinary unlinking, which is not secure erasure on modern filesystems.

Report suspected security issues privately to the repository maintainer rather than including credentials or proof-of-concept secrets in a public issue.

---

## Audit Logs

All exceptions, blocking actions, and telemetry are directed to a local structural log file (`airlock.log`). Logs are formatted cleanly using the `pino` library.

---

## Project Structure

```
├── src/
│   ├── cli.ts                   # Unified terminal command entry
│   ├── guard/                   # Component A (Dev Server Guard)
│   │   ├── proxy.ts             # Reverse-proxy server
│   │   ├── runner.ts            # Child process spawner
│   │   └── validation.ts        # Host/Origin validator
│   ├── mcpwatch/                # Component B (MCP Watch)
│   │   └── watcher.ts           # Transparent JSON-RPC validator
│   ├── secretgate/              # Component C (Secret Gate)
│   │   ├── broker.ts            # Local UNIX socket vault
│   │   └── client.ts            # Key-fetch adapter code
│   └── utils/                   # Shared validation & logger code
│       ├── logger.ts
│       └── pathValidation.ts
└── test/                        # Testing suite (Vitest configuration)
```

---

## Testing

Run the test suite with:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

### Security Testing

Test DNS rebinding protection:

```bash
# Start Airlock
./start.sh

# In another terminal, try to forge Host header (should be blocked)
curl -H "Host: evil.com" http://localhost:3000
# Connection will be dropped with no response

# Legitimate access (should work)
curl http://localhost:3000
# Returns the page successfully
```

---

## Troubleshooting

### Port Already in Use

**Error:** `EADDRINUSE: address already in use`

**Solution:**
```bash
# Use the stop script
./stop.sh

# Or manually kill the process
kill $(lsof -t -i:3000)
```

### Permission Denied on Port

**Error:** `EACCES: permission denied`

**Solution:** Use a port above 1024, or run with sudo (not recommended):
```bash
airlock guard --port 8000 npm run dev
```

### Child Process Fails to Start

**Error:** `Child process failed to start`

**Solution:** Verify the command exists and is executable:
```bash
# Check if command is available
which npm
which node

# Try running command directly first
npm run dev
```

For more troubleshooting, see [QUICKSTART.md](QUICKSTART.md#-error-handling).

---

## Documentation

- [QUICKSTART.md](QUICKSTART.md) - Easy startup commands and troubleshooting
- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical architecture and design decisions
- [TESTING.md](TESTING.md) - Test suite documentation
- [MONITORING.md](MONITORING.md) - Logging and monitoring guide
- [attack-demo/README.md](attack-demo/README.md) - Attack demonstration details

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## Security Disclosure

If you discover a security vulnerability in Airlock, please email security@example.com. Do not open a public issue.

---

## License

This project is licensed under the MIT License.
