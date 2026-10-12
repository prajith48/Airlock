/**
 * MCP Watch - Transparent Stdio Passthrough
 *
 * Phase 1: Transparent relay of all MCP JSON-RPC messages (fail-open design)
 * Phase 2: Adds path traversal detection and logging
 *
 * Design principle (SRS Section 2.2, NFR-3): This is a detection-only tool in v1.
 * A crash or slowdown in Airlock's logging logic MUST NOT break the agent's connection.
 * All messages are copied through unmodified - fail-open by design.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { createLogger } from "../utils/logger.js";
import { validatePath } from "../utils/pathValidation.js";

const logger = createLogger("mcpwatch");

interface MCPWatchOptions {
  serverCommand: string[];
  projectRoot: string;
  logFilePath?: string;
  enableDetection?: boolean;
}

/**
 * JSON-RPC message structure for MCP tool calls
 */
interface JSONRPCMessage {
  jsonrpc: "2.0";
  id?: string | number;
  method?: string;
  params?: {
    name?: string;
    arguments?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

/**
 * Extracts file path arguments from MCP tool call parameters
 * Handles common parameter names: path, file, filepath, filename, target, source
 */
function extractPaths(args: Record<string, unknown> | undefined): string[] {
  if (!args) return [];

  const pathKeys = ["path", "file", "filepath", "filename", "target", "source", "destination"];
  const paths: string[] = [];

  for (const key of pathKeys) {
    const value = args[key];
    if (typeof value === "string") {
      paths.push(value);
    }
  }

  return paths;
}

/**
 * Creates a passive newline-delimited JSON-RPC inspector. Inspection never
 * changes the bytes forwarded to the wrapped server.
 */
export function createMCPInspector(
  projectRoot: string,
  enableDetection: boolean
): (chunk: Buffer) => void {
  let buffer = "";
  return (chunk: Buffer): void => {
    if (!enableDetection) return;
    try {
      buffer += chunk.toString("utf8");
      if (Buffer.byteLength(buffer) > 1024 * 1024) {
        logger.warn("MCP inspection buffer exceeded 1 MiB; clearing incomplete message");
        buffer = "";
        return;
      }
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const message: JSONRPCMessage = JSON.parse(line);
          if (message.method !== "tools/call" || !message.params?.arguments) continue;
          const toolName = message.params.name || "unknown";
          for (const path of extractPaths(message.params.arguments)) {
            const validation = validatePath(path, projectRoot);
            if (validation.isViolation) logger.warn({ tool: toolName, path, reason: validation.reason }, "Suspicious MCP tool call detected (monitoring only)");
          }
        } catch { /* Non-JSON lines are passed through and not inspected. */ }
      }
    } catch (error) {
      logger.error({ error }, "MCP inspection failed; continuing transparent relay");
    }
  };
}

let activeMCPServer: ChildProcess | null = null;

/**
 * Starts the MCP Watch sidecar process
 *
 * Sits between the AI agent and the real MCP server, transparently relaying
 * all stdio while inspecting for suspicious file operations.
 *
 * @param options - Configuration for MCP Watch
 */
export async function startMCPWatch({
  serverCommand,
  projectRoot,
  enableDetection = true,
}: MCPWatchOptions): Promise<void> {
  logger.info(`Starting MCP Watch for server: ${serverCommand.join(" ")}`);
  logger.info(`Project root: ${projectRoot}`);
  logger.info(`Detection: ${enableDetection ? "enabled" : "disabled (transparent mode)"}`);

  const command = serverCommand[0];
  const args = serverCommand.slice(1);

  if (!command) {
    throw new Error("No MCP server command provided");
  }

  // Spawns shell execution if command has spaces or args on Windows
  const useShell = process.platform === "win32";

  // FR-7: Spawn the real MCP server as a child process
  const mcpServer = spawn(command, args, {
    stdio: ["pipe", "pipe", "pipe"], // stdout is protocol; stderr is diagnostics
    shell: useShell,
    // Keep the protocol child attached. Detached process groups make stdio
    // lifecycle and exit propagation unreliable for a transparent wrapper.
    detached: false,
  });

  activeMCPServer = mcpServer;

  const inspect = createMCPInspector(projectRoot, enableDetection);

  // Use explicit forwarding rather than a transform pipeline. This preserves
  // exact chunks and observes backpressure, while the inspector is strictly
  // side-effect-only and cannot consume protocol bytes.
  process.stdin.on("data", (chunk: Buffer) => {
    inspect(chunk);
    if (!mcpServer.stdin.write(chunk)) process.stdin.pause();
  });
  process.stdin.once("end", () => mcpServer.stdin.end());
  mcpServer.stdin.on("drain", () => process.stdin.resume());
  mcpServer.stdin.on("error", (error) => logger.warn({ error }, "Wrapped MCP server stdin closed"));

  // Server output is protocol data. Relay it directly; tool calls originate on
  // stdin, so inspecting output here adds no security value and risks delaying
  // or corrupting framed responses.
  mcpServer.stdout.pipe(process.stdout);
  mcpServer.stderr.pipe(process.stderr);

  // Handle MCP server termination
  mcpServer.on("error", (err) => {
    logger.error({ err }, "MCP server failed to start");
    process.exit(1);
  });

  mcpServer.on("exit", (code, signal) => {
    logger.info(`MCP server exited with code ${code} and signal ${signal}`);
    // Do not force an immediate exit: stdout may still contain bytes queued by
    // the transparent relay. Let stream shutdown flush them first.
    process.exitCode = code ?? 0;
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    logger.info("SIGINT received, shutting down MCP Watch...");
    cleanup();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    logger.info("SIGTERM received, shutting down MCP Watch...");
    cleanup();
    process.exit(0);
  });
}

/**
 * Clean up MCP server process
 */
function cleanup(): void {
  if (activeMCPServer) {
    try {
      const pid = activeMCPServer.pid;
      if (pid) {
        if (process.platform !== "win32") {
          try { process.kill(-pid, "SIGTERM"); } catch { activeMCPServer.kill("SIGTERM"); }
          setTimeout(() => {
            try { process.kill(-pid, "SIGKILL"); } catch {}
          }, 500).unref();
        } else {
          activeMCPServer.kill("SIGTERM");
          setTimeout(() => {
            if (activeMCPServer && activeMCPServer.pid) {
              activeMCPServer.kill("SIGKILL");
            }
          }, 500).unref();
        }
      }
    } catch {
      // Process might already be dead
    }
    activeMCPServer = null;
  }
}
