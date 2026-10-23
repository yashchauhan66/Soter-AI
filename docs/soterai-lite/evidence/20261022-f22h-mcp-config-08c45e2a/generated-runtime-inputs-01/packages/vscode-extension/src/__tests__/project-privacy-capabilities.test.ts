import assert from "node:assert/strict";
import { test } from "node:test";
import {
    CapabilityProtocol, FIXED_PUBLIC_OPERATIONS, MAX_CAPABILITY_DURATION_MS, fixedPublicOperation,
    type AuthoritativeItemState, type CapabilityBinding, type CapabilityIssued, type CapabilityReview,
    type IndependentApproval, type IndependentCapabilityAuthority, type TransportAuthentication,
    type WorkloadIdentity,
} from "../project-privacy/capabilities";

const identity: WorkloadIdentity = { principalId: "synthetic-account", workloadId: "synthetic-cline",
    launchId: "launch-1", sessionId: "session-1" };
const binding: CapabilityBinding = { recipient: identity, projectId: "public-project", itemId: "approved-schema",
    contentRevision: "content-1", policyRevision: "policy-1", operation: "project.schema.read",
    action: "READ_PUBLIC_SCHEMA", outputClass: "PUBLIC_SCHEMA", destinationId: "approved-public-route" };

/** Synthetic process-local unit double. No authentication or user presence proof. */
class SyntheticAuthority implements IndependentCapabilityAuthority {
    readonly authorityId = "synthetic-test-authority";
    online = true;
    verified = true;
    destinationPermitted = true;
    authenticationExpiry = 100_000;
    item: AuthoritativeItemState = { projectId: binding.projectId, itemId: binding.itemId,
        contentRevision: binding.contentRevision, policyRevision: binding.policyRevision, classification: "PUBLIC_SCHEMA" };
    readonly connection = Object.freeze({ syntheticConnection: 1 });
    readonly otherConnection = Object.freeze({ syntheticConnection: 2 });
    readonly approvals = new Map<string, IndependentApproval>();
    readonly consumedReferences = new Set<string>();
    readonly revokedApprovals = new Set<string>();
    afterApproval: (() => void) | undefined;
    approvalReads = 0;
    clock = 0;
    nextApproval = 0;
    available(): boolean { return this.online; }
    authenticateTransport(connection: unknown): TransportAuthentication {
        if (!this.verified || (connection !== this.connection && connection !== this.otherConnection)) return { status: "UNVERIFIED" };
        return { status: "VERIFIED", verification: "INDEPENDENT_TRANSPORT", authorityId: this.authorityId,
            identity: connection === this.connection ? identity : { ...identity, workloadId: "different-synthetic-agent" },
            validUntil: this.authenticationExpiry };
    }
    resolveItem(projectId: string, itemId: string): AuthoritativeItemState | undefined {
        return projectId === this.item.projectId && itemId === this.item.itemId ? this.item : undefined;
    }
    destinationAllowed(_identity: WorkloadIdentity, destination: string): boolean {
        return this.destinationPermitted && destination === binding.destinationId;
    }
    consumeApproval(reference: string, _review: CapabilityReview): IndependentApproval {
        this.approvalReads++;
        if (this.consumedReferences.has(reference)) return { status: "DENIED" };
        this.consumedReferences.add(reference);
        const result = this.approvals.get(reference) ?? { status: "DENIED" as const };
        this.afterApproval?.();
        return result;
    }
    approvalActive(id: string): boolean { return !this.revokedApprovals.has(id); }
    approve(scope = binding, durationMs = 1_000): string {
        const reference = `synthetic-approval-${++this.nextApproval}`;
        this.approvals.set(reference, { status: "APPROVED", approvalId: reference,
            presence: "INDEPENDENT_USER_PRESENCE", reviewedBinding: scope, durationMs,
            reviewedAt: this.clock, validUntil: this.clock + durationMs });
        return reference;
    }
}

