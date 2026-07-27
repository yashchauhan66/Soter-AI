import { createHash, randomBytes } from "crypto";
import { SecretReferenceManager } from "./SecretReferenceManager";
import { OutputFilter } from "./OutputFilter";
import { type BrokerOperation } from "./types";

/**
 * Enforced API Capability — Scenario A.
 *
 * This is the ONE path SoterAI can honestly label "Verified protected": the
 * AI/agent never receives the credential, only an opaque capability handle. The
 * broker injects the secret into the Authorization header LOCALLY, and only for
 * the exact host + method + path the grant allows. Wrong host/path/method,
 * replay past maxUses, expiry, and post-revocation all fail closed.
 *
 * ENFORCEMENT SCOPE (honest): SoterAI controls this outbound request because it
 * originates in the broker. It does NOT control other extensions/processes that
 * may read the underlying secret from disk — that remains MONITORED/UNKNOWN.
 */

export interface CapabilityScope {
    /** Exact host the credential may be sent to, e.g. "api.example.com". */
    host: string;
    /** Allowed HTTP method (upper-case), e.g. "POST". */
    method: string;
    /** Exact path prefix the grant allows, e.g. "/v1/charges". */
    pathPrefix: string;
    /** Header the secret is injected into (default "authorization"). */
    header?: string;
    /** Scheme prefix for the header value, e.g. "Bearer " (default). */
    scheme?: string;
}

export interface CapabilityGrant {
    handle: string;
    secretRef: string;
    workspace: string;
    scope: CapabilityScope;
    operation: BrokerOperation;
    createdAt: number;
    expiresAt: number;
    maxUses: number;
    useCount: number;
    revoked: boolean;
}

export interface CapabilityGrantInput {
    secretRef: string;
    workspace: string;
    scope: CapabilityScope;
    ttlMs: number;
    maxUses?: number;
    operation?: BrokerOperation;
}

export interface TransportRequest {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
}

export interface TransportResponse {
    status: number;
    body: string;
}

/** Injectable transport so the enforced path is provable without a live host. */
export type CapabilityTransport = (req: TransportRequest) => Promise<TransportResponse>;

export interface EnforcedCallInput {
    handle: string;
    workspace: string;
    method: string;
    url: string;
    body?: string;
}

export interface EnforcedCallResult {
    allowed: boolean;
    /** Present only on success — response scanned + minimized, never the raw secret. */
    response?: { status: number; body: string };
    reason?: string;
    /** Safe audit metadata — hashes and scope only, never the credential. */
    audit: {
        handle: string;
        host: string;
        method: string;
        verdict: "sent" | "blocked";
        reason?: string;
        responseScrubbed?: boolean;
    };
}

export class EnforcedApiCapabilityBroker {
    private readonly grants = new Map<string, CapabilityGrant>();

    constructor(
        private readonly refs: SecretReferenceManager,
        private readonly outputFilter = new OutputFilter(),
    ) {}

    /** Issue a scoped, revocable, non-secret capability handle. */
    grant(input: CapabilityGrantInput): CapabilityGrant {
        const handle = `soter-cap-${randomBytes(18).toString("base64url")}`;
        const now = Date.now();
        const grant: CapabilityGrant = {
            handle,
            secretRef: input.secretRef,
            workspace: input.workspace,
            scope: {
                header: "authorization",
                scheme: "Bearer ",
                ...input.scope,
                host: input.scope.host.toLowerCase(),
                method: input.scope.method.toUpperCase(),
            },
            operation: input.operation ?? "call_api_with_secret",
            createdAt: now,
            expiresAt: now + input.ttlMs,
            maxUses: input.maxUses ?? 1,
            useCount: 0,
            revoked: false,
        };
        this.grants.set(handle, grant);
        return grant;
    }

    revoke(handle: string): boolean {
        const grant = this.grants.get(handle);
        if (!grant) return false;
        grant.revoked = true;
        return true;
    }

