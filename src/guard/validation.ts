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
 * Validates that the Host header matches localhost/127.0.0.1
 *
 * @param host - The Host header value from the request
 * @returns true if valid, false if suspicious
 */
export function validateHost(host: string | undefined): boolean {
  if (!host) {
    logger.warn("Request missing Host header");
    return false;
  }

  // Accept only an exact localhost hostname, optionally followed
  // by a numeric TCP port. Do not split blindly on ":".
  const match = /^(localhost|127\.0\.0\.1)(?::([0-9]+))?$/i.exec(host);

  if (!match) {
    logger.warn({ host }, "Invalid Host header detected");
    return false;
  }

  const hostname = match[1]!.toLowerCase();
  const portText = match[2];

  if (!ALLOWED_HOSTS.includes(hostname)) {
    logger.warn({ host, hostname }, "Invalid Host header detected");
    return false;
  }

  if (portText !== undefined) {
    const port = Number(portText);

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      logger.warn({ host, port }, "Invalid port in Host header");
      return false;
    }
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
  if (!origin && !referer) {
    return true;
  }

  const validateUrl = (urlString: string) => {
    try {
      const url = new URL(urlString);
      if (url.protocol !== "http:" && url.protocol !== "https:") return false;
      const hostname = url.hostname.toLowerCase();
      if (hostname !== "localhost" && hostname !== "127.0.0.1") return false;
      if (url.port) {
        const port = Number(url.port);
        if (!Number.isInteger(port) || port < 1 || port > 65535) return false;
      }
      if (url.username || url.password) return false;
      return true;
    } catch {
      return false;
    }
  };

  if (origin && !validateUrl(origin)) {
    logger.warn({ origin }, "Invalid Origin header detected");
    return false;
  }

  if (referer && !validateUrl(referer)) {
    logger.warn({ referer }, "Invalid Referer header detected");
    return false;
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
  // Node exposes duplicate headers via rawHeaders. A proxy must not choose one
  // value from an ambiguous Host/Origin pair.
  const duplicateSensitiveHeader = (name: string): boolean => {
    let count = 0;
    const rawHeaders = req.rawHeaders;
    // Unit callers and a few adapters provide only headers; Node HTTP requests
    // always have rawHeaders, which is where duplicate detection is meaningful.
    if (!rawHeaders) return false;
    for (let index = 0; index < rawHeaders.length; index += 2) {
      if (rawHeaders[index]?.toLowerCase() === name) count += 1;
    }
    return count > 1;
  };
  if (duplicateSensitiveHeader("host") || duplicateSensitiveHeader("origin") || duplicateSensitiveHeader("referer")) {
    logger.warn("Request contains duplicate security-sensitive headers");
    return false;
  }
  const host = req.headers.host;
  const origin = req.headers.origin as string | undefined;
  const referer = req.headers.referer as string | undefined;

  // Both checks must pass
  return validateHost(host) && validateOrigin(origin, referer);
}