function fixture(maximumRecords?: number) {
    const authority = new SyntheticAuthority();
    let enabled = true;
    const protocol = new CapabilityProtocol({ authority, enabled: () => enabled, now: () => authority.clock, maximumRecords });
    const issue = (scope = binding, duration = 1_000) => protocol.issue(authority.connection, scope,
        authority.approve(scope, duration), duration);
    const grant = () => {
        const result = issue();
        assert.equal(result.status, "ISSUED");
        return result as CapabilityIssued;
    };
    return { authority, protocol, issue, grant, disable: () => { enabled = false; } };
}

test("protocol is disabled by default and an enabled core requires an authority", () => {
    const authority = new SyntheticAuthority();
    assert.deepEqual(new CapabilityProtocol({ authority }).issue(authority.connection, binding, "approval", 1_000),
        { status: "DENIED", reason: "DISABLED" });
    assert.deepEqual(new CapabilityProtocol({ enabled: () => true }).issue({}, binding, "approval", 1_000),
        { status: "DENIED", reason: "AUTHORITY_UNAVAILABLE" });
});

test("positive public schema operation returns only a single-use metadata decision", () => {
    const { authority, protocol, grant } = fixture();
    const issued = grant();
    assert.equal(issued.maximumUses, 1);
    assert.equal(issued.validUntil, 1_000);
    assert.notEqual(issued.grantReference, "synthetic-approval-1");
    const result = protocol.consume(authority.connection, issued.grantReference, binding);
    assert.deepEqual(result, { status: "ALLOWED_ONCE", binding, maximumOutputBytes: 16_384 });
    assert.ok(!Object.hasOwn(result, "text"));
    assert.ok(!Object.hasOwn(result, "credentials"));
    assert.deepEqual(protocol.consume(authority.connection, issued.grantReference, binding), { status: "DENIED", reason: "REPLAY" });
});

test("caller-supplied identity strings and self-declared verified objects are not authenticated", () => {
    const { authority, protocol } = fixture();
    for (const connection of [identity, { status: "VERIFIED", verification: "INDEPENDENT_TRANSPORT", identity,
        authorityId: authority.authorityId, validUntil: 10_000 }, "synthetic-cline"]) {
        assert.deepEqual(protocol.issue(connection, binding, authority.approve(), 1_000),
            { status: "DENIED", reason: "IDENTITY_UNVERIFIED" });
    }
    assert.equal(authority.approvalReads, 0);
});

test("a different independently-resolved recipient cannot issue or consume the grant", () => {
    const { authority, protocol, grant } = fixture();
    const issued = grant();
    assert.deepEqual(protocol.issue(authority.otherConnection, binding, authority.approve(), 1_000),
        { status: "DENIED", reason: "WRONG_RECIPIENT" });
    assert.deepEqual(protocol.consume(authority.otherConnection, issued.grantReference, binding),
        { status: "DENIED", reason: "WRONG_RECIPIENT" });
    assert.equal(protocol.consume(authority.connection, issued.grantReference, binding).status, "ALLOWED_ONCE");
});

for (const field of ["principalId", "workloadId", "launchId", "sessionId"] as const) {
    test(`recipient ${field} is bound to the authoritative transport identity`, () => {
        const { authority, protocol } = fixture();
        const altered = { ...binding, recipient: { ...identity, [field]: "different" } };
        assert.deepEqual(protocol.issue(authority.connection, altered, authority.approve(altered), 1_000),
            { status: "DENIED", reason: "WRONG_RECIPIENT" });
    });
}

for (const field of ["projectId", "itemId", "contentRevision", "policyRevision", "operation", "action", "outputClass", "destinationId"] as const) {
    test(`issued grant cannot be reused with changed ${field}`, () => {
        const { authority, protocol, grant } = fixture();
        const issued = grant();
        const altered = { ...binding, [field]: "different" } as CapabilityBinding;
        assert.deepEqual(protocol.consume(authority.connection, issued.grantReference, altered),
            { status: "DENIED", reason: "GRANT_MISMATCH" });
        assert.equal(protocol.consume(authority.connection, issued.grantReference, binding).status, "ALLOWED_ONCE");
    });
}

