export type EscrowRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type EscrowActorType = "USER" | "ADMIN" | "SYSTEM";
export interface EscrowClientOptions {
    apiKey: string;
    baseUrl?: string;
    timeoutMs?: number;
    fetch?: typeof fetch;
    headers?: Record<string, string>;
}
export interface CreateEscrowTransactionRequest {
    sessionId: string;
    agentIdentityId?: string;
    transactionType: string;
    tool: string;
    action: string;
    target?: string;
    originalPayload?: string;
    safePayload?: string;
    riskLevel?: EscrowRiskLevel;
    policyAllowsCriticalReview?: boolean;
    expiresAt?: string;
    ttlSeconds?: number;
    metadata?: Record<string, unknown>;
}
export interface ResolveEscrowRequest {
    escrowTransactionId?: string;
    approvalToken?: string;
    reason?: string;
    actorType?: EscrowActorType;
    metadata?: Record<string, unknown>;
}
export interface EditAndApproveEscrowRequest extends ResolveEscrowRequest {
    editedPayload: string;
}
export interface ExecuteEscrowRequest {
    escrowTransactionId?: string;
    approvalToken?: string;
    metadata?: Record<string, unknown>;
}
export declare function createEscrowTransaction(options: EscrowClientOptions, input: CreateEscrowTransactionRequest): Promise<unknown>;
export declare function approveEscrowTransaction(options: EscrowClientOptions, input: ResolveEscrowRequest): Promise<unknown>;
export declare function denyEscrowTransaction(options: EscrowClientOptions, input: ResolveEscrowRequest): Promise<unknown>;
export declare function editAndApproveEscrow(options: EscrowClientOptions, input: EditAndApproveEscrowRequest): Promise<unknown>;
export declare function executeEscrowTransaction(options: EscrowClientOptions, input: ExecuteEscrowRequest): Promise<unknown>;
export declare function getEscrowTransaction(options: EscrowClientOptions, escrowTransactionId: string): Promise<unknown>;
export declare function listPendingEscrowTransactions(options: EscrowClientOptions): Promise<unknown>;
//# sourceMappingURL=escrow.d.ts.map