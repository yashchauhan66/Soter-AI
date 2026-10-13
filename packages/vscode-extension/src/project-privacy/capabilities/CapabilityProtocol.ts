import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import type {
    CapabilityAllowed, CapabilityBinding, CapabilityDenied, CapabilityDenial, CapabilityIssued,
    CapabilityProtocolOptions, IndependentCapabilityAuthority, VerifiedTransportContext, WorkloadIdentity,
} from "./contracts";
import { fixedPublicOperation, MAX_CAPABILITY_DURATION_MS } from "./operations";

interface GrantRecord {
    readonly binding: CapabilityBinding;
    readonly approvalId: string;
    readonly validUntil: number;
    state: "ACTIVE" | "CONSUMED" | "REVOKED";
}

const identifier = (value: unknown): value is string =>
    typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/.test(value);
const finiteTime = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const deny = (reason: CapabilityDenial): CapabilityDenied => ({ status: "DENIED", reason });
const identityFields = ["principalId", "workloadId", "launchId", "sessionId"] as const;
const bindingFields = ["recipient", "projectId", "itemId", "contentRevision", "policyRevision",
    "operation", "action", "outputClass", "destinationId"] as const;

function exactDataRecord(value: unknown, fields: readonly string[]): boolean {
    if (!value || typeof value !== "object") return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== fields.length || keys.some(key => typeof key !== "string" || !fields.includes(key))) return false;
    return fields.every(field => {
        const descriptor = Object.getOwnPropertyDescriptor(value, field);
        return !!descriptor && "value" in descriptor && descriptor.enumerable === true;
    });
}

function validIdentity(value: unknown): value is WorkloadIdentity {
    try {
        if (!exactDataRecord(value, identityFields)) return false;
        const item = value as WorkloadIdentity;
        return [item.principalId, item.workloadId, item.launchId, item.sessionId].every(identifier);
    } catch { return false; }
}

function sameIdentity(a: WorkloadIdentity, b: WorkloadIdentity): boolean {
    return a.principalId === b.principalId && a.workloadId === b.workloadId
        && a.launchId === b.launchId && a.sessionId === b.sessionId;
}

function validBinding(value: unknown): value is CapabilityBinding {
    try {
        if (!exactDataRecord(value, bindingFields)) return false;
        const item = value as CapabilityBinding;
        return validIdentity(item.recipient) && [item.projectId, item.itemId, item.contentRevision,
            item.policyRevision, item.destinationId, item.operation, item.action, item.outputClass].every(identifier);
    } catch { return false; }
}

function sameBinding(a: CapabilityBinding, b: CapabilityBinding): boolean {
    return sameIdentity(a.recipient, b.recipient) && a.projectId === b.projectId && a.itemId === b.itemId
        && a.contentRevision === b.contentRevision && a.policyRevision === b.policyRevision
        && a.operation === b.operation && a.action === b.action && a.outputClass === b.outputClass
        && a.destinationId === b.destinationId;
}

function snapshot(binding: CapabilityBinding): CapabilityBinding {
    return Object.freeze({ recipient: Object.freeze({ principalId: binding.recipient.principalId,
        workloadId: binding.recipient.workloadId, launchId: binding.recipient.launchId, sessionId: binding.recipient.sessionId }),
        projectId: binding.projectId, itemId: binding.itemId, contentRevision: binding.contentRevision,
        policyRevision: binding.policyRevision, operation: binding.operation, action: binding.action,
        outputClass: binding.outputClass, destinationId: binding.destinationId });
}

/**
 * Default-disabled metadata decision core. It releases no file content, performs
 * no operation, authenticates no OS identity and signs no token. Its grant and
 * revocation ledger is bounded, in-memory and lost on controller restart.
 * Independent authentication, custody, presence, output filtering and durable
 * anti-rollback require a future deployment and remain UNTESTED here.
 */
export class CapabilityProtocol {
    private readonly records = new Map<string, GrantRecord>();
    private readonly consumedApprovals = new Set<string>();
    private readonly nowSource: () => number;
    private readonly maximumRecords: number;
    private readonly authorityAdapter: IndependentCapabilityAuthority | undefined;
    private readonly authorityIdentity: string | undefined;
    private lastTime = -1;
    private clockInvalid = false;
    private disposed = false;

