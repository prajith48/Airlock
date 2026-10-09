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
import { Transform } from "node:stream";

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
 * Creates a transform stream that inspects MCP messages without blocking them
 */
function createInspectionStream(
  projectRoot: string,
  enableDetection: boolean
): Transform {
  let buffer = "";

  return new Transform({
    transform(chunk, _encoding, callback) {
      // Always pass through immediately (fail-open)
      this.push(chunk);

      if (!enableDetection) {
        callback();
        return;
      }

      try {
        // Parse JSON-RPC messages for detection (non-blocking)
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const message: JSONRPCMessage = JSON.parse(line);

            // FR-8: Parse MCP tool-call messages
            if (message.method === "tools/call" && message.params?.arguments) {
              const toolName = message.params.name || "unknown";
              const paths = extractPaths(message.params.arguments);

              // FR-9, FR-10: Flag and log suspicious paths
              for (const path of paths) {
                const validation = validatePath(path, projectRoot);
                if (validation.isViolation) {
                  logger.warn({
                    tool: toolName,
                    path,
                    reason: validation.reason,
                    timestamp: new Date().toISOString(),
                  }, "⚠️  Suspicious MCP tool call detected");

                  // TODO: Desktop notification (optional, can be added later)
                }
              }
            }
          } catch (parseError) {
            // Invalid JSON - ignore silently (don't break the stream)
          }
        }
      } catch (error) {
        // Detection logic failed - log but don't break the stream (fail-open)
        logger.error({ error }, "Error in MCP inspection logic (stream continues)");
      }

      callback();
    },
  });
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

  // FR-7: Spawn the real MCP server as a child process
  const mcpServer = spawn(command, args, {
    stdio: ["pipe", "pipe", "inherit"], // stdin, stdout, stderr
  });

  activeMCPServer = mcpServer;

  // Create inspection streams (non-blocking, fail-open)
  const toServerInspector = createInspectionStream(projectRoot, enableDetection);
  const fromServerInspector = createInspectionStream(projectRoot, enableDetection);

  // Pipe: agent stdin → inspection → MCP server stdin
  process.stdin.pipe(toServerInspector).pipe(mcpServer.stdin);

  // Pipe: MCP server stdout → inspection → agent stdout
  mcpServer.stdout.pipe(fromServerInspector).pipe(process.stdout);

  // Handle MCP server termination
  mcpServer.on("error", (err) => {
    logger.error({ err }, "MCP server failed to start");
    process.exit(1);
  });

  mcpServer.on("exit", (code, signal) => {
    logger.info(`MCP server exited with code ${code} and signal ${signal}`);
    process.exit(code ?? 0);
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
      activeMCPServer.kill("SIGTERM");
      setTimeout(() => {
        if (activeMCPServer) {
          activeMCPServer.kill("SIGKILL");
        }
      }, 500).unref();
    } catch {
      // Process might already be dead
    }
    activeMCPServer = null;
  }
}
