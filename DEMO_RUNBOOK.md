# Airlock demonstration runbook

This is a practical presenter script for a local prototype demonstration. Use only fabricated values. Keep two terminals open: **Terminal A** runs Airlock; **Terminal B** sends the requests that prove the behavior.

## Before anyone arrives

From the repository root, run:

```bash
npm install
npm run build
npm test
node dist/cli.js status
```

Expected: the build and tests pass. `status` may say Guard and Secret Gate are not running; that is correct before the demo. It deliberately does not claim a service is healthy just because a file exists.

If port 3000 is occupied, choose 3100 in the Guard commands below. Do not use a real `.env` file for this presentation.

## 1. Open with the Guard (4 minutes)

In Terminal A, start the protected example server:

```bash
node dist/cli.js guard --port 3000 node test-server.js
```

Point out the colored **Guard Active** line. It shows the public loopback port and the randomly chosen private target port. The application is not exposed directly on the public port.

In Terminal B, demonstrate normal local access:

```bash
curl -i http://localhost:3000/
```

Expected: an HTTP success response from the sample server.

Then demonstrate the attack cases:

```bash
curl -v -H 'Host: evil.example' http://127.0.0.1:3000/
curl -v -H 'Host: localhost:3000@evil.example' http://127.0.0.1:3000/
curl -v -H 'Host: localhost:3000' -H 'Origin: http://evil.example' http://127.0.0.1:3000/
```

Expected: each malicious request is dropped rather than forwarded. Explain the precise claim: Guard validates every request's Host and, when supplied, Origin/Referer. It helps mitigate DNS rebinding against a loopback development server; it is not a general web application firewall.

Stop Guard with `Ctrl+C` in Terminal A before the next section.

## 2. Show Secret Gate with fake data (4 minutes)

Create an explicitly fake demo file:

```bash
printf 'DEMO_API_KEY=not-a-real-secret\nDEMO_DATABASE_URL=postgres://demo:demo@localhost/demo\n' > /tmp/airlock-demo.env
```

In Terminal A, start the broker without deletion:

```bash
node dist/cli.js secret-gate start --env /tmp/airlock-demo.env
```

Point out the colored broker status and private socket path. In Terminal B, retrieve only a requested value:

```bash
node --input-type=module -e "import { getSecrets } from './dist/secretgate/client.js'; console.log(await getSecrets(['DEMO_API_KEY']))"
```

Expected: only the requested fake key appears. Show that deletion is opt-in:

```bash
test -f /tmp/airlock-demo.env && echo 'Source preserved until explicitly authorized'
```

For the deletion behavior, stop the broker with `Ctrl+C`, then restart deliberately:

```bash
node dist/cli.js secret-gate start --env /tmp/airlock-demo.env --delete-source
test ! -e /tmp/airlock-demo.env && echo 'Source deleted after a successful broker start'
```

Say this clearly: ordinary deletion is not secure erasure, and Secret Gate does not protect against malicious programs running as the same OS user, debuggers, memory inspection, swap, backups, or snapshots.

## 3. Show MCP Watch (3 minutes)

MCP Watch is a **passive monitor**. Its stdout is reserved exclusively for MCP JSON-RPC, while its colored status and warnings use stderr. It detects and logs suspicious paths; it does not block tool calls.

For an IDE integration, configure the server command as:

```json
{
  "command": "node",
  "args": [
    "/absolute/path/to/Airlock/dist/cli.js",
    "mcp-watch",
    "--root", "/absolute/path/to/project",
    "npx", "-y", "@modelcontextprotocol/server-filesystem", "/absolute/path/to/project"
  ]
}
```

Start or restart the IDE's MCP connection. The terminal should show a purple **MCP Watch Active** line and `MONITORING ONLY`. Ask the IDE to list a normal project file first. Then request a suspicious path such as `../outside.txt` or `.env` through the wrapped file tool.

Expected: the MCP server receives the request unchanged, while Airlock writes a warning to stderr and `airlock.log`. Do not say it blocked the request; the current design intentionally fails open.

If your IDE starts the server without a visible terminal, run it from a terminal first and inspect `airlock.log`. If the MCP server uses a transport other than newline-delimited stdio JSON-RPC, do not demo it as supported.

## Closing statement

"Airlock is a local-first prototype with three honest boundaries: Guard rejects hostile loopback authorities, MCP Watch observes suspicious tool paths without enforcement, and Secret Gate removes routine plaintext-file access after an explicitly authorized transition. The test suite proves its current regression coverage; the remaining work is broader integration coverage and platform testing."

## Recovery checklist

- `EADDRINUSE`: use another Guard `--port` or stop the process using it.
- Secret Gate socket error: stop an existing `secret-gate` process; do not manually delete arbitrary files from `/tmp`.
- MCP messages on stdout must be JSON-RPC only. All banners, logs, and warnings belong on stderr.
- After the demo, stop running processes with `Ctrl+C`. The only file intentionally created by this runbook is `/tmp/airlock-demo.env`.