    constructor(private readonly options: CapabilityProtocolOptions = {}) {
        this.nowSource = options.now ?? (() => performance.now());
        this.authorityAdapter = options.authority;
        this.authorityIdentity = options.authority?.authorityId;
        this.maximumRecords = options.maximumRecords ?? 1_024;
        if (!Number.isInteger(this.maximumRecords) || this.maximumRecords < 1 || this.maximumRecords > 4_096) {
            throw new RangeError("Capability ledger capacity must be an integer from 1 to 4096.");
        }
    }

    private now(): number | CapabilityDenied {
        let value: number;
        try { value = this.nowSource(); } catch { value = NaN; }
        if (this.clockInvalid || !finiteTime(value) || value < this.lastTime) {
            this.clockInvalid = true;
            this.revokeAll();
            return deny("INVALID_CLOCK");
        }
        this.lastTime = value;
        return value;
    }

    private authority(): IndependentCapabilityAuthority | CapabilityDenied {
        if (this.disposed) return deny("DISPOSED");
        try {
            if (this.options.enabled?.() !== true) {
                this.revokeAll();
                return deny("DISABLED");
            }
            const authority = this.authorityAdapter;
            if (!authority || !identifier(authority.authorityId) || authority.authorityId !== this.authorityIdentity
                || authority.available() !== true) {
                this.revokeAll();
                return deny("AUTHORITY_UNAVAILABLE");
            }
            return authority;
        } catch {
            this.revokeAll();
            return deny("AUTHORITY_UNAVAILABLE");
        }
    }

    private authenticate(authority: IndependentCapabilityAuthority, connection: unknown,
        recipient: WorkloadIdentity, now: number): VerifiedTransportContext | CapabilityDenied {
        const context = authority.authenticateTransport(connection);
        if (!context || context.status !== "VERIFIED" || context.verification !== "INDEPENDENT_TRANSPORT"
            || context.authorityId !== authority.authorityId || !validIdentity(context.identity)
            || !finiteTime(context.validUntil) || context.validUntil <= now) return deny("IDENTITY_UNVERIFIED");
        return sameIdentity(context.identity, recipient) ? context : deny("WRONG_RECIPIENT");
    }

    private checkScope(authority: IndependentCapabilityAuthority, binding: CapabilityBinding): CapabilityDenied | undefined {
        const operation = fixedPublicOperation(binding.operation);
        if (!operation) return deny("UNSUPPORTED_OPERATION");
        if (operation.action !== binding.action || operation.outputClass !== binding.outputClass) {
            return deny("OUTPUT_CLASS_MISMATCH");
        }
        const item = authority.resolveItem(binding.projectId, binding.itemId);
        if (!item || item.projectId !== binding.projectId || item.itemId !== binding.itemId
            || item.classification !== binding.outputClass) return deny("ITEM_NOT_PUBLIC");
        if (item.contentRevision !== binding.contentRevision || item.policyRevision !== binding.policyRevision) {
            return deny("REVISION_CHANGED");
        }
        if (authority.destinationAllowed(binding.recipient, binding.destinationId) !== true) return deny("DESTINATION_DENIED");
        return undefined;
    }

