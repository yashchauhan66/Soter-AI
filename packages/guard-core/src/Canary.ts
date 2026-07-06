import { hashContent } from "./HashCache";

/**
 * Canary secret system — plant a locally-generated, unique fake secret and later
 * detect if it surfaces in AI output, a prompt, or elsewhere in the workspace.
 * A canary hit is strong evidence that an AI tool read protected context.
 *
 * Privacy contract: the RAW canary token lives only in memory / SecretStorage.
 * Everything persisted (metadata, ledger, reports) carries the HASH and a
 * redacted preview only — never the raw token.
 */

export const CANARY_TOKEN_PREFIX = "sk-soter-canary-";

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

function randomHex(bytes: number): string {
    const arr = new Uint8Array(bytes);
    const g = (globalThis as any).crypto;
    if (g?.getRandomValues) {
        g.getRandomValues(arr);
    } else {
        for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Redacted preview safe to show in UI/logs: prefix + short tail, middle masked. */
export function canaryPreview(token: string): string {
    if (token.length <= 12) return `${CANARY_TOKEN_PREFIX}****`;
    return `${token.slice(0, CANARY_TOKEN_PREFIX.length + 2)}${"*".repeat(8)}${token.slice(-2)}`;
}

/**
 * Generate a fresh canary. The token is shaped like an OpenAI-style key so the
 * existing SecretDetector also flags it if it slips into a scan.
 */
export async function generateCanary(): Promise<Canary> {
    const token = `${CANARY_TOKEN_PREFIX}${randomHex(20)}`;
    const hash = await hashContent(token);
    return {
        id: `canary_${hash.slice(0, 12)}`,
        token,
        hash,
        redactedPreview: canaryPreview(token),
        createdAt: new Date().toISOString(),
    };
}

/** Strip the raw token, leaving only persist-safe metadata. */
export function toCanaryMetadata(canary: Canary): CanaryMetadata {
    return { id: canary.id, hash: canary.hash, redactedPreview: canary.redactedPreview, createdAt: canary.createdAt };
}

export async function hashCanary(token: string): Promise<string> {
    return hashContent(token);
}

/**
 * Scan `text` for any of the supplied canary tokens. Comparison happens in
 * memory against raw tokens; the returned hits carry only id/hash/preview so a
 * caller can log the result without ever persisting the raw token.
 */
export function matchCanaries(text: string, canaries: Array<Pick<Canary, "id" | "token" | "hash" | "redactedPreview">>): CanaryHit[] {
    const hits: CanaryHit[] = [];
    for (const c of canaries) {
        if (!c.token) continue;
        let count = 0;
        let idx = text.indexOf(c.token);
        while (idx !== -1) {
            count++;
            idx = text.indexOf(c.token, idx + c.token.length);
        }
        if (count > 0) {
            hits.push({ id: c.id, hash: c.hash, redactedPreview: c.redactedPreview ?? canaryPreview(c.token), count });
        }
    }
    return hits;
}
