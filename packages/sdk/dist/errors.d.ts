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
export declare class CyberRakshakAuthError extends CyberRakshakError {
    constructor(message: string, status: number);
}
export declare class CyberRakshakRateLimitError extends CyberRakshakError {
    readonly retryAfter?: number;
    constructor(message: string, status: number, retryAfter?: number);
}
export declare class CyberRakshakValidationError extends CyberRakshakError {
    constructor(message: string, status: number, details?: unknown);
}
export declare class CyberRakshakNetworkError extends CyberRakshakError {
    constructor(message: string, cause?: unknown);
}
//# sourceMappingURL=errors.d.ts.map