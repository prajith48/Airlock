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

import pinoPretty from "pino-pretty";
import { createWriteStream } from "node:fs";

/**
 * Creates a logger instance for a specific component
 *
 * @param component - The component name for log categorization
 * @param logFilePath - Optional path to write logs to disk (default: ./airlock.log)
 * @returns Configured pino logger instance
 */
export function createLogger(component: Component, logFilePath?: string) {
  // Use synchronous streams to avoid interleaving with child process stdio
  const prettyStream = pinoPretty({
    colorize: true,
    translateTime: "HH:MM:ss",
    ignore: "pid,hostname,component",
    messageFormat: `\x1b[2m[{component}]\x1b[0m {msg}`,
    levelFirst: false,
    singleLine: true,
    destination: 2, // stderr
  });

  const logPath = logFilePath || "airlock.log";
  const fileStream = createWriteStream(logPath, { flags: "a" });

  const streams = [
    { stream: prettyStream, level: "info" as const },
    { stream: fileStream, level: "debug" as const },
  ];

  const logger = pino({
    level: process.env.LOG_LEVEL || "debug",
    base: { component },
  }, pino.multistream(streams));

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