    issue(connection: unknown, binding: CapabilityBinding, approvalReference: string,
        durationMs: number): CapabilityIssued | CapabilityDenied {
        const authority = this.authority();
        if ("status" in authority) return authority;
        const initialTime = this.now();
        if (typeof initialTime !== "number") return initialTime;
        if (!validBinding(binding) || !identifier(approvalReference) || !Number.isInteger(durationMs)
            || durationMs < 1 || durationMs > MAX_CAPABILITY_DURATION_MS) return deny("INVALID_REQUEST");
        if (this.records.size >= this.maximumRecords || this.consumedApprovals.size >= this.maximumRecords) {
            return deny("CAPACITY_REACHED");
        }
        try {
            const bound = snapshot(binding);
            if (!validBinding(bound)) return deny("INVALID_REQUEST");
            const identity = this.authenticate(authority, connection, bound.recipient, initialTime);
            if ("reason" in identity) return identity;
            const scopeDenial = this.checkScope(authority, bound);
            if (scopeDenial) return scopeDenial;
            const approval = authority.consumeApproval(approvalReference, { binding: bound, durationMs, maximumUses: 1 });
            if (!approval || approval.status !== "APPROVED") return deny("APPROVAL_DENIED");
            if (!identifier(approval.approvalId) || approval.presence !== "INDEPENDENT_USER_PRESENCE"
                || !validBinding(approval.reviewedBinding) || !sameBinding(bound, approval.reviewedBinding)
                || approval.durationMs !== durationMs || !finiteTime(approval.reviewedAt)
                || !finiteTime(approval.validUntil)) return deny("APPROVAL_MISMATCH");
            if (this.consumedApprovals.has(approval.approvalId)) return deny("APPROVAL_REPLAY");
            // Burn valid approval identity even when a subsequent recheck withholds
            // issuance. It must not become reusable after an outage or revision race.
            this.consumedApprovals.add(approval.approvalId);
            const commitTime = this.now();
            if (typeof commitTime !== "number") return commitTime;
            const currentAuthority = this.authority();
            if ("status" in currentAuthority) return currentAuthority;
            const currentIdentity = this.authenticate(currentAuthority, connection, bound.recipient, commitTime);
            if ("reason" in currentIdentity) return currentIdentity;
            const currentScopeDenial = this.checkScope(currentAuthority, bound);
            if (currentScopeDenial) return currentScopeDenial;
            if (approval.reviewedAt > initialTime || approval.validUntil <= commitTime
                || currentAuthority.approvalActive(approval.approvalId) !== true) return deny("APPROVAL_DENIED");
            const validUntil = Math.min(initialTime + durationMs, approval.validUntil,
                identity.validUntil, currentIdentity.validUntil);
            if (validUntil <= commitTime) return deny("EXPIRED");
            const grantReference = randomUUID();
            this.records.set(grantReference, { binding: bound, approvalId: approval.approvalId, validUntil, state: "ACTIVE" });
            return { status: "ISSUED", grantReference, binding: bound, validUntil, maximumUses: 1 };
        } catch {
            this.revokeAll();
            return deny("AUTHORITY_UNAVAILABLE");
        }
    }

    consume(connection: unknown, grantReference: string,
        requestedBinding: CapabilityBinding): CapabilityAllowed | CapabilityDenied {
        const authority = this.authority();
        if ("status" in authority) return authority;
        const now = this.now();
        if (typeof now !== "number") return now;
        if (!identifier(grantReference) || !validBinding(requestedBinding)) return deny("INVALID_REQUEST");
        const record = this.records.get(grantReference);
        if (!record) return deny("UNKNOWN_GRANT");
        if (record.state === "REVOKED") return deny("REVOKED");
        if (record.state === "CONSUMED") return deny("REPLAY");
        if (now >= record.validUntil) return deny("EXPIRED");
        if (!sameBinding(record.binding, requestedBinding)) return deny("GRANT_MISMATCH");
        try {
            const identity = this.authenticate(authority, connection, record.binding.recipient, now);
            if ("reason" in identity) return identity;
            const scopeDenial = this.checkScope(authority, record.binding);
            if (scopeDenial) return scopeDenial;
            if (authority.approvalActive(record.approvalId) !== true) {
                record.state = "REVOKED";
                return deny("REVOKED");
            }
            // Recheck immediately before the synchronous one-use decision commit.
            const commitTime = this.now();
            if (typeof commitTime !== "number") return commitTime;
            const currentAuthority = this.authority();
            if ("status" in currentAuthority) return currentAuthority;
            if (commitTime >= record.validUntil || commitTime >= identity.validUntil) return deny("EXPIRED");
            const finalIdentity = this.authenticate(currentAuthority, connection, record.binding.recipient, commitTime);
            if ("reason" in finalIdentity) return finalIdentity;
            const finalScope = this.checkScope(currentAuthority, record.binding);
            if (finalScope) return finalScope;
            if (currentAuthority.approvalActive(record.approvalId) !== true || record.state !== "ACTIVE") {
                record.state = "REVOKED";
                return deny("REVOKED");
            }
            record.state = "CONSUMED";
            return { status: "ALLOWED_ONCE", binding: record.binding,
                maximumOutputBytes: fixedPublicOperation(record.binding.operation)!.maximumOutputBytes };
        } catch {
            this.revokeAll();
            return deny("AUTHORITY_UNAVAILABLE");
        }
    }

    /** Process-local cancellation only; no acknowledgement from a remote runner. */
    revoke(grantReference: string): void {
        const record = this.records.get(grantReference);
        if (record?.state === "ACTIVE") record.state = "REVOKED";
    }

    revokeAll(): void {
        for (const record of this.records.values()) if (record.state === "ACTIVE") record.state = "REVOKED";
    }

    dispose(): void {
        this.revokeAll();
        this.disposed = true;
    }
}
