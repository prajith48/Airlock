/**
 * Header validation for DNS rebinding protection
 *
 * Implements FR-4: Reject requests with invalid Host/Origin headers
 * by dropping the TCP connection (not sending 403)
 *
 * Design rationale (SRS Part V - Threat Model): DNS rebinding attacks work by
 * changing the DNS record after initial trust check. By validating Host/Origin
 * on every request, we ensure the browser is genuinely talking to localhost,
 * not an attacker's domain that now resolves to 127.0.0.1.
 */

import http from "node:http";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("guard");

/**
 * Allowed Host header values for localhost access
 */
const ALLOWED_HOSTS = ["localhost", "127.0.0.1"];

/**
 * Allowed Origin/Referer patterns for cross-origin requests
 * These patterns ensure requests originate from the local machine
 */
const ALLOWED_ORIGIN_PATTERNS = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/localhost(:\d+)?$/,
  /^https:\/\/127\.0\.0\.1(:\d+)?$/,
];

/**
 * Validates that the Host header matches localhost/127.0.0.1
 *
 * @param host - The Host header value from the request
 * @returns true if valid, false if suspicious
 */
export function validateHost(host: string | undefined): boolean {
  if (!host) {
    // Missing Host header is suspicious
    logger.warn("Request missing Host header");
    return false;
  }

  // Extract hostname without port (Host header format: "hostname:port")
  const hostname = host.split(":")[0];

  if (!hostname || !ALLOWED_HOSTS.includes(hostname)) {
    logger.warn({ host, hostname }, "Invalid Host header detected");
    return false;
  }

  return true;
}

/**
 * Validates that Origin/Referer headers match local patterns
 *
 * @param origin - The Origin header value
 * @param referer - The Referer header value
 * @returns true if valid or not applicable, false if suspicious
 */
export function validateOrigin(
  origin: string | undefined,
  referer: string | undefined
): boolean {
  // If neither Origin nor Referer is present, allow it
  // (non-CORS requests like direct navigation don't have Origin)
  if (!origin && !referer) {
    return true;
  }

  // Check Origin first (more reliable than Referer)
  if (origin) {
    const isValid = ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
    if (!isValid) {
      logger.warn({ origin }, "Invalid Origin header detected");
      return false;
    }
  }

  // Also validate Referer if present (defense in depth)
  // Referer includes the full URL with path, so we extract just the origin
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
      const isValid = ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(refererOrigin));
      if (!isValid) {
        logger.warn({ referer, refererOrigin }, "Invalid Referer header detected");
        return false;
      }
    } catch {
      // Invalid URL format
      logger.warn({ referer }, "Malformed Referer header detected");
      return false;
    }
  }

  return true;
}

/**
 * Combined validation for HTTP requests
 * Returns true if request should be allowed, false if it should be dropped
 *
 * @param req - Incoming HTTP request
 * @returns true to allow, false to drop connection
 */
export function validateRequest(req: http.IncomingMessage): boolean {
  const host = req.headers.host;
  const origin = req.headers.origin as string | undefined;
  const referer = req.headers.referer as string | undefined;

  // Both checks must pass
  return validateHost(host) && validateOrigin(origin, referer);
}
