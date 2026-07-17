"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CyberRakshakNetworkError = exports.CyberRakshakValidationError = exports.CyberRakshakRateLimitError = exports.CyberRakshakAuthError = exports.CyberRakshakError = exports.SoterNetworkError = exports.SoterValidationError = exports.SoterRateLimitError = exports.SoterAuthError = exports.SoterError = void 0;
/**
 * Base error class for Soter SDK errors.
 */
class SoterError extends Error {
    constructor(message, options = {}) {
        super(message);
        this.name = "SoterError";
        this.status = options.status;
        this.code = options.code ?? "guard_error";
        this.details = options.details;
        if (options.cause)
            this.cause = options.cause;
    }
}
exports.SoterError = SoterError;
exports.CyberRakshakError = SoterError;
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
exports.CyberRakshakAuthError = SoterAuthError;
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
exports.CyberRakshakRateLimitError = SoterRateLimitError;
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
exports.CyberRakshakValidationError = SoterValidationError;
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
exports.CyberRakshakNetworkError = SoterNetworkError;
