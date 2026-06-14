export class CyberRakshakError extends Error {
  public readonly status?: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, options: { status?: number; code?: string; details?: unknown; cause?: unknown } = {}) {
    super(message);
    this.name = "CyberRakshakError";
    this.status = options.status;
    this.code = options.code ?? "guard_error";
    this.details = options.details;
    if (options.cause) (this as { cause?: unknown }).cause = options.cause;
  }
}

export class CyberRakshakAuthError extends CyberRakshakError {
  constructor(message: string, status: number) {
    super(message, { status, code: "auth_error" });
    this.name = "CyberRakshakAuthError";
  }
}

export class CyberRakshakRateLimitError extends CyberRakshakError {
  public readonly retryAfter?: number;
  constructor(message: string, status: number, retryAfter?: number) {
    super(message, { status, code: "rate_limited" });
    this.name = "CyberRakshakRateLimitError";
    this.retryAfter = retryAfter;
  }
}

export class CyberRakshakValidationError extends CyberRakshakError {
  constructor(message: string, status: number, details?: unknown) {
    super(message, { status, code: "validation_error", details });
    this.name = "CyberRakshakValidationError";
  }
}

export class CyberRakshakNetworkError extends CyberRakshakError {
  constructor(message: string, cause?: unknown) {
    super(message, { code: "network_error", cause });
    this.name = "CyberRakshakNetworkError";
  }
}
