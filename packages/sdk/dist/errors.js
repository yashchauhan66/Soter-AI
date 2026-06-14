"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CyberRakshakNetworkError = exports.CyberRakshakValidationError = exports.CyberRakshakRateLimitError = exports.CyberRakshakAuthError = exports.CyberRakshakError = void 0;
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
class CyberRakshakAuthError extends CyberRakshakError {
    constructor(message, status) {
        super(message, { status, code: "auth_error" });
        this.name = "CyberRakshakAuthError";
    }
}
exports.CyberRakshakAuthError = CyberRakshakAuthError;
class CyberRakshakRateLimitError extends CyberRakshakError {
    constructor(message, status, retryAfter) {
        super(message, { status, code: "rate_limited" });
        this.name = "CyberRakshakRateLimitError";
        this.retryAfter = retryAfter;
    }
}
exports.CyberRakshakRateLimitError = CyberRakshakRateLimitError;
class CyberRakshakValidationError extends CyberRakshakError {
    constructor(message, status, details) {
        super(message, { status, code: "validation_error", details });
        this.name = "CyberRakshakValidationError";
    }
}
exports.CyberRakshakValidationError = CyberRakshakValidationError;
class CyberRakshakNetworkError extends CyberRakshakError {
    constructor(message, cause) {
        super(message, { code: "network_error", cause });
        this.name = "CyberRakshakNetworkError";
    }
}
exports.CyberRakshakNetworkError = CyberRakshakNetworkError;
