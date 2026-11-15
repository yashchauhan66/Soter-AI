import { request as httpsRequest } from "node:https";
import { createHash } from "node:crypto";
import type { ClientRequest, IncomingMessage } from "node:http";
import { types } from "node:util";
import { fixedOperationUrl, type FixedJsonGetTransport } from "../../../core/src/FixedHttpsJsonGet";
import { parseFixedJsonGetOperation, type CredentialLease, type CredentialLeaseProvider, type CredentialLeaseRequest, type FixedJsonGetOperation } from "../../../core/src/SecretlessOperationBroker";
import { decodeBoundedJson } from "../../../../apps/local-ai-broker/src/BoundedJson";

export interface VaultOperationConfiguration {
    readonly schemaVersion: 1;
    readonly origin: string;
    readonly role: string;
    readonly expectedPolicies: readonly string[];
    readonly ttlSeconds: number;
    readonly operation: FixedJsonGetOperation;
}
/** Private host transport seam for synthetic tests; never an agent-facing API. */
export interface VaultHttpRequest { readonly url: string; readonly method: "GET" | "POST"; readonly token: string; readonly body?: string; readonly timeoutMs: number }
export interface VaultHttpResponse { readonly status: number; readonly contentType: string; readonly body: Uint8Array }
export type VaultHttpTransport = (request: VaultHttpRequest, signal: AbortSignal) => Promise<VaultHttpResponse>;
const TOKEN = /^[A-Za-z0-9._~+/-]{16,4096}={0,2}$/;
const POLICY = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const unavailable = (): never => { throw Error("Vault operation unavailable."); };
function own(value: unknown, keys: readonly string[]): Record<string, unknown> {
    if (!value || typeof value !== "object" || types.isProxy(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return unavailable();
    const fields = Object.getOwnPropertyDescriptors(value), names = Reflect.ownKeys(fields);
    if (names.length !== keys.length || names.some(key => typeof key !== "string" || !keys.includes(key) || !Object.hasOwn(fields[key], "value") || !fields[key].enumerable)) return unavailable();
    return Object.fromEntries(keys.map(key => [key, fields[key].value]));
}
function policies(value: unknown): readonly string[] {
    if (!Array.isArray(value) || types.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype || !value.length || value.length > 16) return unavailable();
    const fields = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(fields).length !== value.length + 1) return unavailable();
    const result = Array.from({ length: value.length }, (_, index) => {
        const field = fields[String(index)];
        if (!field || !Object.hasOwn(field, "value") || !field.enumerable || typeof field.value !== "string" || !POLICY.test(field.value)) return unavailable(); return field.value as string;
    }).sort();
    if (new Set(result).size !== result.length) return unavailable(); return Object.freeze(result);
}
export function parseVaultOperationConfiguration(value: unknown): VaultOperationConfiguration | undefined {
    try {
        const row = own(value, ["schemaVersion", "origin", "role", "expectedPolicies", "ttlSeconds", "operation"]), operation = parseFixedJsonGetOperation(row.operation);
        if (row.schemaVersion !== 1 || typeof row.origin !== "string" || new URL(row.origin).origin !== row.origin || !operation
            || typeof row.role !== "string" || !POLICY.test(row.role) || !Number.isSafeInteger(row.ttlSeconds) || (row.ttlSeconds as number) < 10 || (row.ttlSeconds as number) > 120) return;
        fixedOperationUrl(row.origin + "/v1/sys/health");
        const url = new URL(operation.url);
        if (url.origin !== row.origin || !/^\/v1\/[A-Za-z0-9][A-Za-z0-9/_-]{0,511}$/.test(url.pathname)
            || url.pathname.split("/").slice(1).some(part => !part) || operation.resource !== url.pathname) return;
        return Object.freeze({ schemaVersion: 1, origin: row.origin, role: row.role, ttlSeconds: row.ttlSeconds as number,
            expectedPolicies: policies(row.expectedPolicies), operation });
    } catch { return; }
}

/** Fixed private Vault request transport: valid TLS, no redirects/retries/proxy
 * inheritance, bounded JSON and an absolute deadline for every owned request. */
export const vaultHttpsTransport: VaultHttpTransport = async (input, signal) => {
    let url: URL;
    try { url = new URL(fixedOperationUrl(input.url)); } catch { return unavailable(); }
    if (!TOKEN.test(input.token) || !["GET", "POST"].includes(input.method) || input.method === "GET" && input.body !== undefined
        || input.body !== undefined && (typeof input.body !== "string" || Buffer.byteLength(input.body) > 8192)
        || !Number.isSafeInteger(input.timeoutMs) || input.timeoutMs < 1 || input.timeoutMs > 5000 || signal.aborted) return unavailable();
    return new Promise<VaultHttpResponse>((resolve, reject) => {
        let request: ClientRequest | undefined, response: IncomingMessage | undefined, settled = false, size = 0;
        const chunks: Buffer[] = [];
        const finish = (value?: VaultHttpResponse) => {
            if (settled) return; settled = true; clearTimeout(timer); signal.removeEventListener("abort", abort);
            if (value) resolve(value); else { chunks.length = 0; response?.destroy(); request?.destroy(); reject(Error("Vault operation unavailable.")); }
        };
        const abort = () => finish(), timer = setTimeout(abort, input.timeoutMs); timer.unref?.();
        signal.addEventListener("abort", abort, { once: true });
        try {
            if (signal.aborted) { finish(); return; }
            request = httpsRequest(url, { method: input.method, agent: false, rejectUnauthorized: true, maxHeaderSize: 8192,
                headers: { Accept: "application/json", "Accept-Encoding": "identity", "X-Vault-Token": input.token,
                    ...(input.body === undefined ? {} : { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(input.body) }) } }, incoming => {
                response = incoming; incoming.on("error", () => finish()); incoming.on("aborted", () => finish());
                const contentType = incoming.headers["content-type"] ?? "", length = incoming.headers["content-length"];
                if (![200, 204].includes(incoming.statusCode ?? 0) || incoming.headers.location !== undefined
                    || (incoming.headers["content-encoding"] ?? "identity") !== "identity" || typeof contentType !== "string"
                    || incoming.statusCode === 200 && !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType)
                    || length !== undefined && (typeof length !== "string" || !/^(?:0|[1-9]\d*)$/.test(length) || Number(length) > 65536)) { finish(); return; }
                incoming.on("data", (chunk: unknown) => {
                    if (settled) return;
                    if (!(chunk instanceof Uint8Array) || size + chunk.byteLength > 65536) { finish(); return; }
                    size += chunk.byteLength; chunks.push(Buffer.from(chunk));
                });
                incoming.on("end", () => {
                    if (length !== undefined && Number(length) !== size) { finish(); return; }
                    finish(Object.freeze({ status: incoming.statusCode!, contentType, body: Buffer.concat(chunks, size) }));
                });
                incoming.on("close", () => { if (!incoming.complete) finish(); });
            });
            request.on("error", () => finish()); request.end(input.body);
        } catch { finish(); }
    });
};

