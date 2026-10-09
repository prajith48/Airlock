/**
 * Centralized logging utility for Airlock
 * Uses pino for structured, lightweight logging (NFR-4: resource efficiency)
 * with pino-pretty for beautiful, professional terminal output.
 */

import pino from "pino";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Log levels supported by Airlock
 */
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

/**
 * Component identifiers for log categorization
 */
export type Component = "guard" | "mcpwatch" | "secretgate" | "cli" | "errorHandler";

/**
 * Creates a logger instance for a specific component
 *
 * @param component - The component name for log categorization
 * @param logFilePath - Optional path to write logs to disk (default: ./airlock.log)
 * @returns Configured pino logger instance
 */
export function createLogger(component: Component, logFilePath?: string) {
  const destinations = [];

  // Professional terminal output: component prefix inline, no extra lines
  destinations.push({
    target: "pino-pretty",
    level: "info",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss",
      // Show component as a prefix tag, suppress pid/hostname
      ignore: "pid,hostname,component",
      messageFormat: `\x1b[2m[{component}]\x1b[0m {msg}`,
      levelFirst: false,
      singleLine: true,
    },
  });

  // File output for audit trail (always written as structured JSON for monitor.sh)
  const logPath = logFilePath || "airlock.log";
  destinations.push({
    target: "pino/file",
    level: "debug",
    options: { destination: logPath },
  });

  const logger = pino({
    level: process.env.LOG_LEVEL || "info",
    base: { component },
    transport: {
      targets: destinations,
    },
  });

  return logger;
}

/**
 * Ensure the log directory exists before writing
 *
 * @param logPath - Full path to the log file
 */
export async function ensureLogDirectory(logPath: string): Promise<void> {
  const dir = dirname(logPath);
  try {
    await mkdir(dir, { recursive: true });
  } catch (error) {
    // Directory likely already exists, or we don't have permissions
    console.warn(`Could not create log directory ${dir}:`, error);
  }
}

/**
 * Default logger for general CLI operations
 */
export const defaultLogger = createLogger("cli");
