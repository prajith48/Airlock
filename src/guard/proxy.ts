/**
 * Dev Server Guard - Transparent Reverse Proxy
 *
 * Phase 1: Transparent passthrough with WebSocket support for HMR
 * Phase 2: Adds Host/Origin validation (via hooks)
 *
 * Design principle (SRS Section 2.1): Build transparent proxy first,
 * validate zero regression before adding security checks.
 */

import http from "node:http";
import httpProxy from "http-proxy";
import { type Socket } from "node:net";
import { createLogger } from "../utils/logger.js";
import { handleError, ErrorCategory, ErrorSeverity } from "../utils/errorHandler.js";

const logger = createLogger("guard");

export interface ProxyOptions {
  publicPort: number;
  targetPort: number;
  targetHost?: string;
  onBeforeRequest?: (req: http.IncomingMessage, res: http.ServerResponse) => boolean;
  onBeforeUpgrade?: (req: http.IncomingMessage, socket: Socket, head: Buffer) => boolean;
}

/**
 * Starts the reverse proxy server
 *
 * @param options - Configuration for the proxy
 * @returns HTTP server instance for lifecycle management
 */
export function startProxy({
  publicPort,
  targetPort,
  targetHost = "127.0.0.1",
  onBeforeRequest,
  onBeforeUpgrade,
}: ProxyOptions): http.Server {
  // Create http-proxy instance
  const proxy = httpProxy.createProxyServer({
    target: {
      host: targetHost,
      port: targetPort,
    },
    ws: true, // Enable WebSocket proxying for HMR (NFR-2)
  });

  // Create the public-facing HTTP server
  const server = http.createServer((req, res) => {
    // Run pre-request hook if provided (Phase 2: validation)
    if (onBeforeRequest && !onBeforeRequest(req, res)) {
      // FR-4: Drop connection on validation failure (not 403)
      logger.warn({
        url: req.url,
        host: req.headers.host,
        origin: req.headers.origin,
      }, "Request blocked by validation, dropping connection");
      req.destroy(); // Abrupt disconnect
      return;
    }

    // Forward the HTTP request transparently
    proxy.web(req, res, { target: `http://${targetHost}:${targetPort}` }, (err) => {
      handleError(err, {
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        component: "guard-proxy",
        context: { path: req.url, targetPort, targetHost },
        exitOnCritical: false,
      });

      if (!res.headersSent) {
        res.writeHead(502, { "Content-Type": "text/plain" });
        res.end(`Bad Gateway: Dev server not reachable on port ${targetPort}\n`);
      }
    });
  });

  // FR-5: Handle WebSocket upgrades (crucial for HMR live-reload)
  server.on("upgrade", (req: http.IncomingMessage, socket: Socket, head: Buffer) => {
    // Run pre-upgrade hook if provided
    if (onBeforeUpgrade && !onBeforeUpgrade(req, socket, head)) {
      logger.warn({
        url: req.url,
        host: req.headers.host,
      }, "WebSocket upgrade blocked, dropping connection");
      socket.destroy();
      return;
    }

    // Forward the WebSocket upgrade request
    proxy.ws(req, socket, head, { target: `ws://${targetHost}:${targetPort}` }, (err) => {
      handleError(err, {
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        component: "guard-websocket",
        context: { path: req.url, targetPort, targetHost },
        exitOnCritical: false,
      });
      socket.destroy();
    });
  });

  // Proxy error handling
  proxy.on("error", (err, _req, res) => {
    handleError(err, {
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.HIGH,
      component: "guard-proxy-engine",
      exitOnCritical: false,
    });

    if (res instanceof http.ServerResponse && !res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Proxy Error\n");
    }
  });

  // FR-6: Graceful shutdown support
  server.on("close", () => {
    logger.info("Dev Server Guard proxy closed");
    proxy.close();
  });

  // Enhanced error handling for server startup
  server.on("error", (err: NodeJS.ErrnoException) => {
    handleError(err, {
      category: ErrorCategory.CONFIGURATION,
      severity: ErrorSeverity.CRITICAL,
      component: "guard-proxy-server",
      context: { publicPort },
      exitOnCritical: true,
    });
  });

  server.listen(publicPort, "127.0.0.1", () => {
    logger.info(
      `Dev Server Guard active: 127.0.0.1:${publicPort} → 127.0.0.1:${targetPort}`
    );
  });

  return server;
}
