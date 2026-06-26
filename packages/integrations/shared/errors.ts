/**
 * Error types shared by every Soter integration node/plugin/connector.
 *
 * These are intentionally small and dependency-free so they can be re-exported
 * from n8n nodes, Flowise tools, Zapier actions, etc. without pulling in the
 * full Soter JS SDK. They mirror the SDK error taxonomy
 * (auth / rate-limit / validation / network) so behaviour is consistent across
 * the platform.
 *
 * SECURITY: error messages here must never embed a raw API key. Callers should
 * pass already-masked values. See {@link maskApiKey} in `validators.ts`.
 */

export type SoterErrorCode =
  | "config_error"
  | "guard_error"
  | "auth_error"
  | "rate_limited"
  | "validation_error"
  | "network_error";

/** Base error for all Soter integration failures. */
export class SoterIntegrationError extends Error {
  public readonly status?: number;
  public readonly code: SoterErrorCode;
  public readonly details?: unknown;

  constructor(
    message: string,
    options: { status?: number; code?: SoterErrorCode; details?: unknown; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "SoterIntegrationError";
    this.status = options.status;
    this.code = options.code ?? "guard_error";
    this.details = options.details;
    if (options.cause) (this as { cause?: unknown }).cause = options.cause;
  }
}

/** Raised when the API key is missing/invalid (HTTP 401/403). */
export class SoterAuthError extends SoterIntegrationError {
  constructor(message: string, status = 401) {
    super(message, { status, code: "auth_error" });
    this.name = "SoterAuthError";
  }
}

/** Raised when a per-minute or monthly limit is exceeded (HTTP 429). */
export class SoterRateLimitError extends SoterIntegrationError {
  public readonly retryAfter?: number;
  constructor(message: string, status = 429, retryAfter?: number) {
    super(message, { status, code: "rate_limited" });
    this.name = "SoterRateLimitError";
    this.retryAfter = retryAfter;
  }
}

/** Raised when input fails client-side validation or the API returns 400. */
export class SoterValidationError extends SoterIntegrationError {
  constructor(message: string, status = 400, details?: unknown) {
    super(message, { status, code: "validation_error", details });
    this.name = "SoterValidationError";
  }
}

/** Raised when the request cannot reach the Soter API (timeout/DNS/etc.). */
export class SoterNetworkError extends SoterIntegrationError {
  constructor(message: string, cause?: unknown) {
    super(message, { code: "network_error", cause });
    this.name = "SoterNetworkError";
  }
}

/**
 * Convert any thrown value into a user-safe message that never leaks secrets.
 * Use this in node `catch` blocks before surfacing the error to a workflow UI.
 */
export function toSafeErrorMessage(error: unknown): string {
  if (error instanceof SoterIntegrationError) return error.message;
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred while contacting Soter Guard.";
}
