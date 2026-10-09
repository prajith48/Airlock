# Component Details

Deep dive into each Airlock component's implementation and internals.

## Component A: Dev Server Guard

### Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser    │────▶│  Guard Proxy │────▶│  Dev Server  │
│ localhost:80 │     │  (Airlock)   │     │   (Hidden)   │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Validation  │
                     │  - Host      │
                     │  - Origin    │
                     │  - Referer   │
                     └──────────────┘
```

### Key Files

- `src/guard/proxy.ts` - HTTP/WebSocket reverse proxy
- `src/guard/runner.ts` - Process management and port allocation
- `src/guard/validation.ts` - Host/Origin header validation

### How It Works

1. **Port Allocation**: Guard allocates a random port for the actual dev server
2. **Environment Injection**: Sets `HOST=127.0.0.1` and `PORT` environment variables
3. **Proxy Layer**: Intercepts all requests on the public port
4. **Validation**: Checks Host header must be `localhost` or `127.0.0.1`
5. **Forwarding**: Valid requests proxied to hidden dev server
6. **Blocking**: Invalid requests dropped with no response

### Security Features

- **No 403 responses** - Silent connection drop prevents information disclosure
- **WebSocket support** - HMR (Hot Module Replacement) works normally
- **Process isolation** - Dev server bound only to 127.0.0.1
- **Graceful shutdown** - SIGINT/SIGTERM handlers for clean exit

### Configuration

```typescript
interface ProxyOptions {
  publicPort: number;      // User-facing port (e.g., 3000)
  targetPort: number;      // Internal dev server port
  targetHost?: string;     // Default: "127.0.0.1"
  onBeforeRequest?: ...;   // Validation hook
  onBeforeUpgrade?: ...;   // WebSocket validation
}
```

---

## Component B: MCP Watch

### Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  AI Agent    │────▶│  MCP Watch   │────▶│  MCP Server  │
│  (Claude)    │     │  (Airlock)   │     │ (Filesystem) │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Detection   │
                     │  - Traversal │
                     │  - Denylist  │
                     └──────────────┘
```

### Key Files

- `src/mcpwatch/watcher.ts` - stdio interceptor and validator
- `src/utils/pathValidation.ts` - Path traversal detection logic

### How It Works

1. **stdio Interception**: Sits between agent and MCP server
2. **Transparent Relay**: All messages pass through unchanged (fail-open)
3. **JSON-RPC Parsing**: Extracts tool calls from stdio stream
4. **Path Extraction**: Identifies file path arguments
5. **Validation**: Checks for traversal patterns and denylist matches
6. **Alerting**: Logs warnings for suspicious operations

### Detection Rules

**Path Traversal:**
- `../` patterns that escape project root
- Absolute paths outside allowed directory
- Symlink following to restricted locations

**Denylist Patterns:**
- `.ssh/` - SSH keys
- `.aws/` - AWS credentials
- `.env` - Environment secrets
- `id_rsa` - Private keys
- `credentials` - Generic credential files

### Configuration

```typescript
interface MCPWatchOptions {
  serverCommand: string[];   // Real MCP server command
  projectRoot: string;       // Allowed directory
  enableDetection?: boolean; // Default: true
}
```

---

## Component C: Secret Gate

### Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│     App      │────▶│ Secret Gate  │────▶│   Memory     │
│  (Your Code) │     │    Broker    │     │   (Secure)   │
└──────────────┘     └──────────────┘     └──────────────┘
                            ▲
                            │
                     ┌──────────────┐
                     │  .env File   │
                     │   (Deleted)  │
                     └──────────────┘
```

### Key Files

- `src/secretgate/broker.ts` - Unix socket server and secret store
- `src/secretgate/client.ts` - Client library for apps

### How It Works

1. **File Load**: Reads .env file into memory
2. **Parsing**: Extracts KEY=VALUE pairs
3. **Storage**: Keeps secrets in Map<string, string>
4. **File Deletion**: Removes plaintext .env from disk
5. **Socket Server**: Listens on Unix domain socket
6. **Client Requests**: Apps request secrets by key name
7. **Response**: Returns only requested secrets (never all)

### Protocol

**Request Format:**
```
KEY1
KEY2
KEY3

```
(Newline-separated keys, terminated by double newline)

**Response Format:**
```json
{
  "KEY1": "value1",
  "KEY2": "value2",
  "KEY3": "value3"
}
```

### Socket Paths

- **Linux/macOS**: `/tmp/airlock-secrets.sock`
- **Windows**: `\\.\pipe\airlock-secrets`

### Security Model

- **Local-only**: Unix socket not exposed to network
- **Process isolation**: Only processes with socket access can read
- **Audit logging**: Every fetch logged with timestamp
- **No persistence**: Secrets lost on broker restart (by design)

### Client Usage

```typescript
import { getSecrets } from 'airlock/secretgate/client';

const secrets = await getSecrets(['API_KEY', 'DATABASE_URL']);
console.log(secrets.API_KEY);  // Your secret value
```

---

## Shared Utilities

### Error Handler (`src/utils/errorHandler.ts`)

Provides:
- Error categorization (Network, Filesystem, Validation, Process, Configuration, Security)
- Severity levels (Low, Medium, High, Critical)
- Recovery suggestions based on error type
- Retry logic with exponential backoff
- Error metrics tracking

### Logger (`src/utils/logger.ts`)

Features:
- Structured JSON logging (pino)
- Component-based labeling
- Log levels (debug, info, warn, error, fatal)
- File output to `airlock.log`
- Pretty printing in development

### Path Validation (`src/utils/pathValidation.ts`)

Functions:
- `validatePath()` - Check if path is within allowed directory
- `isTraversal()` - Detect `../` patterns
- `isDenylisted()` - Match against known sensitive paths
- `normalizePath()` - Resolve symlinks and relative paths

---

## Testing

Each component has corresponding test files in `test/`:

- `test/validation.test.ts` - Guard validation logic
- `test/pathValidation.test.ts` - MCP Watch path detection

Run tests with:
```bash
npm test
```

---

## Performance Considerations

### Guard Proxy
- **Overhead**: ~1-2ms per request (negligible)
- **WebSocket**: Zero measurable impact on HMR
- **Memory**: <10MB constant footprint

### MCP Watch
- **stdio Throughput**: No measurable impact (fail-open design)
- **Detection Overhead**: <0.1ms per tool call
- **Memory**: <5MB constant footprint

### Secret Gate
- **Lookup Speed**: O(1) Map access, <0.1ms
- **Memory**: ~1KB per secret stored
- **Socket Overhead**: ~0.5ms per fetch

---

## Extension Points

### Custom Validation Rules

Add to `src/guard/validation.ts`:
```typescript
export function validateRequest(req: http.IncomingMessage): boolean {
  // Add your custom logic here
  return isValidHost(req) && isValidOrigin(req) && customCheck(req);
}
```

### Additional Denylist Patterns

Add to `src/utils/pathValidation.ts`:
```typescript
const DENYLIST = [
  '.ssh', '.aws', '.env',
  'your-pattern-here',  // Add your patterns
];
```

### Custom Secret Transformations

Modify `src/secretgate/broker.ts`:
```typescript
function parseEnvFile(content: string): Map<string, string> {
  // Add decryption, validation, transformation logic
  return secrets;
}
```

---

[Back to architecture overview](overview.md) | [Back to documentation index](../README.md)
