/**
 * Canary secret system — plant a locally-generated, unique fake secret and later
 * detect if it surfaces in AI output, a prompt, or elsewhere in the workspace.
 * A canary hit is strong evidence that an AI tool read protected context.
 *
 * Privacy contract: the RAW canary token lives only in memory / SecretStorage.
 * Everything persisted (metadata, ledger, reports) carries the HASH and a
 * redacted preview only — never the raw token.
 */
export declare const CANARY_TOKEN_PREFIX = "sk-soter-canary-";
export interface Canary {
    id: string;
    /** Raw token — never persist to disk/ledger/report. */
    token: string;
    hash: string;
    redactedPreview: string;
    createdAt: string;
}
/** Persist-safe view of a canary (no raw token). */
export interface CanaryMetadata {
    id: string;
    hash: string;
    redactedPreview: string;
    createdAt: string;
}
export interface CanaryHit {
    id: string;
    hash: string;
    redactedPreview: string;
    /** Number of times the token appeared. */
    count: number;
}
/** Redacted preview safe to show in UI/logs: prefix + short tail, middle masked. */
export declare function canaryPreview(token: string): string;
/**
 * Generate a fresh canary. The token is shaped like an OpenAI-style key so the
 * existing SecretDetector also flags it if it slips into a scan.
 */
export declare function generateCanary(): Promise<Canary>;
/** Strip the raw token, leaving only persist-safe metadata. */
export declare function toCanaryMetadata(canary: Canary): CanaryMetadata;
export declare function hashCanary(token: string): Promise<string>;
/**
 * Scan `text` for any of the supplied canary tokens. Comparison happens in
 * memory against raw tokens; the returned hits carry only id/hash/preview so a
 * caller can log the result without ever persisting the raw token.
 */
export declare function matchCanaries(text: string, canaries: Array<Pick<Canary, "id" | "token" | "hash" | "redactedPreview">>): CanaryHit[];
//# sourceMappingURL=Canary.d.ts.map