for (const field of ["contentRevision", "policyRevision"] as const) {
    test(`authoritative ${field} change withholds previously approved operation`, () => {
        const { authority, protocol, grant } = fixture();
        const issued = grant();
        authority.item = { ...authority.item, [field]: "changed" };
        assert.deepEqual(protocol.consume(authority.connection, issued.grantReference, binding),
            { status: "DENIED", reason: "REVISION_CHANGED" });
    });
}

test("destination needs an authority-owned route permission at issuance and consumption", () => {
    const first = fixture(); first.authority.destinationPermitted = false;
    assert.deepEqual(first.issue(), { status: "DENIED", reason: "DESTINATION_DENIED" });
    const second = fixture(); const issued = second.grant(); second.authority.destinationPermitted = false;
    assert.deepEqual(second.protocol.consume(second.authority.connection, issued.grantReference, binding),
        { status: "DENIED", reason: "DESTINATION_DENIED" });
});

for (const operation of ["shell.exec", "database.sql", "secret.reveal", "credentials.inject", "__proto__", "constructor"]) {
    test(`unsupported operation ${operation} cannot request capability execution`, () => {
        const { authority, protocol } = fixture();
        const altered = { ...binding, operation } as CapabilityBinding;
        const result = protocol.issue(authority.connection, altered, authority.approve(altered), 1_000);
        assert.equal(result.status, "DENIED");
        assert.equal(authority.approvalReads, 0);
        assert.equal(fixedPublicOperation(operation), undefined);
    });
}

test("wrong operation action/output and protected or unknown classification fail closed", () => {
    const { authority, protocol } = fixture();
    for (const scope of [{ ...binding, action: "READ_PUBLIC_CONTRACT" as const },
        { ...binding, outputClass: "PUBLIC_CONTRACT" as const }]) {
        assert.deepEqual(protocol.issue(authority.connection, scope, authority.approve(scope), 1_000),
            { status: "DENIED", reason: "OUTPUT_CLASS_MISMATCH" });
    }
    for (const classification of ["PROTECTED", "UNKNOWN"] as const) {
        authority.item = { ...authority.item, classification };
        assert.deepEqual(protocol.issue(authority.connection, binding, authority.approve(), 1_000),
            { status: "DENIED", reason: "ITEM_NOT_PUBLIC" });
    }
});

test("fixed public contract and synthetic status controls remain available", () => {
    for (const operation of Object.values(FIXED_PUBLIC_OPERATIONS)) {
        const { authority, protocol } = fixture();
        const scope: CapabilityBinding = { ...binding, operation: operation.operation, action: operation.action,
            outputClass: operation.outputClass };
        authority.item = { ...authority.item, classification: operation.outputClass };
        const issued = protocol.issue(authority.connection, scope, authority.approve(scope), 1_000);
        assert.equal(issued.status, "ISSUED");
        const allowed = protocol.consume(authority.connection, (issued as CapabilityIssued).grantReference, scope);
        assert.deepEqual(allowed, { status: "ALLOWED_ONCE", binding: scope, maximumOutputBytes: operation.maximumOutputBytes });
    }
});

test("approval must bind the exact reviewed content, recipient, route and duration", () => {
    for (const changed of [{ ...binding, contentRevision: "different" },
        { ...binding, destinationId: "different" }, { ...binding, recipient: { ...identity, sessionId: "different" } }]) {
        const { authority, protocol } = fixture();
        assert.deepEqual(protocol.issue(authority.connection, binding, authority.approve(changed), 1_000),
            { status: "DENIED", reason: "APPROVAL_MISMATCH" });
    }
    const { authority, protocol } = fixture();
    assert.deepEqual(protocol.issue(authority.connection, binding, authority.approve(binding, 500), 1_000),
        { status: "DENIED", reason: "APPROVAL_MISMATCH" });
});

