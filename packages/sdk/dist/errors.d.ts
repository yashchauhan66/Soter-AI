/**
 * Base error class for Soter SDK errors.
 * @deprecated Use {@link SoterError} for new integrations.
 */
export declare class CyberRakshakError extends Error {
    readonly status?: number;
    readonly code: string;
    readonly details?: unknown;
    constructor(message: string, options?: {
        status?: number;
        code?: string;
        details?: unknown;
        cause?: unknown;
    });
}
/**
 * @deprecated Use {@link SoterAuthError} for new integrations.
 */
export declare class CyberRakshakAuthError extends CyberRakshakError {
    constructor(message: string, status: number);
}
/**
 * @deprecated Use {@link SoterRateLimitError} for new integrations.
 */
export declare class CyberRakshakRateLimitError extends CyberRakshakError {
    readonly retryAfter?: number;
    constructor(message: string, status: number, retryAfter?: number);
}
/**
 * @deprecated Use {@link SoterValidationError} for new integrations.
 */
export declare class CyberRakshakValidationError extends CyberRakshakError {
    constructor(message: string, status: number, details?: unknown);
}
/**
 * @deprecated Use {@link SoterNetworkError} for new integrations.
 */
export declare class CyberRakshakNetworkError extends CyberRakshakError {
    constructor(message: string, cause?: unknown);
}
/**
 * Base error class for Soter SDK errors.
 */
export declare class SoterError extends CyberRakshakError {
    constructor(message: string, options?: {
        status?: number;
        code?: string;
        details?: unknown;
        cause?: unknown;
    });
}
/**
 * Authentication error raised on 401/403 responses.
 */
export declare class SoterAuthError extends SoterError {
    constructor(message: string, status: number);
}
/**
 * Rate-limit error raised on 429 responses.
 */
export declare class SoterRateLimitError extends SoterError {
    readonly retryAfter?: number;
    constructor(message: string, status: number, retryAfter?: number);
}
/**
 * Validation error raised on 400 responses.
 */
export declare class SoterValidationError extends SoterError {
    constructor(message: string, status: number, details?: unknown);
}
/**
 * Network error raised on timeouts or connection failures.
 */
export declare class SoterNetworkError extends SoterError {
    constructor(message: string, cause?: unknown);
}
//# sourceMappingURL=errors.d.ts.map