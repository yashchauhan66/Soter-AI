import { randomUUID, createHash } from "node:crypto";
import { types } from "node:util";
import { RegisteredSecretMatcher } from "./RegisteredSecretMatcher";
import { decodeBoundedJson } from "../../../apps/local-ai-broker/src/BoundedJson";
import { createFixedHttpsJsonGet, fixedOperationUrl, type FixedJsonGetTransport } from "./FixedHttpsJsonGet";

export const SECRETLESS_OPERATION_LIMITS = Object.freeze({ operations: 16, fields: 16, reviews: 32, grants: 32,
    active: 4, reviewMs: 30000, grantMs: 30000, requestMs: 5000, responseBytes: 65536, outputBytes: 16384,
    credentialMaxMs: 15 * 60 * 1000 });
export interface OperationBinding {
    readonly sessionId: string;
    readonly imageDigest: string;
    readonly artifactDigest: string;
    readonly policyDigest: string;
}
/** Trusted owner configuration; never accepted from the isolated agent. */
export interface FixedJsonGetOperation {
    readonly id: string;
    readonly label: string;
    readonly account: string;
    readonly resource: string;
    readonly url: string;
    readonly responseFields: readonly string[];
}
export interface CredentialLeaseRequest {
    readonly operation: FixedJsonGetOperation;
    readonly binding: OperationBinding;
    readonly operationDigest: string;
}
/** Host-only issuer adapter. Its upstream expiry must come from an issuer;
 * local approval expiry cannot be used to claim that a static token expires. */
export interface CredentialLease {
    readonly bearerToken: string;
    readonly credentialExpiresAt: number;
    readonly operationDigest: string;
    readonly account: string;
    readonly resource: string;
    readonly outputSecretValues: readonly string[];
    dispose(): void | Promise<void>;
}
export interface CredentialLeaseProvider {
    acquire(request: CredentialLeaseRequest, signal: AbortSignal): Promise<CredentialLease>;
}
export interface OperationReview {
    readonly id: string;
    readonly operation: FixedJsonGetOperation;
    readonly operationDigest: string;
    readonly binding: OperationBinding;
    readonly expiresAt: number;
}
export interface OperationGrant {
    readonly id: string;
    readonly operationId: string;
    readonly operationDigest: string;
    readonly binding: OperationBinding;
    readonly expiresAt: number;
}
export type OperationScalar = string | number | boolean | null;
export type SecretlessOperationResult = Readonly<{ status: "COMPLETE"; operationId: string; resource: string; fields: Readonly<Record<string, OperationScalar>> }>
    | Readonly<{ status: "WITHHELD" }>;