test("native-modal or self-asserted presence cannot satisfy independent approval contract", () => {
    const { authority, protocol } = fixture();
    const reference = authority.approve();
    const approved = authority.approvals.get(reference)!;
    authority.approvals.set(reference, { ...approved, presence: "EDITOR_MODAL_ONLY" } as unknown as IndependentApproval);
    assert.deepEqual(protocol.issue(authority.connection, binding, reference, 1_000),
        { status: "DENIED", reason: "APPROVAL_MISMATCH" });
});

test("process-local approval replay check rejects a buggy authority repeating an approval ID", () => {
    const { authority, protocol } = fixture();
    const first = authority.approve();
    assert.equal(protocol.issue(authority.connection, binding, first, 1_000).status, "ISSUED");
    const second = authority.approve();
    authority.approvals.set(second, authority.approvals.get(first)!);
    assert.deepEqual(protocol.issue(authority.connection, binding, second, 1_000),
        { status: "DENIED", reason: "APPROVAL_REPLAY" });
});

test("bounded duration, invalid input and unknown references release no decision", () => {
    const { authority, protocol } = fixture();
    for (const duration of [0, -1, 0.1, Infinity, NaN, MAX_CAPABILITY_DURATION_MS + 1]) {
        assert.deepEqual(protocol.issue(authority.connection, binding, authority.approve(), duration),
            { status: "DENIED", reason: "INVALID_REQUEST" });
    }
    assert.equal(authority.approvalReads, 0);
    assert.deepEqual(protocol.consume(authority.connection, "unknown", binding), { status: "DENIED", reason: "UNKNOWN_GRANT" });
    assert.deepEqual(protocol.issue(authority.connection, { ...binding, itemId: "bad\nmetadata" }, "approval", 1_000),
        { status: "DENIED", reason: "INVALID_REQUEST" });
});

test("grant expires at the exact monotonic boundary and authentication lifetime caps it", () => {
    const first = fixture(); const issued = first.grant(); first.authority.clock = 1_000;
    assert.deepEqual(first.protocol.consume(first.authority.connection, issued.grantReference, binding),
        { status: "DENIED", reason: "EXPIRED" });
    const second = fixture(); second.authority.authenticationExpiry = 500; const shorter = second.grant();
    assert.equal(shorter.validUntil, 500);
    second.authority.clock = 500;
    assert.deepEqual(second.protocol.consume(second.authority.connection, shorter.grantReference, binding),
        { status: "DENIED", reason: "EXPIRED" });
});

test("backwards or nonfinite monotonic clock permanently withholds decisions", () => {
    for (const badTime of [-1, NaN, Infinity]) {
        const { authority, protocol, grant } = fixture();
        const issued = grant(); authority.clock = badTime;
        assert.deepEqual(protocol.consume(authority.connection, issued.grantReference, binding),
            { status: "DENIED", reason: "INVALID_CLOCK" });
        authority.clock = 0;
        assert.deepEqual(protocol.consume(authority.connection, issued.grantReference, binding),
            { status: "DENIED", reason: "INVALID_CLOCK" });
    }
    const f = fixture(); f.authority.clock = 10; const issued = f.grant(); f.authority.clock = 9;
    assert.deepEqual(f.protocol.consume(f.authority.connection, issued.grantReference, binding),
        { status: "DENIED", reason: "INVALID_CLOCK" });
});

test("authority outage and exceptions revoke outstanding grants; recovery needs fresh approval", () => {
    const { authority, protocol, grant } = fixture(); const issued = grant(); authority.online = false;
    assert.deepEqual(protocol.consume(authority.connection, issued.grantReference, binding),
        { status: "DENIED", reason: "AUTHORITY_UNAVAILABLE" });
    authority.online = true;
    assert.deepEqual(protocol.consume(authority.connection, issued.grantReference, binding),
        { status: "DENIED", reason: "REVOKED" });
    const fresh = grant();
    assert.equal(protocol.consume(authority.connection, fresh.grantReference, binding).status, "ALLOWED_ONCE");
    authority.authenticateTransport = () => { throw new Error("synthetic transport failure"); };
    assert.deepEqual(protocol.issue(authority.connection, binding, authority.approve(), 1_000),
        { status: "DENIED", reason: "AUTHORITY_UNAVAILABLE" });
});

