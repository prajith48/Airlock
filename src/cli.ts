#!/usr/bin/env node

/**
 * Airlock Unified Command Line Interface
 *
 * Core CLI module orchestrating the 3 security layers.
 * Developed to professional grade using the commander library.
 */

import { Command } from "commander";
import { runDevServer } from "./guard/runner.js";
import { startMCPWatch } from "./mcpwatch/watcher.js";
import { loadSecretsFromFile, startBroker, stopBroker } from "./secretgate/broker.js";
import { getSocketPath } from "./utils/socketPath.js";
import { createLogger } from "./utils/logger.js";
import { handleError, ErrorCategory, ErrorSeverity } from "./utils/errorHandler.js";
import {
  printBanner,
  printSection,
  printStatus,
  printOk,
  printWarn,
  printErr,
  printTip,
  printMCPWatchReady,
  COLORS as C,
} from "./utils/banner.js";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const logger = createLogger("cli");
const program = new Command();

// Global error handlers
process.on("uncaughtException", (error) => {
  handleError(error, {
    category: ErrorCategory.UNKNOWN,
    severity: ErrorSeverity.CRITICAL,
    component: "cli-uncaught",
    context: { type: "uncaughtException" },
    exitOnCritical: true,
  });
});

process.on("unhandledRejection", (reason) => {
  handleError(reason instanceof Error ? reason : new Error(String(reason)), {
    category: ErrorCategory.UNKNOWN,
    severity: ErrorSeverity.CRITICAL,
    component: "cli-unhandled",
    context: { type: "unhandledRejection" },
    exitOnCritical: true,
  });
});

program
  .name("airlock")
  .description("A local-first security layer for development servers and AI agent tooling")
  .version("1.0.0");

// --- Component A: Dev Server Guard Command ---
program
  .command("guard")
  .description("Protect dev servers against DNS rebinding attacks")
  .argument("[command...]", "Real dev server command to run (e.g. npm run dev)")
  .option("-p, --port <port>", "Public-facing proxy port", "3000")
  .option("-t, --target-port <port>", "Target internal port (randomized if omitted)")
  .action(async (commandArg: string[], options) => {
    printBanner("Dev Server Guard", "1.0.0");

    const publicPort = Number(options.port);
    const targetPort = options.targetPort ? Number(options.targetPort) : undefined;

    if (isNaN(publicPort)) {
      printErr(`Invalid port: "${options.port as string}" — must be a number`);
      handleError(new Error("Port must be a valid number"), {
        category: ErrorCategory.CONFIGURATION,
        severity: ErrorSeverity.HIGH,
        component: "cli-guard",
        context: { providedPort: options.port },
        exitOnCritical: true,
      });
      return;
    }

    if (targetPort !== undefined && isNaN(targetPort)) {
      printErr(`Invalid target port: "${options.targetPort as string}" — must be a number`);
      handleError(new Error("Target port must be a valid number"), {
        category: ErrorCategory.CONFIGURATION,
        severity: ErrorSeverity.HIGH,
        component: "cli-guard",
        context: { providedTargetPort: options.targetPort },
        exitOnCritical: true,
      });
      return;
    }

    // Default command to fall back on if user didn't specify one
    const command = commandArg.length > 0 ? commandArg : ["npm", "run", "dev"];

    printSection("Guard Configuration");
    printStatus("Proxy port",     `localhost:${publicPort}`, "ok");
    printStatus("Dev command",    command.join(" "));
    printStatus("Target port",    targetPort ? String(targetPort) : "auto-assigned");
    printStatus("Host validation", "enabled",  "ok");
    printStatus("Origin check",   "enabled",   "ok");
    process.stdout.write("\n");

    try {
      await runDevServer({
        publicPort,
        command,
        targetPort,
      });
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(String(error)), {
        category: ErrorCategory.PROCESS,
        severity: ErrorSeverity.CRITICAL,
        component: "cli-guard",
        context: { publicPort, command: command.join(" ") },
        exitOnCritical: true,
      });
    }
  });

// --- Component B: MCP Watch Command ---
program
  .command("mcp-watch")
  .description("Monitor AI agent tool calls via MCP stdio wrapper for security violations")
  .argument("<serverCommand...>", "The real MCP server command to wrap")
  .option("-r, --root <path>", "Allowed project root directory for filesystem operations", process.cwd())
  .action(async (serverCommand: string[], options) => {
    const projectRoot = resolve(options.root);

    if (!existsSync(projectRoot)) {
      printErr(`Project root not found: ${projectRoot}`);
      handleError(new Error(`Project root directory not found: ${projectRoot}`), {
        category: ErrorCategory.FILESYSTEM,
        severity: ErrorSeverity.HIGH,
        component: "cli-mcp-watch",
        context: { projectRoot },
        exitOnCritical: true,
      });
      return;
    }

    if (!serverCommand || serverCommand.length === 0) {
      printErr("No MCP server command provided");
      handleError(new Error("No MCP server command provided"), {
        category: ErrorCategory.CONFIGURATION,
        severity: ErrorSeverity.HIGH,
        component: "cli-mcp-watch",
        exitOnCritical: true,
      });
      return;
    }

    // stdout is the MCP transport; this colorful readiness display is stderr-only.
    printMCPWatchReady(projectRoot);

    try {
      await startMCPWatch({
        serverCommand,
        projectRoot,
        enableDetection: true,
      });
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(String(error)), {
        category: ErrorCategory.PROCESS,
        severity: ErrorSeverity.CRITICAL,
        component: "cli-mcp-watch",
        context: { serverCommand: serverCommand.join(" "), projectRoot },
        exitOnCritical: true,
      });
    }
  });

