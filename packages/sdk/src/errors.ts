/**
 * Base error class for Soter SDK errors.
 */
export class SoterError extends Error {
  public readonly status?: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, options: { status?: number; code?: string; details?: unknown; cause?: unknown } = {}) {
    super(message);
    this.name = "SoterError";
    this.status = options.status;
    this.code = options.code ?? "guard_error";
    this.details = options.details;
    if (options.cause) (this as { cause?: unknown }).cause = options.cause;
  }
}

/**
 * Authentication error raised on 401/403 responses.
 */
export class SoterAuthError extends SoterError {
  constructor(message: string, status: number) {
    super(message, { status, code: "auth_error" });
    this.name = "SoterAuthError";
  }
}

/**
 * Rate-limit error raised on 429 responses.
 */
export class SoterRateLimitError extends SoterError {
  public readonly retryAfter?: number;
  constructor(message: string, status: number, retryAfter?: number) {
    super(message, { status, code: "rate_limited" });
    this.name = "SoterRateLimitError";
    this.retryAfter = retryAfter;
  }
}

/**
 * Validation error raised on 400 responses.
 */
export class SoterValidationError extends SoterError {
  constructor(message: string, status: number, details?: unknown) {
    super(message, { status, code: "validation_error", details });
    this.name = "SoterValidationError";
  }
}

/**
 * Network error raised on timeouts or connection failures.
 */
export class SoterNetworkError extends SoterError {
  constructor(message: string, cause?: unknown) {
    super(message, { code: "network_error", cause });
    this.name = "SoterNetworkError";
  }
}

// ─── Legacy CyberRakshak error aliases ──────────────────────────────────────
// These are the SAME class objects as their Soter* counterparts, so
// `instanceof` works in BOTH directions: existing code doing
// `err instanceof CyberRakshakError` still catches the canonical Soter errors,
// and new code doing `err instanceof SoterError` still catches anything the SDK
// throws. Do not turn these into subclasses — that would break one direction.

/** @deprecated Use {@link SoterError} for new integrations. */
export { SoterError as CyberRakshakError };

/** @deprecated Use {@link SoterAuthError} for new integrations. */
export { SoterAuthError as CyberRakshakAuthError };

/** @deprecated Use {@link SoterRateLimitError} for new integrations. */
export { SoterRateLimitError as CyberRakshakRateLimitError };

/** @deprecated Use {@link SoterValidationError} for new integrations. */
export { SoterValidationError as CyberRakshakValidationError };

/** @deprecated Use {@link SoterNetworkError} for new integrations. */
export { SoterNetworkError as CyberRakshakNetworkError };