test("revocation, remote approval withdrawal, flag withdrawal and disposal withhold", () => {
    const first = fixture(); const issued = first.grant(); first.protocol.revoke(issued.grantReference);
    assert.deepEqual(first.protocol.consume(first.authority.connection, issued.grantReference, binding),
        { status: "DENIED", reason: "REVOKED" });
    const second = fixture(); const remote = second.grant(); second.authority.revokedApprovals.add("synthetic-approval-1");
    assert.deepEqual(second.protocol.consume(second.authority.connection, remote.grantReference, binding),
        { status: "DENIED", reason: "REVOKED" });
    const third = fixture(); const all = third.grant(); third.protocol.revokeAll();
    assert.deepEqual(third.protocol.consume(third.authority.connection, all.grantReference, binding),
        { status: "DENIED", reason: "REVOKED" });
    const fourth = fixture(); const disabled = fourth.grant(); fourth.disable();
    assert.deepEqual(fourth.protocol.consume(fourth.authority.connection, disabled.grantReference, binding),
        { status: "DENIED", reason: "DISABLED" });
    fourth.protocol.dispose();
    assert.deepEqual(fourth.protocol.consume(fourth.authority.connection, disabled.grantReference, binding),
        { status: "DENIED", reason: "DISPOSED" });
});

test("issuance rechecks revision, availability, flag and expiry after approval processing", () => {
    const cases: Array<[string, (f: ReturnType<typeof fixture>) => void]> = [
        ["REVISION_CHANGED", f => { f.authority.item = { ...f.authority.item, policyRevision: "new-policy" }; }],
        ["AUTHORITY_UNAVAILABLE", f => { f.authority.online = false; }],
        ["DISABLED", f => f.disable()],
        ["APPROVAL_DENIED", f => { f.authority.clock = 1_000; }],
    ];
    for (const [reason, mutation] of cases) {
        const f = fixture(); f.authority.afterApproval = () => mutation(f);
        assert.deepEqual(f.issue(), { status: "DENIED", reason });
    }
});

test("snapshots are immutable and do not follow later caller mutation", () => {
    const { authority, protocol } = fixture();
    const mutable = { ...binding, recipient: { ...identity } };
    const issued = protocol.issue(authority.connection, mutable, authority.approve(mutable), 1_000) as CapabilityIssued;
    assert.equal(issued.status, "ISSUED");
    mutable.destinationId = "different";
    mutable.recipient.launchId = "different";
    assert.ok(Object.isFrozen(issued.binding));
    assert.ok(Object.isFrozen(issued.binding.recipient));
    assert.equal(protocol.consume(authority.connection, issued.grantReference, binding).status, "ALLOWED_ONCE");
});

test("bounded ledger retains replay tombstones and fails closed at capacity", () => {
    const { authority, protocol, grant, issue } = fixture(1);
    const issued = grant();
    assert.equal(protocol.consume(authority.connection, issued.grantReference, binding).status, "ALLOWED_ONCE");
    assert.deepEqual(issue(), { status: "DENIED", reason: "CAPACITY_REACHED" });
    assert.deepEqual(protocol.consume(authority.connection, issued.grantReference, binding), { status: "DENIED", reason: "REPLAY" });
    for (const maximumRecords of [0, -1, 0.1, 4_097]) assert.throws(() => new CapabilityProtocol({ maximumRecords }), RangeError);
});

