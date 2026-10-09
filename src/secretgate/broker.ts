/**
 * Secret Gate - In-Memory Secrets Broker
 *
 * Holds environment variables in memory and serves them over a local Unix domain socket
 * (or named pipe on Windows), removing the need for plaintext .env files on disk.
 *
 * Design principle (SRS Section 2.3):
 * - Never exposed to network (local-only socket)
 * - Every fetch is logged with timestamp and connection metadata
 * - Does NOT stop attackers with full code-execution equal to the app's user,
 *   but stops different/less-trusted processes from casually reading .env files
 */

import { Server, type Socket } from "node:net";
import { platform } from "node:os";
import { createLogger } from "../utils/logger.js";
import { readFile, unlink } from "node:fs/promises";
import { existsSync, unlinkSync } from "node:fs";

const logger = createLogger("secretgate");

/**
 * Unix socket path (Linux/macOS) or named pipe path (Windows)
 */
const SOCKET_PATH =
  platform() === "win32"
    ? "\\\\.\\pipe\\airlock-secrets"
    : "/tmp/airlock-secrets.sock";

/**
 * In-memory store for secrets
 */
let secretsStore: Map<string, string> = new Map();
let brokerServer: Server | null = null;

/**
 * Parses a .env file into key-value pairs
 */
function parseEnvFile(content: string): Map<string, string> {
  const secrets = new Map<string, string>();
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Parse KEY=VALUE format
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.substring(0, separatorIndex).trim();
    const value = trimmed.substring(separatorIndex + 1).trim();

    // Remove quotes if present
    const unquotedValue = value.replace(/^["']|["']$/g, "");

    if (key) {
      secrets.set(key, unquotedValue);
    }
  }

  return secrets;
}

/**
 * Loads secrets from a .env file and deletes the file (FR-11)
 *
 * @param envFilePath - Path to the .env file
 */
export async function loadSecretsFromFile(envFilePath: string): Promise<void> {
  logger.info(`Loading secrets from ${envFilePath}`);

  if (!existsSync(envFilePath)) {
    throw new Error(`Secrets file not found: ${envFilePath}`);
  }

  try {
    // Read the .env file
    const content = await readFile(envFilePath, "utf-8");

    if (!content || content.trim().length === 0) {
      logger.warn(`Secrets file ${envFilePath} is empty`);
      secretsStore = new Map();
      return;
    }

    secretsStore = parseEnvFile(content);

    if (secretsStore.size === 0) {
      logger.warn(`No valid secrets found in ${envFilePath} - check file format (KEY=VALUE)`);
    } else {
      logger.info(`Loaded ${secretsStore.size} secrets into memory`);
    }

    // FR-11: Delete the plaintext file after loading
    await unlink(envFilePath);
    logger.info(`✓ Plaintext secrets file removed: ${envFilePath}`);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "EACCES") {
      logger.error(`Permission denied reading ${envFilePath}`);
      logger.info("Tip: Check file permissions with: ls -la");
    } else if (err.code === "ENOENT") {
      logger.error(`File disappeared while loading: ${envFilePath}`);
    } else {
      logger.error({ error }, `Failed to load secrets from ${envFilePath}`);
    }
    throw error;
  }
}

/**
 * Manually sets secrets (for testing or programmatic use)
 */
export function setSecrets(secrets: Map<string, string>): void {
  secretsStore = new Map(secrets);
  logger.info(`Set ${secretsStore.size} secrets programmatically`);
}

/**
 * Handles a client connection requesting secrets
 */
function handleClient(socket: Socket): void {
  const connectionTime = new Date().toISOString();

  // FR-13: Log every fetch request with connection metadata
  logger.info({
    timestamp: connectionTime,
    remoteAddress: socket.remoteAddress,
    remotePort: socket.remotePort,
  }, "Client connected to Secret Gate");

  // Protocol: Client sends requested key names as newline-separated list
  // Server responds with JSON object containing the requested secrets
  let buffer = "";

  socket.on("data", (chunk) => {
    buffer += chunk.toString();

    // Check if we have a complete request (terminated by double newline)
    if (buffer.includes("\n\n")) {
      const requestedKeys = buffer
        .split("\n\n")[0]
        ?.split("\n")
        .map((key) => key.trim())
        .filter(Boolean);

      if (!requestedKeys || requestedKeys.length === 0) {
        logger.warn("Client sent empty secret request");
        socket.end(JSON.stringify({ error: "No keys requested" }));
        return;
      }

      logger.info({
        keys: requestedKeys,
        timestamp: new Date().toISOString(),
      }, "Secret fetch request");

      // Build response with only requested secrets
      const response: Record<string, string | undefined> = {};
      for (const key of requestedKeys) {
        response[key] = secretsStore.get(key);
      }

      socket.end(JSON.stringify(response));
    }
  });

  socket.on("error", (err) => {
    logger.error({ err }, "Client socket error");
  });

  socket.on("close", () => {
    logger.debug("Client disconnected");
  });
}

/**
 * Starts the Secret Gate broker server (FR-12)
 */
export async function startBroker(): Promise<void> {
  // Clean up any existing socket file
  if (platform() !== "win32" && existsSync(SOCKET_PATH)) {
    await unlink(SOCKET_PATH);
  }

  brokerServer = new Server(handleClient);

  brokerServer.listen(SOCKET_PATH, () => {
    logger.info(`Secret Gate broker listening on ${SOCKET_PATH}`);
    logger.info(`Serving ${secretsStore.size} secrets`);
  });

  brokerServer.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      logger.error(`Socket ${SOCKET_PATH} is already in use by another Secret Gate instance`);
      logger.info("Tip: Check for running Airlock secret-gate processes and stop them first");
      logger.info(`Tip: Or manually remove the socket: rm ${SOCKET_PATH}`);
    } else if (err.code === "EACCES") {
      logger.error(`Permission denied to create socket at ${SOCKET_PATH}`);
      logger.info("Tip: Check file system permissions for the socket directory");
    } else {
      logger.error({ err }, "Broker server error");
    }
    cleanup();
    process.exit(1);
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    logger.info("SIGINT received, shutting down Secret Gate...");
    cleanup();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    logger.info("SIGTERM received, shutting down Secret Gate...");
    cleanup();
    process.exit(0);
  });
}

/**
 * Stops the broker and cleans up socket file
 */
function cleanup(): void {
  if (brokerServer) {
    brokerServer.close();
    brokerServer = null;
  }

  // Remove socket file
  if (platform() !== "win32" && existsSync(SOCKET_PATH)) {
    try {
      unlinkSync(SOCKET_PATH);
    } catch {
      // Socket already cleaned up
    }
  }
}

/**
 * Gets the socket path for client connections
 */
export function getSocketPath(): string {
  return SOCKET_PATH;
}