interface ProviderOptions {
    readonly configuration: VaultOperationConfiguration;
    readonly getBootstrapToken: () => Promise<string | undefined>;
    readonly enabled: () => boolean;
    readonly transport?: VaultHttpTransport;
    readonly now?: () => number;
}
export class VaultTokenLeaseProvider implements CredentialLeaseProvider {
    #config: VaultOperationConfiguration;
    #bootstrap: ProviderOptions["getBootstrapToken"];
    #enabled: () => boolean;
    #transport: VaultHttpTransport;
    #now: () => number;
    constructor(options: ProviderOptions) {
        const config = parseVaultOperationConfiguration(options.configuration) ?? unavailable();
        this.#config = config; this.#bootstrap = options.getBootstrapToken; this.#enabled = options.enabled;
        this.#transport = options.transport ?? vaultHttpsTransport; this.#now = options.now ?? Date.now;
    }
    async acquire(request: CredentialLeaseRequest, signal: AbortSignal): Promise<CredentialLease> {
        let issued: string | undefined;
        try {
            if (!this.#enabled() || signal.aborted || JSON.stringify(request.operation) !== JSON.stringify(this.#config.operation)
                || request.operationDigest !== createHash("sha256").update(JSON.stringify(this.#config.operation)).digest("hex")) return unavailable();
            const bootstrap = await this.#bootstrap();
            if (typeof bootstrap !== "string" || !TOKEN.test(bootstrap) || !this.#enabled() || signal.aborted) return unavailable();
            const issuedAt = this.#now();
            if (!Number.isSafeInteger(issuedAt) || issuedAt < 0) return unavailable();
            const response = await this.#transport({ url: this.#config.origin + "/v1/auth/token/create/" + this.#config.role, method: "POST", token: bootstrap,
                body: JSON.stringify({ ttl: this.#config.ttlSeconds + "s", explicit_max_ttl: this.#config.ttlSeconds + "s", num_uses: 1, renewable: false, policies: this.#config.expectedPolicies }), timeoutMs: 4000 }, signal);
            if (response.status !== 200 || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(response.contentType)) return unavailable();
            const auth = decodeBoundedJson(response.body, { maxBytes: 65536, maxDepth: 8, maxNodes: 1024 }).body.auth as Record<string, unknown> | undefined;
            if (!auth || typeof auth !== "object" || Array.isArray(auth) || typeof auth.client_token !== "string" || !TOKEN.test(auth.client_token) || auth.client_token === bootstrap) return unavailable();
            issued = auth.client_token;
            if (!Number.isSafeInteger(auth.lease_duration) || (auth.lease_duration as number) < 1 || (auth.lease_duration as number) > this.#config.ttlSeconds
                || auth.renewable !== false || auth.num_uses !== 1 || auth.token_type !== "service"
                || JSON.stringify(policies(auth.policies)) !== JSON.stringify(this.#config.expectedPolicies)) return unavailable();
            const credentialExpiresAt = issuedAt + (auth.lease_duration as number) * 1000;
            if (!this.#enabled() || signal.aborted || this.#now() >= credentialExpiresAt) return unavailable();
            const token = issued; issued = undefined; let disposed = false;
            return Object.freeze({ bearerToken: token, credentialExpiresAt, operationDigest: request.operationDigest,
                account: request.operation.account, resource: request.operation.resource, outputSecretValues: Object.freeze([bootstrap]),
                dispose: () => { if (disposed) return; disposed = true; return this.#revoke(token); } });
        } catch { return unavailable(); }
        finally { if (issued) void this.#revoke(issued); }
    }
    /** Inject into the core broker. A dynamic token may address only this exact
     * configured read; Vault uses X-Vault-Token rather than a caller header. */
    readTransport(): FixedJsonGetTransport {
        return async (request, signal) => {
            if (!this.#enabled() || signal.aborted || request.url !== this.#config.operation.url) return unavailable();
            const response = await this.#transport({ url: this.#config.operation.url, method: "GET", token: request.bearerToken, timeoutMs: request.timeoutMs }, signal);
            if (!this.#enabled() || signal.aborted || response.body.byteLength > request.maxResponseBytes) return unavailable();
            return Object.freeze({ statusCode: response.status, contentType: response.contentType, contentEncoding: "identity", body: response.body });
        };
    }
    async #revoke(token: string): Promise<void> {
        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 1500); timer.unref?.();
        try { await this.#transport({ url: this.#config.origin + "/v1/auth/token/revoke-self", method: "POST", token, body: "{}", timeoutMs: 1500 }, controller.signal); }
        catch { /* One-use tokens may already be consumed; issuer TTL remains the bound. */ }
        finally { clearTimeout(timer); }
    }
}
