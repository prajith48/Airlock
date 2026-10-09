/**
 * Path validation utilities for detecting traversal attacks and sensitive file access
 * Used by MCP Watch to flag suspicious file operations
 */

import { resolve, normalize, relative } from "node:path";

/**
 * Known sensitive paths that should trigger alerts
 * Configurable denylist as specified in the SRS (Section 2.2)
 */
export const SENSITIVE_PATHS = [
  ".ssh/",
  ".aws/",
  ".env",
  ".env.local",
  ".env.production",
  "/etc/passwd",
  "/etc/shadow",
  "id_rsa",
  "id_ed25519",
  ".npmrc",
  ".pypirc",
  "credentials",
  "config.json",
  "secrets.json",
] as const;

/**
 * Checks if a path attempts to escape a given root directory
 *
 * @param requestedPath - The path being accessed
 * @param projectRoot - The allowed root directory
 * @returns true if the path escapes the root, false otherwise
 */
export function isPathTraversal(
  requestedPath: string,
  projectRoot: string
): boolean {
  try {
    // Normalize both paths to handle . and .. segments
    const normalizedRoot = normalize(resolve(projectRoot));
    const normalizedPath = normalize(resolve(projectRoot, requestedPath));

    // Check if the resolved path is outside the project root
    const relativePath = relative(normalizedRoot, normalizedPath);

    // If the relative path starts with .. or is absolute, it's outside the root
    return relativePath.startsWith("..") || resolve(relativePath) === relativePath;
  } catch {
    // If path resolution fails, treat it as suspicious
    return true;
  }
}

/**
 * Checks if a path targets a known sensitive file or directory
 *
 * @param requestedPath - The path being accessed
 * @returns true if the path matches a sensitive pattern
 */
export function isSensitivePath(requestedPath: string): boolean {
  const normalized = normalize(requestedPath).toLowerCase();
  const segments = normalized.split("/").filter(s => s !== "");

  return SENSITIVE_PATHS.some((sensitivePath) => {
    const pattern = sensitivePath.toLowerCase();

    // If pattern ends with /, it's a directory - check if any segment matches
    if (pattern.endsWith("/")) {
      const dirName = pattern.slice(0, -1);
      return segments.includes(dirName);
    }

    // For absolute paths like /etc/passwd, check if normalized path matches
    if (pattern.startsWith("/")) {
      return normalized === pattern || normalized.startsWith(pattern + "/") || normalized.endsWith(pattern);
    }

    // Otherwise it's a file - check for exact segment match
    return segments.includes(pattern);
  });
}

/**
 * Combined check for both path traversal and sensitive file access
 *
 * @param requestedPath - The path being accessed
 * @param projectRoot - The allowed root directory
 * @returns Object with detection results and reason
 */
export function validatePath(
  requestedPath: string,
  projectRoot: string
): { isViolation: boolean; reason?: string } {
  // Check for path traversal first
  if (isPathTraversal(requestedPath, projectRoot)) {
    return {
      isViolation: true,
      reason: `Path traversal detected: "${requestedPath}" resolves outside project root`,
    };
  }

  // Check for sensitive path access
  if (isSensitivePath(requestedPath)) {
    return {
      isViolation: true,
      reason: `Sensitive path access: "${requestedPath}" matches known credential/config pattern`,
    };
  }

  return { isViolation: false };
}
