"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SoterNetworkError = exports.SoterValidationError = exports.SoterRateLimitError = exports.SoterAuthError = exports.SoterError = exports.CyberRakshakNetworkError = exports.CyberRakshakValidationError = exports.CyberRakshakRateLimitError = exports.CyberRakshakAuthError = exports.CyberRakshakError = void 0;
/**
 * Base error class for Soter SDK errors.
 * @deprecated Use {@link SoterError} for new integrations.
 */
class CyberRakshakError extends Error {
    constructor(message, options = {}) {
        super(message);
        this.name = "CyberRakshakError";
        this.status = options.status;
        this.code = options.code ?? "guard_error";
        this.details = options.details;
        if (options.cause)
            this.cause = options.cause;
    }
}
exports.CyberRakshakError = CyberRakshakError;
/**
 * @deprecated Use {@link SoterAuthError} for new integrations.
 */
class CyberRakshakAuthError extends CyberRakshakError {
    constructor(message, status) {
        super(message, { status, code: "auth_error" });
        this.name = "CyberRakshakAuthError";
    }
}
exports.CyberRakshakAuthError = CyberRakshakAuthError;
/**
 * @deprecated Use {@link SoterRateLimitError} for new integrations.
 */
class CyberRakshakRateLimitError extends CyberRakshakError {
    constructor(message, status, retryAfter) {
        super(message, { status, code: "rate_limited" });
        this.name = "CyberRakshakRateLimitError";
        this.retryAfter = retryAfter;
    }
}
exports.CyberRakshakRateLimitError = CyberRakshakRateLimitError;
/**
 * @deprecated Use {@link SoterValidationError} for new integrations.
 */
class CyberRakshakValidationError extends CyberRakshakError {
    constructor(message, status, details) {
        super(message, { status, code: "validation_error", details });
        this.name = "CyberRakshakValidationError";
    }
}
exports.CyberRakshakValidationError = CyberRakshakValidationError;
/**
 * @deprecated Use {@link SoterNetworkError} for new integrations.
 */
class CyberRakshakNetworkError extends CyberRakshakError {
    constructor(message, cause) {
        super(message, { code: "network_error", cause });
        this.name = "CyberRakshakNetworkError";
    }
}
exports.CyberRakshakNetworkError = CyberRakshakNetworkError;
// ─── Soter-branded error aliases ────────────────────────────────────────────
/**
 * Base error class for Soter SDK errors.
 */
class SoterError extends CyberRakshakError {
    constructor(message, options = {}) {
        super(message, options);
        this.name = "SoterError";
    }
}
exports.SoterError = SoterError;
/**
 * Authentication error raised on 401/403 responses.
 */
class SoterAuthError extends SoterError {
    constructor(message, status) {
        super(message, { status, code: "auth_error" });
        this.name = "SoterAuthError";
    }
}
exports.SoterAuthError = SoterAuthError;
/**
 * Rate-limit error raised on 429 responses.
 */
class SoterRateLimitError extends SoterError {
    constructor(message, status, retryAfter) {
        super(message, { status, code: "rate_limited" });
        this.name = "SoterRateLimitError";
        this.retryAfter = retryAfter;
    }
}
exports.SoterRateLimitError = SoterRateLimitError;
/**
 * Validation error raised on 400 responses.
 */
class SoterValidationError extends SoterError {
    constructor(message, status, details) {
        super(message, { status, code: "validation_error", details });
        this.name = "SoterValidationError";
    }
}
exports.SoterValidationError = SoterValidationError;
/**
 * Network error raised on timeouts or connection failures.
 */
class SoterNetworkError extends SoterError {
    constructor(message, cause) {
        super(message, { code: "network_error", cause });
        this.name = "SoterNetworkError";
    }
}
exports.SoterNetworkError = SoterNetworkError;
