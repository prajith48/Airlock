/**
 * Dev Server Guard - Child Process Runner
 *
 * Spawns the real dev server command as a managed child process
 * forced to bind only to 127.0.0.1 on a random port (or config port).
 * Orchestrates proxy setup and child lifecycle teardown.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { type Server as HttpServer } from "node:http";
import { startProxy } from "./proxy.js";
import { validateRequest } from "./validation.js";
import { createLogger } from "../utils/logger.js";
import { printProxyReady, printTip } from "../utils/banner.js";

const logger = createLogger("guard");

// Track running processes for cleanup on termination
let activeChildProcess: ChildProcess | null = null;
let activeProxyServer: HttpServer | null = null;

/**
 * Finds a free, unused TCP port on the local machine
 *
 * @returns Promise resolving to a free port number
 */
export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      server.close(() => {
        if (port === 0) {
          reject(new Error("Unable to obtain free port"));
        } else {
          resolve(port);
        }
      });
    });
  });
}

/**
 * Checks if a port is available by attempting to bind to it
 *
 * @param port - Port number to check
 * @returns Promise that resolves if port is available, rejects if in use
 */
function checkPortAvailable(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();

    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(new Error(`Port ${port} is already in use`));
      } else {
        reject(err);
      }
    });

    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve());
    });
  });
}

interface RunnerOptions {
  publicPort: number;
  command: string[];
  targetPort?: number | undefined;
}

/**
 * Starts the child dev server and reverse proxy
 *
 * @param options - Startup configuration
 */
export async function runDevServer({
  publicPort,
  command,
  targetPort,
}: RunnerOptions): Promise<void> {
  // 1. Validate ports
  if (publicPort < 1 || publicPort > 65535) {
    throw new Error(`Invalid public port: ${publicPort}. Must be between 1-65535`);
  }
  if (targetPort && (targetPort < 1 || targetPort > 65535)) {
    throw new Error(`Invalid target port: ${targetPort}. Must be between 1-65535`);
  }

  // 2. Check if public port is already in use before starting
  try {
    await checkPortAvailable(publicPort);
  } catch (err) {
    logger.error(`Port ${publicPort} is already in use`);
    logger.info(`Tip: Find what's using the port with: lsof -i :${publicPort}`);
    logger.info(`Tip: Kill the process with: kill $(lsof -t -i :${publicPort})`);
    throw new Error(`Port ${publicPort} is not available`);
  }

  // 3. Determine target port (either provided or randomized)
  let resolvedTargetPort: number;
  try {
    resolvedTargetPort = targetPort || (await findFreePort());
  } catch (err) {
    logger.error({ err }, "Failed to allocate a free port for target server");
    throw new Error("Could not find an available port for the target server");
  }

  logger.info(
    `Spawning child dev server: "${command.join(" ")}" → internal port ${resolvedTargetPort}`
  );

  // 4. Set up environment variables to force localhost binding (FR-2)
  const childEnv = {
    ...process.env,
    PORT: resolvedTargetPort.toString(),
    // Standard environment flags to force 127.0.0.1 binding
    HOST: "127.0.0.1",
    VITE_HOST: "127.0.0.1",
    WEBPACK_DEV_SERVER_HOST: "127.0.0.1",
  };

  // 5. Spawn child process
  const childCommand = command[0];
  const childArgs = command.slice(1);

  if (!childCommand) {
    throw new Error("No command provided to runDevServer");
  }

  // Spawns shell execution if command has spaces or args
  const useShell = process.platform === "win32";
  let child: ChildProcess;

  try {
    child = spawn(childCommand, childArgs, {
      env: childEnv,
      stdio: "inherit", // Pipe stdio directly so user sees original logs
      shell: useShell,
      detached: !useShell && process.platform !== "win32",
    });
  } catch (err) {
    logger.error({ err, command: childCommand }, "Failed to spawn child process");
    throw new Error(`Could not execute command: ${childCommand}`);
  }

  activeChildProcess = child;

  // Handle child termination
  child.on("error", (err) => {
    logger.error({ err }, "Child process failed to start");
    logger.error(`Command: ${childCommand} ${childArgs.join(" ")}`);
    logger.info("Tip: Verify the command exists and is executable");
    cleanup();
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    if (code !== 0 && code !== null) {
      logger.error(
        `Child process exited unexpectedly with code ${code} and signal ${signal}`
      );
    } else {
      logger.info(
        `Child process exited with code ${code} and signal ${signal}`
      );
    }
    cleanup();
    process.exit(code ?? 0);
  });

  // 6. Start the reverse proxy with validation enabled (FR-3, FR-4)
  try {
    activeProxyServer = startProxy({
      publicPort,
      targetPort: resolvedTargetPort,
      onBeforeRequest: (req, _res) => {
        return validateRequest(req);
      },
      onBeforeUpgrade: (req, _socket, _head) => {
        // Validate WebSocket upgrade requests (HMR) for DNS rebinding protection
        return validateRequest(req);
      },
    });

    printProxyReady(publicPort, resolvedTargetPort);
    printTip(`Test it: curl http://localhost:${publicPort}/`);
    printTip(`Attack sim: curl -H "Host: evil.com" http://localhost:${publicPort}/ (will be dropped)`);
    process.stdout.write("\n");
  } catch (err) {
    logger.error({ err }, "Failed to start proxy server");
    cleanup();
    throw err;
  }

  // 7. Register process-wide shutdown interceptors (FR-6)
  process.on("SIGINT", () => {
    logger.info("Signal SIGINT (Ctrl+C) received, shutting down gracefully...");
    cleanup();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    logger.info("Signal SIGTERM received, shutting down gracefully...");
    cleanup();
    process.exit(0);
  });
}

/**
 * Ensures clean termination of proxy and child processes, releasing ports (FR-6)
 */
export function cleanup(): void {
  if (activeProxyServer) {
    activeProxyServer.close();
    activeProxyServer = null;
  }

  if (activeChildProcess) {
    try {
      const pid = activeChildProcess.pid;
      if (pid) {
        if (process.platform !== "win32") {
          try { process.kill(-pid, "SIGTERM"); } catch { activeChildProcess.kill("SIGTERM"); }
          setTimeout(() => {
            try { process.kill(-pid, "SIGKILL"); } catch {}
          }, 500).unref();
        } else {
          activeChildProcess.kill("SIGTERM");
          setTimeout(() => {
            if (activeChildProcess && activeChildProcess.pid) {
              activeChildProcess.kill("SIGKILL");
            }
          }, 500).unref();
        }
      }
    } catch {
      // Process might already be dead
    }
    activeChildProcess = null;
  }
}
