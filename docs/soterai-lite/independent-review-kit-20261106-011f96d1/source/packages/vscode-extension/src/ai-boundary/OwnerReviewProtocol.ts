import { randomUUID } from "node:crypto";

export const REVIEW_COOLDOWN_MS = 10_000;
export const REVIEW_LIFETIME_MS = 60_000;
export const MAX_REVIEW_AUDIT_RECORDS = 64;
export const MAX_REVIEW_AUDIT_BYTES = 32_768;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digest = /^[a-f0-9]{64}$/;
export interface OwnerReviewPlan {
    root: string; ruleDigest: string; revisionDigest: string; createdAt: number;
    cooldownUntil: number; expiresAt: number; challenge: string; nonce: string;
}
export function createOwnerReviewPlan(root: string, ruleDigest: string, revisionDigest: string, now: number, nonce = randomUUID()): OwnerReviewPlan {
    if (!root || !digest.test(ruleDigest) || !digest.test(revisionDigest) || !Number.isSafeInteger(now) || now < 0 || !uuid.test(nonce)) throw new Error("Invalid owner review metadata.");
    return Object.freeze({ root, ruleDigest, revisionDigest, createdAt: now, cooldownUntil: now + REVIEW_COOLDOWN_MS,
        expiresAt: now + REVIEW_LIFETIME_MS, challenge: `RELAX SESSION ${nonce.slice(0, 8)}`, nonce });
}
export function validateOwnerReview(plan: OwnerReviewPlan, typed: string | undefined, now: number, root: string, ruleDigest: string, revisionDigest: string): boolean {
    return Number.isSafeInteger(now) && now >= plan.cooldownUntil && now < plan.expiresAt && now >= plan.createdAt
        && typed === plan.challenge && root === plan.root && ruleDigest === plan.ruleDigest && revisionDigest === plan.revisionDigest;
}
export class OwnerReviewAttempt {
    private consumed = false;
    private readonly plan: OwnerReviewPlan;
    constructor(plan: OwnerReviewPlan) { this.plan = Object.freeze({ ...plan }); }
    consume(typed: string | undefined, now: number, root: string, ruleDigest: string, revisionDigest: string): boolean {
        if (this.consumed) return false;
        this.consumed = true;
        return validateOwnerReview(this.plan, typed, now, root, ruleDigest, revisionDigest);
    }
}
export interface ReviewAuditEntry {
    id: string; at: number; mode: "ordinary" | "sensitive"; ruleDigest: string;
    revisionDigest: string; outcome: "REVIEWED_SESSION";
}
export interface ReviewAudit { schemaVersion: 1; records: ReviewAuditEntry[] }
function strictObject(raw: unknown, keys: string[]): Record<string, unknown> {
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || ![Object.prototype, null].includes(Object.getPrototypeOf(raw))
        || Object.keys(raw).length !== keys.length || Object.keys(raw).some(key => !keys.includes(key))) throw new Error("Invalid review audit metadata.");
    return raw as Record<string, unknown>;
}
export function parseReviewAudit(raw: unknown): ReviewAudit {
    const serialized = JSON.stringify(raw);
    if (!serialized || Buffer.byteLength(serialized, "utf8") > MAX_REVIEW_AUDIT_BYTES) throw new Error("Review audit byte budget exceeded.");
    const value = strictObject(raw, ["schemaVersion", "records"]);
    if (value.schemaVersion !== 1 || !Array.isArray(value.records) || value.records.length > MAX_REVIEW_AUDIT_RECORDS) throw new Error("Invalid review audit schema or budget.");
    const seen = new Set<string>();
    const records = value.records.map(rawEntry => {
        const entry = strictObject(rawEntry, ["id", "at", "mode", "ruleDigest", "revisionDigest", "outcome"]);
        if (typeof entry.id !== "string" || !uuid.test(entry.id) || seen.has(entry.id)
            || typeof entry.at !== "number" || !Number.isFinite(entry.at) || entry.at < 0
            || !["ordinary", "sensitive"].includes(entry.mode as string) || entry.outcome !== "REVIEWED_SESSION"
            || typeof entry.ruleDigest !== "string" || !digest.test(entry.ruleDigest)
            || typeof entry.revisionDigest !== "string" || !digest.test(entry.revisionDigest)) throw new Error("Invalid review audit entry.");
        seen.add(entry.id);
        return { ...entry } as unknown as ReviewAuditEntry;
    });
    return { schemaVersion: 1, records };
}
