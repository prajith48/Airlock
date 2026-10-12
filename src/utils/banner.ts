/**
 * Terminal Banner Utilities for Airlock
 *
 * Provides consistent, professional ASCII-art headers
 * and status formatting for all CLI commands.
 */

// ANSI escape codes
const C = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  dim:     "\x1b[2m",
  red:     "\x1b[31m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  blue:    "\x1b[34m",
  magenta: "\x1b[35m",
  cyan:    "\x1b[36m",
  white:   "\x1b[37m",
  bgRed:   "\x1b[41m",
  bgGreen: "\x1b[42m",
} as const;

export const COLORS = C;

/**
 * Prints the Airlock startup banner with version and mode information
 */
export function printBanner(mode: string, version = "1.0.0"): void {
  process.stderr.write("\n");
  process.stderr.write(`${C.cyan}${C.bold}`);
  process.stderr.write("  ╔═══════════════════════════════════════════╗\n");
  process.stderr.write("  ║   █████╗ ██╗██████╗ ██╗      ██████╗  ██╗║\n");
  process.stderr.write("  ║  ██╔══██╗██║██╔══██╗██║     ██╔═══██╗██╔╝║\n");
  process.stderr.write("  ║  ███████║██║██████╔╝██║     ██║   ██║█╔╝ ║\n");
  process.stderr.write("  ║  ██╔══██║██║██╔══██╗██║     ██║   ██║╗╗  ║\n");
  process.stderr.write("  ║  ██║  ██║██║██║  ██║███████╗╚██████╔╝██╗ ║\n");
  process.stderr.write("  ║  ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝║\n");
  process.stderr.write("  ╚═══════════════════════════════════════════╝\n");
  process.stderr.write(`${C.reset}`);
  process.stderr.write(
    `  ${C.dim}Local-First Security Layer${C.reset}` +
    `  ${C.blue}v${version}${C.reset}` +
    `  ${C.yellow}◆ ${mode}${C.reset}\n`
  );
  process.stderr.write("\n");
}

/**
 * Prints a section divider with a title
 */
export function printSection(title: string): void {
  const line = "─".repeat(50);
  process.stderr.write(`\n  ${C.dim}${line}${C.reset}\n`);
  process.stderr.write(`  ${C.bold}${C.white}${title}${C.reset}\n`);
  process.stderr.write(`  ${C.dim}${line}${C.reset}\n\n`);
}

/**
 * Prints a status row: label → value
 */
export function printStatus(label: string, value: string, badge?: "ok" | "warn" | "blocked"): void {
  const icon = badge === "ok" ? `${C.green}✔${C.reset}` :
               badge === "warn" ? `${C.yellow}⚠${C.reset}` :
               badge === "blocked" ? `${C.red}✘${C.reset}` :
               `${C.blue}›${C.reset}`;
  const padded = label.padEnd(22);
  process.stderr.write(`  ${icon}  ${C.dim}${padded}${C.reset}  ${C.bold}${value}${C.reset}\n`);
}

/**
 * Prints a success line
 */
export function printOk(msg: string): void {
  process.stderr.write(`  ${C.green}${C.bold}✔${C.reset}  ${msg}\n`);
}

/**
 * Prints a warning line
 */
export function printWarn(msg: string): void {
  process.stderr.write(`  ${C.yellow}${C.bold}⚠${C.reset}  ${msg}\n`);
}

/**
 * Prints an error line
 */
export function printErr(msg: string): void {
  process.stderr.write(`  ${C.red}${C.bold}✘${C.reset}  ${msg}\n`);
}

/**
 * Prints a security event (blocked/detected)
 */
export function printSecurityEvent(type: "blocked" | "detected", msg: string): void {
  const prefix = type === "blocked"
    ? `${C.bgRed}${C.bold} BLOCKED ${C.reset}`
    : `${C.yellow}${C.bold} DETECTED ${C.reset}`;
  process.stderr.write(`  ${prefix}  ${msg}\n`);
}

/**
 * Prints a live connection line showing the proxy routing
 */
export function printProxyReady(publicPort: number, targetPort: number): void {
  process.stderr.write(
    `\n  ${C.green}${C.bold}◉  Guard Active${C.reset}\n` +
    `     ${C.cyan}http://localhost:${publicPort}${C.reset}` +
    `  ${C.dim}──────────►${C.reset}` +
    `  ${C.dim}127.0.0.1:${targetPort}${C.reset}  ${C.dim}(internal)${C.reset}\n\n`
  );
}

/** MCP stdout is protocol data, so this intentionally writes only to stderr. */
export function printMCPWatchReady(projectRoot: string): void {
  process.stderr.write(
    `\n  ${C.magenta}${C.bold}◉  MCP Watch Active${C.reset}\n` +
    `     ${C.yellow}MONITORING ONLY${C.reset} ${C.dim}— suspicious calls are logged, not blocked${C.reset}\n` +
    `     ${C.cyan}${projectRoot}${C.reset} ${C.dim}is the monitored project root${C.reset}\n\n`
  );
}

/**
 * Prints a tip/hint line
 */
export function printTip(msg: string): void {
  process.stderr.write(`  ${C.dim}Tip:${C.reset} ${C.dim}${msg}${C.reset}\n`);
}
