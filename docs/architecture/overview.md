# Airlock Architecture

This document provides a technical deep dive into Airlock's design, implementation, and security model.

---

## Table of Contents

1. [Overview](#overview)
2. [Component A: Dev Server Guard](#component-a-dev-server-guard)
3. [Component B: MCP Watch](#component-b-mcp-watch)
4. [Component C: Secret Gate](#component-c-secret-gate)
5. [Shared Infrastructure](#shared-infrastructure)
6. [Security Considerations](#security-considerations)
7. [Testing Strategy](#testing-strategy)

---

## Overview

Airlock is built as a modular security toolkit with three independent but complementary components. Each component addresses a distinct threat model while sharing common infrastructure (logging, path validation).

### Design Principles

1. **Fail-Open by Default**: Security failures should log warnings, not block legitimate development work.
2. **Transparent Proxying**: Components should be invisible to the underlying tools when functioning correctly.
3. **Zero Configuration**: Sensible defaults that work out of the box.
4. **Defense in Depth**: Multiple layers of validation with different strategies.

---

## Component A: Dev Server Guard

### Threat Model

**Attack**: DNS Rebinding Attack  
**Target**: Local development servers (Vite, Webpack, Next.js, etc.)  
**Vector**: A malicious website tricks a browser into making requests to `127.0.0.1` by rapidly switching DNS responses.

### Architecture

```
Browser → Proxy (validates) → Dev Server (hidden on random port)
          ↓
        Blocks if Host/Origin headers invalid
```

#### Key Modules

1. **`proxy.ts`**: HTTP reverse proxy with WebSocket support
   - Uses `http-proxy` library for transparent proxying
   - Hooks for pre-request validation (`onBeforeRequest`)
   - Hooks for WebSocket upgrade validation (`onBeforeUpgrade`)
   - Supports HMR (Hot Module Replacement) via WebSocket passthrough

2. **`runner.ts`**: Child process orchestration
   - Spawns dev server with enforced `HOST=127.0.0.1` environment
   - Finds free port automatically or uses provided port
   - Manages graceful shutdown (SIGINT/SIGTERM handlers)
   - Cleans up child processes and proxy server on exit

3. **`validation.ts`**: Header validation logic
   - `validateHost()`: Ensures Host header is `localhost` or `127.0.0.1`
   - `validateOrigin()`: Validates Origin and Referer headers
   - `validateRequest()`: Combines both checks

#### Security Mechanism

1. Dev server is forced to bind only to `127.0.0.1` via environment variables
2. Proxy listens on the user's desired port (e.g., 3000)
3. Every incoming request passes through validation:
   - Host header must be `localhost` or `127.0.0.1` (with optional port)
   - Origin/Referer headers (if present) must also be localhost
4. Failed validation results in immediate socket destruction (not HTTP 403)
5. WebSocket upgrades (for HMR) are validated identically

#### Why Socket Destruction?

Returning HTTP 403 reveals server presence. Destroying the socket makes the dev server appear offline to attackers, providing no information disclosure.

---

## Component B: MCP Watch

### Threat Model

**Attack**: Path Traversal via Prompt Injection  
**Target**: AI agent file system access (MCP servers)  
**Vector**: Malicious prompt in a documentation file tricks the AI into reading sensitive files (`.ssh/id_rsa`, `.aws/credentials`, etc.)

### Architecture

```
AI Agent ← → MCP Watch ← → MCP Server
             (stdio pipe)     (file access)
             ↓
           Logs suspicious activity
```

#### Key Module

**`watcher.ts`**: Transparent stdio interceptor
- Spawns MCP server as child process
- Pipes stdin/stdout transparently (fail-open design)
- Parses JSON-RPC messages looking for `tools/call` methods
- Validates file paths in tool arguments
- Logs warnings for:
  - Path traversal attempts (`../` escaping project root)
  - Sensitive file access (`.ssh`, `.env`, `.aws`, etc.)

#### Security Mechanism

1. Registers as a wrapper in IDE MCP configuration
2. Intercepts all JSON-RPC traffic between AI and MCP server
3. Extracts file paths from `tools/call` method invocations
4. Validates paths using shared `pathValidation.ts` utility
5. Logs violations to `airlock.log` but **does not block** (fail-open)
6. If MCP Watch crashes, MCP server continues working (stdio pipes remain open)

#### Design Trade-offs

- **Passive Monitoring**: Does not block requests to avoid breaking legitimate workflows
- **Alert Fatigue**: May log false positives (e.g., accessing `.git/config` is usually safe)
- **Best Effort**: Relies on JSON-RPC parsing; non-standard protocols won't be monitored

---

## Component C: Secret Gate

### Threat Model

**Attack**: Plaintext Credential Exposure  
**Target**: `.env` files with API keys, database URLs, etc.  
**Vector**: Any process with filesystem access can read `.env` files

### Architecture

```
Application → Socket Client → Secret Gate Daemon (in-memory vault)
                              ↓
                            Original .env wiped
```

#### Key Modules

1. **`broker.ts`**: UNIX socket server (daemon)
   - Loads `.env` file contents into memory on startup
   - Wipes original `.env` file after successful load
   - Listens on local UNIX socket (e.g., `/tmp/airlock-secrets.sock`)
   - Serves requested keys via socket protocol

2. **`client.ts`**: Application-side fetch adapter
   - Connects to UNIX socket
   - Requests specific keys by name
   - Returns key-value pairs to application

#### Security Mechanism

1. On `airlock secret-gate start --env .env`:
   - Parses `.env` file
   - Stores contents in memory (JavaScript object)
   - Deletes original `.env` file
   - Starts UNIX socket server
2. Application calls `getSecrets(['API_KEY', 'DATABASE_URL'])`
3. Client connects to socket, requests keys, receives values
4. Daemon only serves keys that exist; returns errors for missing keys

#### Design Trade-offs

- **In-Memory Only**: Secrets live in daemon process memory, not on disk
- **Single Point of Failure**: If daemon crashes, app cannot fetch secrets
- **Socket Permissions**: UNIX socket permissions control access (default: owner-only)
- **Not Encrypted**: Secrets are plaintext in memory (protected by OS process isolation)

---

## Shared Infrastructure

### Logger (`utils/logger.ts`)

- Built on `pino` for structured JSON logging
- All components log to `airlock.log` in current directory
- Log levels: `info`, `warn`, `error`
- Each component uses a labeled logger (e.g., `guard`, `mcpwatch`)

### Path Validation (`utils/pathValidation.ts`)

- Shared validation logic for Components B and C
- Functions:
  - `isPathTraversal()`: Checks if resolved path escapes project root
  - `isSensitivePath()`: Checks against denylist (`.ssh`, `.env`, `.aws`, etc.)
  - `validatePath()`: Combines both checks, returns violation report

---

## Security Considerations

### Component A: Dev Server Guard

**Strengths**:
- Effective against DNS rebinding attacks
- No impact on dev server performance (transparent proxy)
- Supports modern dev tools with HMR/WebSocket

**Limitations**:
- Does not protect against local malware (attacker already has localhost access)
- Relies on Host/Origin headers (can be spoofed by non-browser clients)
- Does not encrypt traffic (local HTTP only)

### Component B: MCP Watch

**Strengths**:
- Detects AI-driven path traversal attempts
- Fail-open design ensures dev workflow continuity
- Transparent to both AI and MCP server

**Limitations**:
- Passive monitoring only (does not block)
- High false positive rate for legitimate out-of-project file access
- Cannot detect malicious activity that doesn't use file paths

### Component C: Secret Gate

**Strengths**:
- Removes credentials from filesystem entirely
- OS-level process isolation protects secrets
- Explicit key-fetching prevents accidental exposure

**Limitations**:
- Requires application code changes (`getSecrets()` integration)
- Daemon crash results in unavailable secrets
- Secrets still in plaintext in memory (vulnerable to memory dumps)
- Not suitable for production (dev-only tool)

---

## Testing Strategy

### Unit Tests

Located in `test/` directory, using Vitest framework:

1. **`validation.test.ts`**: Tests for Component A validation logic
   - Valid/invalid Host headers
   - Valid/invalid Origin/Referer headers
   - Combined request validation

2. **`pathValidation.test.ts`**: Tests for shared path validation
   - Path traversal detection
   - Sensitive path detection
   - Combined validation logic

### Integration Tests

Not yet implemented. Future work:
- End-to-end proxy testing (spawn real dev server)
- MCP Watch interception testing (mock MCP server)
- Secret Gate socket protocol testing

### Test Commands

```bash
npm test              # Run all tests
npm run test:coverage # Run with coverage report
```

---

## Future Enhancements

1. **Component A**:
   - HTTPS support with auto-generated self-signed certificates
   - Rate limiting per source IP
   - Configurable allowlist for trusted origins

2. **Component B**:
   - Active blocking mode (optional, disabled by default)
   - Allowlist for known-safe out-of-project paths
   - Support for non-JSON-RPC protocols

3. **Component C**:
   - Encrypted memory storage (e.g., using libsodium)
   - Multiple .env file support (staging, production, etc.)
   - Secret rotation API

---

## References

- [DNS Rebinding Attacks](https://en.wikipedia.org/wiki/DNS_rebinding)
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- [OWASP Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)