interface Options {
    readonly operations: readonly FixedJsonGetOperation[];
    readonly credentialProvider: CredentialLeaseProvider;
    /** Trusted host checks the actual live session, image, snapshot and policy. */
    readonly isCurrent: (binding: OperationBinding) => boolean;
    readonly transport?: FixedJsonGetTransport;
    readonly now?: () => number;
    readonly requestTimeoutMs?: number;
}
type Prepared = { readonly review: OperationReview; readonly issuedAt: number };
type Granted = { readonly grant: OperationGrant; readonly operation: FixedJsonGetOperation; readonly issuedAt: number };
const withheld = (): SecretlessOperationResult => Object.freeze({ status: "WITHHELD" });
const unavailable = (): never => { throw Error("Approved operation unavailable."); };
const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const HASH = /^[a-f0-9]{64}$/;
function data(value: unknown, keys: readonly string[]): Record<string, unknown> {
    if (!value || typeof value !== "object" || types.isProxy(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return unavailable();
    const fields = Object.getOwnPropertyDescriptors(value), own = Reflect.ownKeys(fields);
    if (own.length !== keys.length || own.some(key => typeof key !== "string" || !keys.includes(key) || !Object.hasOwn(fields[key], "value") || !fields[key].enumerable)) return unavailable();
    return Object.fromEntries(keys.map(key => [key, fields[key].value]));
}
function array(value: unknown, max: number): unknown[] {
    if (!Array.isArray(value) || types.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > max) return unavailable();
    const fields = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(fields).length !== value.length + 1) return unavailable();
    return Array.from({ length: value.length }, (_, index) => {
        const item = fields[String(index)]; if (!item || !Object.hasOwn(item, "value") || !item.enumerable) return unavailable(); return item.value;
    });
}
function text(value: unknown, max: number): string {
    if (typeof value !== "string" || !value || Buffer.byteLength(value) > max || /[\x00-\x1f\x7f-\x9f]/u.test(value)
        || Buffer.from(value).toString("utf8") !== value) return unavailable(); return value;
}
export function parseOperationBinding(value: unknown): OperationBinding | undefined {
    try {
        const row = data(value, ["sessionId", "imageDigest", "artifactDigest", "policyDigest"]);
        const sessionId = text(row.sessionId, 128), imageDigest = text(row.imageDigest, 71), artifactDigest = text(row.artifactDigest, 64), policyDigest = text(row.policyDigest, 64);
        if (!ID.test(sessionId) || !/^(?:sha256:)?[a-f0-9]{64}$/.test(imageDigest) || !HASH.test(artifactDigest) || !HASH.test(policyDigest)) return;
        return Object.freeze({ sessionId, imageDigest, artifactDigest, policyDigest });
    } catch { return; }
}
export function parseFixedJsonGetOperation(value: unknown): FixedJsonGetOperation | undefined {
    try {
        const row = data(value, ["id", "label", "account", "resource", "url", "responseFields"]);
        const id = text(row.id, 128), label = text(row.label, 160), account = text(row.account, 128), resource = text(row.resource, 512);
        if (!ID.test(id) || !ID.test(account)) return;
        const url = fixedOperationUrl(row.url), seen = new Set<string>();
        const responseFields = array(row.responseFields, SECRETLESS_OPERATION_LIMITS.fields).map(value => {
            const field = text(value, 64);
            if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(field) || ["constructor", "prototype", "__proto__"].includes(field) || seen.has(field)) return unavailable();
            seen.add(field); return field;
        });
        if (!responseFields.length) return;
        const operation = Object.freeze({ id, label, account, resource, url, responseFields: Object.freeze(responseFields) });
        if (new RegisteredSecretMatcher([]).inspectRequest([JSON.stringify(operation)]).status !== "CLEAN") return;
        return operation;
    } catch { return; }
}

/** The host is the only credential holder. Review/approval are trusted owner
 * methods; an agent receives only a grant ID and its filtered one-use result.
 * Issuer scope/expiry attestations remain the trusted provider's responsibility. */
