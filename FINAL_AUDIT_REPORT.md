# Airlock Security Audit & Repair Report

## A. Findings fixed

### Dev Server Guard
- **Strict Origin/Referer Validation**: Replaced weak RegEx parsing with rigorous URL parsing in `validateOrigin`, preventing malformed domains or obfuscated ports from bypassing checks.
- **Orphan Process Cleanup**: Changed process spawning to use `detached: true` and process group signals (`process.kill(-pid)`) on Unix to prevent zombie/orphan processes (like `vite` spawned by `npm run dev`) during shutdown.

### MCP Watch
- **Protocol Transparency**: Re-routed all internal diagnostics, banner output, and pino logs to `process.stderr`, preserving `process.stdout` strictly for JSON-RPC traffic. This stops Airlock from corrupting MCP wire protocol.
- **Denial of Service Limits**: Added a 50MB buffer limit per message in the `Transform` stream to prevent out-of-memory crashes on oversized payloads.
- **Orphan Process Cleanup**: Ensured the wrapped MCP server uses process group cleanup matching the Dev Server Guard.

### Secret Gate
- **Secure File Lifecycle**: Fixed a severe TOCTOU issue where `broker.ts` eagerly deleted the `.env` file before socket binding. Deletion is now explicit, verified, and only happens post-startup if `--delete-source` is passed.
- **Secure Socket Paths**: Replaced the hardcoded, globally writable `/tmp/airlock-secrets.sock` with a securely permissioned, user-specific path (`/tmp/airlock-<uid>/secrets.sock`) with `0o700` directory and `0o600` socket permissions.
- **Stale Socket Handling**: Broker now safely detects stale sockets by attempting a connection before unlinking, preventing it from clobbering other active brokers.

### Dependencies
- **NPM Audit**: Fixed 6 vulnerabilities (3 moderate, 2 high, 1 critical) in `fast-copy`, `fast-uri`, `hono`, `ip-address`, `proxy-addr`, and `@modelcontextprotocol/sdk`.

## B. Files changed

- **`src/guard/validation.ts`**: Re-wrote `validateOrigin` to parse URLs natively and reject invalid components. Removed unused `ALLOWED_ORIGIN_PATTERNS`.
- **`src/guard/runner.ts`**: Upgraded `spawn` to detach children, and `cleanup` to use process-group `kill(-pid)` signals.
- **`src/mcpwatch/watcher.ts`**: Introduced the 50MB bounding check to `createInspectionStream` and adopted process-group kills for the MCP process.
- **`src/secretgate/broker.ts`**: Removed `.env` destruction from `loadSecretsFromFile`. Implemented active connection checking for stale socket removal and secure `0o600` file modes.
- **`src/utils/socketPath.ts`**: (New) Extracted a secure, cross-platform socket path generator.
- **`src/secretgate/client.ts`**: Switched to the new `socketPath.ts` utility.
- **`src/cli.ts`**: Refactored the `secret-gate start` lifecycle to only delete `.env` if explicitly authorized (`--delete-source`) *and* after successful startup. 
- **`src/utils/logger.ts` & `src/utils/banner.ts`**: Redirected output entirely to `stderr` (`destination: 2` in pino) to protect MCP stdout data streams.
- **`package.json`**: Broadened socket cleanup to wipe `/tmp/airlock-*/secrets.sock`.

## C. Verification results

- **`npm run build`**: Passed. 0 TS errors.
- **`npm test -- --run`**: Passed. 23/23 tests successfully run.
- **`npm run lint`**: Passed.
- **`npm audit`**: Passed (0 vulnerabilities found).
- **`npm run test:coverage`**: Skipped (missing `@vitest/coverage-v8` dependency).
- **Smoke Tests**: 
  - `node dist/cli.js --help` - Passed, rendered banner to stderr.
  - `node dist/cli.js status` - Passed, successfully detected `Secret Gate` offline, Guard ports available, etc.

## D. Remaining risks

- **Windows Socket Security**: Named pipes (`\\\\.\\pipe\\airlock-secrets`) are still globally predictable. While Windows enforces ACLs differently, additional validation (e.g., verifying client process owner) is recommended for extreme threat models.
- **Complex `.env` Edge Cases**: Uses `dotenv` out of the box. While robust, extremely large or heavily mutated environment injections might still hit OS limits.
- **Secret Gate Same-User Limit**: Secret Gate sockets are isolated per-user, but *any* process running under the same user account can read from it. It does not authenticate specific child PIDs.

## E. How I run it

Build and test:
```bash
npm install
npm run build
npm test
```

Start the Guard:
```bash
airlock guard --port 3000 node test-server.js
```

Start MCP Watch:
```bash
airlock mcp-watch node my-mcp-server.js
```

Start Secret Gate (secure manual mode):
```bash
airlock secret-gate start --env .env --delete-source
```