// --- Component C: Secret Gate Command Group ---
const secretGate = program
  .command("secret-gate")
  .description("Manage in-memory secrets and credential brokering");

secretGate
  .command("init")
  .description("Airlock Secret Gate setup assistant")
  .option("-e, --env <path>", "Path to the .env file", ".env")
  .action(async (options) => {
    printBanner("Secret Gate", "1.0.0");
    printSection("Initialization");

    const envPath = resolve(options.env);

    if (!existsSync(envPath)) {
      printWarn(`No .env file found at: ${envPath}`);
      process.stdout.write("\n");
      printTip('Create your .env file with KEY=VALUE pairs');
      printTip(`Then run: airlock secret-gate start --env ${options.env as string}`);
      process.stdout.write("\n");
      return;
    }

    printOk(`Found .env file at: ${envPath}`);
    process.stdout.write("\n");
    printTip(`To load secrets into memory and remove plaintext file, run:`);
    process.stdout.write(`\n  ${C.cyan}airlock secret-gate start --env ${options.env as string}${C.reset}\n\n`);
  });

secretGate
  .command("start")
  .description("Start secrets broker daemon")
  .option("-e, --env <path>", "Path to the .env file to consume", ".env")
  .option("--delete-source", "Explicitly authorize deletion of the source .env file after successful load")
  .action(async (options) => {
    printBanner("Secret Gate", "1.0.0");
    printSection("Starting Secrets Broker");

    const envPath = resolve(options.env);

    try {
      if (existsSync(envPath)) {
        logger.info(`Loading secrets from ${envPath}`);
        await loadSecretsFromFile(envPath);
        printOk(`Secrets loaded into memory`);
      } else {
        printWarn(`No .env file found at ${envPath} — starting with empty keystore`);
        logger.warn(`No .env file found at ${envPath}. Starting with empty keystore.`);
      }

      await startBroker();
      printStatus("Socket path", getSocketPath(), "ok");
      printStatus("Broker status", "listening", "ok");
      process.stdout.write("\n");
      printTip("Connect with: import { getSecrets } from 'airlock/secretgate/client'");
      process.stdout.write("\n");
      
      // Delete source AFTER broker starts successfully, if requested
      if (options.deleteSource && existsSync(envPath)) {
         await import("node:fs/promises").then(fs => fs.unlink(envPath));
         printOk(`Plaintext secrets file securely removed: ${envPath}`);
      } else if (existsSync(envPath)) {
         printWarn(`Source file ${envPath} was NOT deleted (use --delete-source to authorize)`);
      }
      const stop = (): void => { void stopBroker().finally(() => process.exit(0)); };
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(String(error)), {
        category: ErrorCategory.PROCESS,
        severity: ErrorSeverity.CRITICAL,
        component: "cli-secret-gate",
        context: { envPath },
        exitOnCritical: true,
      });
    }
  });

// --- Component D: Status / Self-Test Command ---
program
  .command("status")
  .description("Show Airlock system status and run a quick self-test")
  .action(() => {
    printBanner("System Status", "1.0.0");
    printSection("Environment");

    // Node.js version
    const nodeVer = process.version;
    const nodeMajor = parseInt(nodeVer.slice(1));
    printStatus("Node.js",    nodeVer, nodeMajor >= 18 ? "ok" : "warn");

    // Platform
    printStatus("Platform",   process.platform);
    printStatus("Arch",       process.arch);

    // Check dist/ exists
    printSection("Build Status");
    const distCli = existsSync(resolve("dist/cli.js"));
    printStatus("dist/cli.js",    distCli ? "present" : "missing",  distCli ? "ok" : "warn");
    const distGuard = existsSync(resolve("dist/guard/runner.js"));
    printStatus("dist/guard",     distGuard ? "compiled" : "missing", distGuard ? "ok" : "warn");
    const distMCP = existsSync(resolve("dist/mcpwatch/watcher.js"));
    printStatus("dist/mcpwatch",  distMCP ? "compiled" : "missing",   distMCP ? "ok" : "warn");
    const distSG = existsSync(resolve("dist/secretgate/broker.js"));
    printStatus("dist/secretgate",distSG ? "compiled" : "missing",    distSG ? "ok" : "warn");

    if (!distCli || !distGuard || !distMCP || !distSG) {
      process.stdout.write("\n");
      printWarn("Build is incomplete. Run: npm run build");
    }

    // Check socket
    printSection("Secret Gate Socket");
    const sockPath = getSocketPath();
    const sockExists = existsSync(sockPath);
    printStatus("Socket file", sockExists ? `present; health unverified (${sockPath})` : "not present", sockExists ? "warn" : "blocked");

    printSection("Components");
    printStatus("Guard",      "not health-checked (run guard to start)", "warn");
    printStatus("MCP Watch",  "not health-checked (run mcp-watch to start)", "warn");
    printStatus("Secret Gate", sockExists ? "socket present; health unverified" : "not running", sockExists ? "warn" : "blocked");

    process.stdout.write("\n");
    printTip("Run 'airlock guard node test-server.js' to start a protected demo server");
    printTip("Run 'airlock mcp-watch <cmd>' to wrap an MCP server with monitoring");
    printTip("Run 'airlock secret-gate start' to start the secrets broker");
    process.stdout.write("\n");
  });

// Parsing CLI commands
program.showSuggestionAfterError(true);
program.parse(process.argv);

if (!process.argv.slice(2).length) {
  printBanner("Security Toolkit", "1.0.0");
  program.help();
}
