/**
 * Centralized Error Handling and Recovery
 *
 * Provides consistent error handling, logging, and recovery strategies
 * across all Airlock components.
 */

import { createLogger } from "./logger.js";

const logger = createLogger("errorHandler");

/**
 * Error categories for better tracking and handling
 */
export enum ErrorCategory {
  NETWORK = "NETWORK",
  FILESYSTEM = "FILESYSTEM",
  VALIDATION = "VALIDATION",
  PROCESS = "PROCESS",
  CONFIGURATION = "CONFIGURATION",
  SECURITY = "SECURITY",
  UNKNOWN = "UNKNOWN",
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = "LOW",        // Logged but operation continues
  MEDIUM = "MEDIUM",  // Operation fails but system continues
  HIGH = "HIGH",      // Component stops but others continue
  CRITICAL = "CRITICAL", // System shutdown required
}

/**
 * Enhanced error information
 */
export interface ErrorInfo {
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  originalError?: Error | unknown;
  context?: Record<string, unknown>;
  timestamp: string;
  recoveryAction?: string | undefined;
}

/**
 * Error metrics tracking
 */
class ErrorMetrics {
  private errorCounts: Map<ErrorCategory, number> = new Map();
  private lastErrors: ErrorInfo[] = [];
  private readonly maxLastErrors = 100;

  track(errorInfo: ErrorInfo): void {
    const current = this.errorCounts.get(errorInfo.category) || 0;
    this.errorCounts.set(errorInfo.category, current + 1);

    this.lastErrors.unshift(errorInfo);
    if (this.lastErrors.length > this.maxLastErrors) {
      this.lastErrors = this.lastErrors.slice(0, this.maxLastErrors);
    }
  }

  getStats() {
    return {
      totalErrors: Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0),
      byCategory: Object.fromEntries(this.errorCounts),
      recentErrors: this.lastErrors.slice(0, 10),
    };
  }

  reset(): void {
    this.errorCounts.clear();
    this.lastErrors = [];
  }
}

export const errorMetrics = new ErrorMetrics();

/**
 * Categorizes Node.js errors by their error code
 */
export function categorizeNodeError(error: NodeJS.ErrnoException): ErrorCategory {
  const networkCodes = ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "ENETUNREACH"];
  const fileSystemCodes = ["ENOENT", "EACCES", "EPERM", "EISDIR", "ENOTDIR", "EMFILE"];
  const addressCodes = ["EADDRINUSE", "EADDRNOTAVAIL"];

  if (error.code && networkCodes.includes(error.code)) {
    return ErrorCategory.NETWORK;
  }
  if (error.code && fileSystemCodes.includes(error.code)) {
    return ErrorCategory.FILESYSTEM;
  }
  if (error.code && addressCodes.includes(error.code)) {
    return ErrorCategory.CONFIGURATION;
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Provides helpful recovery suggestions based on error type
 */
export function getRecoverySuggestion(error: NodeJS.ErrnoException, context?: Record<string, unknown>): string {
  const port = context?.port;
  const path = context?.path;

  switch (error.code) {
    case "EADDRINUSE":
      return `Port ${port} is in use. Try: kill $(lsof -t -i:${port}) or use a different port`;

    case "EACCES":
      if (port && Number(port) < 1024) {
        return `Port ${port} requires elevated privileges. Use a port above 1024 or run with sudo (not recommended)`;
      }
      return `Permission denied. Check file/directory permissions${path ? ` for ${path}` : ""}`;

    case "ENOENT":
      return `File or directory not found${path ? `: ${path}` : ""}. Verify the path exists`;

    case "ECONNREFUSED":
      return `Connection refused. Ensure the target service is running${port ? ` on port ${port}` : ""}`;

    case "ETIMEDOUT":
      return "Connection timed out. Check network connectivity and firewall settings";

    case "EMFILE":
      return "Too many open files. Increase system file descriptor limit: ulimit -n 4096";

    case "EPERM":
      return "Operation not permitted. Check process permissions and ownership";

    default:
      return "No specific recovery action available. Check logs for details";
  }
}

/**
 * Handles errors with consistent logging and tracking
 */
export function handleError(
  error: Error | NodeJS.ErrnoException | unknown,
  options: {
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    context?: Record<string, unknown>;
    component?: string;
    exitOnCritical?: boolean;
  } = {}
): ErrorInfo {
  const {
    category: providedCategory,
    severity = ErrorSeverity.MEDIUM,
    context = {},
    component = "unknown",
    exitOnCritical = true,
  } = options;

  const isNodeError = error instanceof Error && "code" in error;
  const nodeError = isNodeError ? error as NodeJS.ErrnoException : null;

  const category = providedCategory ||
    (nodeError ? categorizeNodeError(nodeError) : ErrorCategory.UNKNOWN);

  const message = error instanceof Error ? error.message : String(error);
  const recoveryAction = nodeError ? getRecoverySuggestion(nodeError, context) : undefined;

  const errorInfo: ErrorInfo = {
    category,
    severity,
    message,
    originalError: error,
    context,
    timestamp: new Date().toISOString(),
    recoveryAction,
  };

  // Track metrics
  errorMetrics.track(errorInfo);

  // Log based on severity
  const logContext = {
    category,
    severity,
    component,
    ...context,
    ...(nodeError?.code ? { errorCode: nodeError.code } : {}),
    ...(recoveryAction ? { recovery: recoveryAction } : {}),
  };

  switch (severity) {
    case ErrorSeverity.LOW:
      logger.debug(logContext, message);
      break;
    case ErrorSeverity.MEDIUM:
      logger.warn(logContext, message);
      break;
    case ErrorSeverity.HIGH:
      logger.error(logContext, message);
      break;
    case ErrorSeverity.CRITICAL:
      logger.fatal(logContext, message);
      if (exitOnCritical) {
        process.exit(1);
      }
      break;
  }

  return errorInfo;
}

/**
 * Wraps async functions with error handling
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: {
    component: string;
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    onError?: (error: ErrorInfo) => void;
  }
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      const errorInfo = handleError(error, {
        ...options,
        exitOnCritical: false,
      });

      if (options.onError) {
        options.onError(errorInfo);
      }

      throw error;
    }
  }) as T;
}

/**
 * Retry logic for transient failures
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delayMs?: number;
    exponentialBackoff?: boolean;
    component?: string;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    exponentialBackoff = true,
    component = "unknown",
    onRetry,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts) {
        handleError(lastError, {
          component,
          severity: ErrorSeverity.HIGH,
          context: { attempts: maxAttempts },
        });
        throw lastError;
      }

      const delay = exponentialBackoff ? delayMs * Math.pow(2, attempt - 1) : delayMs;

      logger.warn(
        { component, attempt, maxAttempts, delay },
        `Operation failed, retrying in ${delay}ms: ${lastError.message}`
      );

      if (onRetry) {
        onRetry(attempt, lastError);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Graceful degradation wrapper
 */
export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T> | T,
  options: {
    component: string;
    description?: string;
  }
): Promise<T> {
  try {
    return await primary();
  } catch (error) {
    logger.warn(
      { component: options.component, description: options.description },
      `Primary operation failed, using fallback: ${error instanceof Error ? error.message : String(error)}`
    );
    return await fallback();
  }
}

/**
 * Get current error statistics
 */
export function getErrorStats() {
  return errorMetrics.getStats();
}

/**
 * Reset error metrics (useful for testing)
 */
export function resetErrorMetrics(): void {
  errorMetrics.reset();
}