    /** Emergency containment: revoke every active capability. Returns the count revoked. */
    revokeAll(): number {
        let count = 0;
        for (const grant of this.grants.values()) {
            if (!grant.revoked) {
                grant.revoked = true;
                count += 1;
            }
        }
        return count;
    }

    /** Count of currently-active (non-revoked, unexpired) capabilities. */
    activeCount(): number {
        const now = Date.now();
        let count = 0;
        for (const grant of this.grants.values()) {
            if (!grant.revoked && now <= grant.expiresAt) count += 1;
        }
        return count;
    }

    metadata(handle: string): Omit<CapabilityGrant, "secretRef"> | undefined {
        const grant = this.grants.get(handle);
        if (!grant) return undefined;
        const { secretRef: _secretRef, ...safe } = grant;
        return { ...safe, scope: { ...safe.scope } };
    }

    /**
     * Perform the brokered call. Injects the credential locally, only for the
     * approved host/method/path, then scans the response before returning it.
     */
    async call(input: EnforcedCallInput, transport: CapabilityTransport): Promise<EnforcedCallResult> {
        const grant = this.grants.get(input.handle);
        const audit = (verdict: "sent" | "blocked", host: string, reason?: string, responseScrubbed?: boolean) => ({
            handle: input.handle,
            host,
            method: input.method.toUpperCase(),
            verdict,
            reason,
            responseScrubbed,
        });

        if (!grant) return { allowed: false, reason: "unknown capability handle", audit: audit("blocked", "unknown", "unknown capability handle") };
        if (grant.workspace !== input.workspace) return this.block(grant, audit, "workspace mismatch");
        if (grant.revoked) return this.block(grant, audit, "capability revoked");
        if (Date.now() > grant.expiresAt) return this.block(grant, audit, "capability expired");
        if (grant.useCount >= grant.maxUses) return this.block(grant, audit, "capability use limit reached");

        // Claim the use synchronously BEFORE any await → replay-resistant.
        grant.useCount += 1;

        let parsed: URL;
        try {
            parsed = new URL(input.url);
        } catch {
            return this.block(grant, audit, "invalid URL");
        }
        if (parsed.hostname.toLowerCase() !== grant.scope.host) return this.block(grant, audit, "host not in capability scope");
        if (parsed.protocol !== "https:") return this.block(grant, audit, "only https is allowed for credential injection");
        if (input.method.toUpperCase() !== grant.scope.method) return this.block(grant, audit, "method not in capability scope");
        if (!parsed.pathname.startsWith(grant.scope.pathPrefix)) return this.block(grant, audit, "path not in capability scope");

        const record = await this.refs.lookup(grant.secretRef, grant.workspace, grant.operation);
        if (!record) return this.block(grant, audit, "secret reference expired, revoked, or out of scope");

        // Inject the credential LOCALLY, only now, only for this request.
        const headerName = (grant.scope.header ?? "authorization").toLowerCase();
        const headers: Record<string, string> = { [headerName]: `${grant.scope.scheme ?? "Bearer "}${record.value}` };

        let response: TransportResponse;
        try {
            response = await transport({ url: input.url, method: grant.scope.method, headers, body: input.body });
        } catch (err) {
            return this.block(grant, audit, `transport error: ${err instanceof Error ? err.message : "unknown"}`);
        }

        // Scan the response so a service cannot echo the secret back into AI context.
        const filtered = this.outputFilter.filter(response.body);
        const scrubbed = filtered.reason === "secret_like_output_redacted";
        return {
            allowed: true,
            response: { status: response.status, body: filtered.text },
            audit: audit("sent", grant.scope.host, undefined, scrubbed),
        };
    }

    /** Stable non-reversible fingerprint of a handle for display/audit. */
    static fingerprint(handle: string): string {
        return createHash("sha256").update(handle).digest("hex").slice(0, 12);
    }

    private block(
        grant: CapabilityGrant,
        audit: (v: "sent" | "blocked", host: string, reason?: string) => EnforcedCallResult["audit"],
        reason: string,
    ): EnforcedCallResult {
        return { allowed: false, reason, audit: audit("blocked", grant.scope.host, reason) };
    }
}