test("controller restart has no durable grants; old references are never implicitly accepted", () => {
    const { authority, grant } = fixture(); const issued = grant();
    const restarted = new CapabilityProtocol({ authority, enabled: () => true, now: () => authority.clock });
    assert.deepEqual(restarted.consume(authority.connection, issued.grantReference, binding),
        { status: "DENIED", reason: "UNKNOWN_GRANT" });
});

test("invalid verification authority or expired transport attestation cannot issue", () => {
    for (const invalid of ["different-authority", "expired", "wrong-verification"]) {
        const { authority, protocol } = fixture();
        const authenticate = authority.authenticateTransport.bind(authority);
        authority.authenticateTransport = connection => {
            const context = authenticate(connection);
            if (context.status !== "VERIFIED") return context;
            return { ...context, ...(invalid === "different-authority" ? { authorityId: "other" }
                : invalid === "expired" ? { validUntil: 0 } : { verification: "CALLER_STRING" }) } as TransportAuthentication;
        };
        assert.deepEqual(protocol.issue(authority.connection, binding, authority.approve(), 1_000),
            { status: "DENIED", reason: "IDENTITY_UNVERIFIED" });
    }
});

test("future, expired and withdrawn approvals cannot issue", () => {
    for (const invalid of ["future", "expired", "withdrawn"]) {
        const { authority, protocol } = fixture();
        const reference = authority.approve();
        const approved = authority.approvals.get(reference)!;
        if (approved.status !== "APPROVED") assert.fail("Synthetic approval must exist.");
        if (invalid === "withdrawn") authority.revokedApprovals.add(reference);
        else authority.approvals.set(reference, { ...approved,
            ...(invalid === "future" ? { reviewedAt: 1 } : { validUntil: 0 }) });
        assert.deepEqual(protocol.issue(authority.connection, binding, reference, 1_000),
            { status: "DENIED", reason: "APPROVAL_DENIED" });
    }
});

test("flag rollback observed by a request cancels outstanding grants across re-enable", () => {
    const authority = new SyntheticAuthority(); let enabled = true;
    const protocol = new CapabilityProtocol({ authority, enabled: () => enabled, now: () => authority.clock });
    const issued = protocol.issue(authority.connection, binding, authority.approve(), 1_000) as CapabilityIssued;
    enabled = false;
    assert.deepEqual(protocol.consume(authority.connection, issued.grantReference, binding), { status: "DENIED", reason: "DISABLED" });
    enabled = true;
    assert.deepEqual(protocol.consume(authority.connection, issued.grantReference, binding), { status: "DENIED", reason: "REVOKED" });
});

test("authority identity mutation fails closed and cannot resume an old grant", () => {
    const { authority, protocol, grant } = fixture(); const issued = grant();
    Object.defineProperty(authority, "authorityId", { value: "different-controller", configurable: true });
    assert.deepEqual(protocol.consume(authority.connection, issued.grantReference, binding),
        { status: "DENIED", reason: "AUTHORITY_UNAVAILABLE" });
});

test("reentrant approval withdrawal during consumption produces no one-use decision", () => {
    const { authority, protocol, grant } = fixture(); const issued = grant();
    let calls = 0;
    authority.approvalActive = () => ++calls < 2;
    assert.deepEqual(protocol.consume(authority.connection, issued.grantReference, binding),
        { status: "DENIED", reason: "REVOKED" });
});

test("metadata rejects extra fields, custom prototypes and accessor-backed input", () => {
    const { authority, protocol } = fixture();
    const accessor = { ...binding };
    Object.defineProperty(accessor, "itemId", { enumerable: true, get: () => binding.itemId });
    const inputs = [{ ...binding, unexpected: "synthetic-private-content" },
        { ...binding, recipient: { ...identity, unexpected: "synthetic-private-content" } },
        Object.assign(Object.create({ inherited: true }), binding), accessor];
    for (const input of inputs) assert.deepEqual(protocol.issue(authority.connection, input as CapabilityBinding,
        authority.approve(), 1_000), { status: "DENIED", reason: "INVALID_REQUEST" });
    assert.equal(authority.approvalReads, 0);
});