export class SecretlessOperationBroker {
    #operations = new Map<string, FixedJsonGetOperation>();
    #reviews = new Map<string, Prepared>();
    #grants = new Map<string, Granted>();
    #active = new Map<string, { binding: OperationBinding; controller: AbortController }>();
    #revokedSessions = new Set<string>();
    #provider: CredentialLeaseProvider;
    #transport: FixedJsonGetTransport;
    #current: Options["isCurrent"];
    #now: () => number;
    #timeout: number;
    #pendingWork = 0;
    #disposed = false;
    constructor(options: Options) {
        this.#provider = options.credentialProvider; this.#transport = options.transport ?? createFixedHttpsJsonGet();
        this.#current = options.isCurrent; this.#now = options.now ?? Date.now; this.#timeout = options.requestTimeoutMs ?? SECRETLESS_OPERATION_LIMITS.requestMs;
        if (typeof this.#provider?.acquire !== "function" || typeof this.#transport !== "function" || typeof this.#current !== "function"
            || !Number.isSafeInteger(this.#timeout) || this.#timeout < 1 || this.#timeout > SECRETLESS_OPERATION_LIMITS.requestMs) return unavailable();
        for (const value of array(options.operations, SECRETLESS_OPERATION_LIMITS.operations)) {
            const operation = parseFixedJsonGetOperation(value);
            if (!operation || this.#operations.has(operation.id)) return unavailable(); this.#operations.set(operation.id, operation);
        }
        if (!this.#operations.size) return unavailable();
    }
    operations(): readonly FixedJsonGetOperation[] { return Object.freeze([...this.#operations.values()]); }
    prepareReview(operationId: string, value: OperationBinding): OperationReview | undefined {
        try {
            this.#prune(); const binding = parseOperationBinding(value), operation = this.#operations.get(operationId), now = this.#clock();
            if (!binding || !operation || !this.#live(binding) || this.#reviews.size >= SECRETLESS_OPERATION_LIMITS.reviews) return;
            const review = Object.freeze({ id: randomUUID(), operation, operationDigest: sha(operation), binding, expiresAt: now + SECRETLESS_OPERATION_LIMITS.reviewMs });
            this.#reviews.set(review.id, { review, issuedAt: now }); return review;
        } catch { return; }
    }
    approve(review: OperationReview): OperationGrant | undefined {
        try {
            this.#prune();
            if (!review || typeof review !== "object" || types.isProxy(review)) return;
            const id = Object.getOwnPropertyDescriptor(review, "id")?.value;
            const prepared = this.#reviews.get(id); if (!prepared || prepared.review !== review) return;
            this.#reviews.delete(id); const now = this.#clock();
            if (!this.#live(review.binding) || now < prepared.issuedAt || now >= review.expiresAt || this.#grants.size >= SECRETLESS_OPERATION_LIMITS.grants) return;
            const grant = Object.freeze({ id: randomUUID(), operationId: review.operation.id, operationDigest: review.operationDigest,
                binding: review.binding, expiresAt: now + SECRETLESS_OPERATION_LIMITS.grantMs });
            this.#grants.set(grant.id, { grant, operation: review.operation, issuedAt: now }); return grant;
        } catch { return; }
    }
    async execute(grantId: string, value: OperationBinding, signal?: AbortSignal): Promise<SecretlessOperationResult> {
        let lease: CredentialLease | undefined, controller: AbortController | undefined;
        let deadlineTimer: ReturnType<typeof setTimeout> | undefined, poll: ReturnType<typeof setInterval> | undefined;
        const abort = () => controller?.abort();
        try {
            this.#prune(); const saved = this.#grants.get(grantId); this.#grants.delete(grantId);
            if (!saved) return withheld();
            const binding = parseOperationBinding(value), now = this.#clock();
            if (!binding || JSON.stringify(binding) !== JSON.stringify(saved.grant.binding) || !this.#live(binding) || signal?.aborted
                || now < saved.issuedAt || now >= saved.grant.expiresAt || this.#active.size >= SECRETLESS_OPERATION_LIMITS.active
                || this.#pendingWork >= SECRETLESS_OPERATION_LIMITS.active) return withheld();
            controller = new AbortController(); const activeController = controller, deadline = Math.min(now + this.#timeout, saved.grant.expiresAt);
            const live = () => !activeController.signal.aborted && this.#live(binding) && this.#clock() >= now && this.#clock() < deadline;
            this.#active.set(grantId, { binding, controller }); signal?.addEventListener("abort", abort, { once: true });
            if (signal?.aborted) { abort(); return withheld(); }
            deadlineTimer = setTimeout(abort, Math.max(1, deadline - now)); deadlineTimer.unref?.();
            poll = setInterval(() => { try { if (!live()) abort(); } catch { abort(); } }, 100); poll.unref?.();
            const cancelled = new Promise<never>((_, reject) => activeController.signal.addEventListener("abort", () => reject(Error("Operation cancelled.")), { once: true }));
            const request = Object.freeze({ operation: saved.operation, binding, operationDigest: saved.grant.operationDigest });
            const acquisition = this.#work(() => this.#provider.acquire(request, activeController.signal)).then(value => {
                if (!live()) { this.#disposeLease(value); return undefined; } return value;
            });
            lease = await Promise.race([acquisition, cancelled]);
            if (!lease || !live()) return withheld();
            const token = text(lease.bearerToken, 4096), credentialExpiresAt = lease.credentialExpiresAt;
            if (!/^[A-Za-z0-9._~+/-]{16,4096}={0,2}$/.test(token) || !Number.isSafeInteger(credentialExpiresAt)
                || credentialExpiresAt <= this.#clock() || credentialExpiresAt - this.#clock() > SECRETLESS_OPERATION_LIMITS.credentialMaxMs
                || lease.operationDigest !== request.operationDigest || lease.account !== saved.operation.account || lease.resource !== saved.operation.resource
                || typeof lease.dispose !== "function") return withheld();
            const values = [token, ...array(lease.outputSecretValues, 127).map(value => text(value, 4096))];
            // Known short values have ambiguous boundary rules: this finite broker
            // refuses disclosure rather than treating an unmatched response as safe.
            if (values.some(value => Array.from(value).length < 8)) return withheld();
            const matcher = new RegisteredSecretMatcher(values, { decodedCandidateProfile: "structured-json-v1" });
            const safe = (views: readonly string[]) => matcher.inspectRequest(views).status === "CLEAN"
                && !values.some(value => views.some(view => view.includes(value)));
            if (!safe([JSON.stringify(request)]) || !live() || this.#clock() >= credentialExpiresAt) return withheld();
            const response = await Promise.race([this.#work(() => this.#transport(Object.freeze({ url: saved.operation.url, bearerToken: token,
                maxResponseBytes: SECRETLESS_OPERATION_LIMITS.responseBytes, timeoutMs: Math.max(1, Math.min(this.#timeout, deadline - this.#clock(), credentialExpiresAt - this.#clock())) }), activeController.signal)), cancelled]);
            if (!live() || this.#clock() >= credentialExpiresAt || response.statusCode !== 200 || response.contentEncoding !== "identity"
                || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(response.contentType) || !(response.body instanceof Uint8Array)
                || response.body.byteLength > SECRETLESS_OPERATION_LIMITS.responseBytes) return withheld();
            const decoded = decodeBoundedJson(response.body, { maxBytes: SECRETLESS_OPERATION_LIMITS.responseBytes, maxDepth: 12, maxNodes: 2048, maxStringBytes: 8192 });
            const raw = new TextDecoder("utf-8", { fatal: true }).decode(response.body);
            const pending: unknown[] = [decoded.body], strings: string[] = []; let semanticBytes = 0;
            while (pending.length) {
                const item = pending.pop();
                if (typeof item === "string") {
                    semanticBytes += Buffer.byteLength(item); if (semanticBytes > SECRETLESS_OPERATION_LIMITS.responseBytes) return withheld(); strings.push(item);
                } else if (item && typeof item === "object") {
                    const children = Array.isArray(item) ? item : Object.values(item);
                    for (let index = children.length - 1; index >= 0; index--) pending.push(children[index]);
                }
            }
            // Include decoded leaves in response order so a known value split
            // across fields cannot evade the exact serialized-response check.
            if (![raw, decoded.canonical, strings.join("")].every(view => safe([view]))) return withheld();
            const fields: Record<string, OperationScalar> = {};
            for (const field of saved.operation.responseFields) {
                if (!Object.hasOwn(decoded.body, field)) return withheld();
                const value = decoded.body[field];
                if (value !== null && typeof value !== "boolean" && typeof value !== "number" && typeof value !== "string"
                    || typeof value === "string" && Buffer.byteLength(value) > 4096) return withheld();
                Object.defineProperty(fields, field, { value, enumerable: true });
            }
            const result = Object.freeze({ status: "COMPLETE" as const, operationId: saved.operation.id, resource: saved.operation.resource, fields: Object.freeze(fields) });
            const serialized = JSON.stringify(result);
            if (Buffer.byteLength(serialized) > SECRETLESS_OPERATION_LIMITS.outputBytes || !safe([serialized]) || !live() || this.#clock() >= credentialExpiresAt) return withheld();
            return result;
        } catch { return withheld(); }
        finally {
            if (deadlineTimer) clearTimeout(deadlineTimer); if (poll) clearInterval(poll); signal?.removeEventListener("abort", abort);
            controller?.abort(); this.#active.delete(grantId); if (lease) this.#disposeLease(lease);
        }
    }
    revokeSession(sessionId: string): void {
        if (typeof sessionId !== "string" || !ID.test(sessionId)) return;
        if (!this.#revokedSessions.has(sessionId) && this.#revokedSessions.size >= 64) { this.dispose(); return; }
        this.#revokedSessions.add(sessionId);
        for (const [id, value] of this.#reviews) if (value.review.binding.sessionId === sessionId) this.#reviews.delete(id);
        for (const [id, value] of this.#grants) if (value.grant.binding.sessionId === sessionId) this.#grants.delete(id);
        for (const value of this.#active.values()) if (value.binding.sessionId === sessionId) value.controller.abort();
    }
    dispose(): void { this.#disposed = true; this.#reviews.clear(); this.#grants.clear(); for (const value of this.#active.values()) value.controller.abort(); }
    #clock(): number { const now = this.#now(); if (!Number.isSafeInteger(now) || now < 0) return unavailable(); return now; }
    #live(binding: OperationBinding): boolean { try { return !this.#disposed && !this.#revokedSessions.has(binding.sessionId) && this.#current(binding) === true; } catch { return false; } }
    #prune(): void {
        const now = this.#clock();
        for (const [id, value] of this.#reviews) if (now < value.issuedAt || now >= value.review.expiresAt) this.#reviews.delete(id);
        for (const [id, value] of this.#grants) if (now < value.issuedAt || now >= value.grant.expiresAt) this.#grants.delete(id);
    }
    async #work<T>(operation: () => Promise<T>): Promise<T> { this.#pendingWork++; try { return await operation(); } finally { this.#pendingWork--; } }
    #disposeLease(lease: CredentialLease): void { try { void Promise.resolve(lease.dispose()).catch(() => {}); } catch { /* Never emit provider exceptions. */ } }
}
