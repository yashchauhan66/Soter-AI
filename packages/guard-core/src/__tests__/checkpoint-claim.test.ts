import assert from "node:assert/strict";
import test from "node:test";
import {
    buildRollbackEvidence,
    canonicalCheckpointPayload,
    classifyRestoration,
    hashProtectedState,
    signCheckpoint,
    validateCheckpointClaim,
    verifyCheckpointIntegrity,
    type CheckpointRecord,
} from "../CheckpointRollback";

const SECRET = "checkpoint_integrity_secret_0123456789abcdef";
const OWNER = { tenantId: "tenant_alpha", actorId: "actor_1" };

async function record(overrides: Partial<CheckpointRecord> = {}): Promise<CheckpointRecord> {
    const unsigned = {
        id: "ckpt_1",
        owner: OWNER,
        scopeRoot: "/tmp/workspace",
        createdAt: "2026-07-30T10:00:00.000Z",
        expiresAt: "2026-07-30T10:15:00.000Z",
        files: [{ path: "config/app.conf", contentHash: "a".repeat(64), size: 12, existed: true }],
        sideEffects: [],
        ...overrides,
    };
    return { ...unsigned, status: overrides.status ?? "OPEN", integrity: overrides.integrity ?? (await signCheckpoint(unsigned, SECRET)) };
}

test("canonical payload is length-delimited so distinct records cannot collide", () => {
    const a = canonicalCheckpointPayload({
        id: "ckpt", owner: { tenantId: "ab", actorId: "c" }, scopeRoot: "/r",
        createdAt: "t1", expiresAt: "t2", files: [], sideEffects: [],
    });
    const b = canonicalCheckpointPayload({
        id: "ckpt", owner: { tenantId: "a", actorId: "bc" }, scopeRoot: "/r",
        createdAt: "t1", expiresAt: "t2", files: [], sideEffects: [],
    });
    assert.notEqual(a, b);
});

test("canonical payload is order-independent for files and side effects", () => {
    const base = { id: "ckpt", owner: OWNER, scopeRoot: "/r", createdAt: "t1", expiresAt: "t2" };
    const files = [
        { path: "b.txt", contentHash: "1", size: 1, existed: true },
        { path: "a.txt", contentHash: "2", size: 2, existed: false },
    ];
    const first = canonicalCheckpointPayload({ ...base, files, sideEffects: [] });
    const second = canonicalCheckpointPayload({ ...base, files: [...files].reverse(), sideEffects: [] });
    assert.equal(first, second);
});

test("integrity verification detects any mutation of protected fingerprints", async () => {
    const original = await record();
    assert.equal(await verifyCheckpointIntegrity(original, SECRET), true);
    assert.equal(await verifyCheckpointIntegrity({ ...original, scopeRoot: "/elsewhere" }, SECRET), false);
    assert.equal(
        await verifyCheckpointIntegrity({ ...original, files: [{ ...original.files[0], size: 13 }] }, SECRET),
        false,
    );
    // A different secret cannot validate the same record.
    assert.equal(await verifyCheckpointIntegrity(original, `${SECRET}_other`), false);
});

test("status changes do not invalidate integrity, because rollback must update status", async () => {
    const original = await record();
    assert.equal(await verifyCheckpointIntegrity({ ...original, status: "ROLLED_BACK" }, SECRET), true);
});

test("claim validation orders integrity before ownership and expiry", async () => {
    const valid = await record();
    const now = new Date("2026-07-30T10:05:00.000Z");
    assert.equal((await validateCheckpointClaim(valid, OWNER, SECRET, now)).code, "OK");
    assert.equal((await validateCheckpointClaim(undefined, OWNER, SECRET, now)).code, "NOT_FOUND");

    // Ownership rewritten without re-signing reads as tampering, not mismatch.
    const tampered = { ...valid, owner: { tenantId: "tenant_beta", actorId: "actor_1" } };
    assert.equal((await validateCheckpointClaim(tampered, OWNER, SECRET, now)).code, "INTEGRITY_FAILED");

    const otherTenant = await record({ owner: { tenantId: "tenant_beta", actorId: "actor_1" } });
    assert.equal((await validateCheckpointClaim(otherTenant, OWNER, SECRET, now)).code, "TENANT_MISMATCH");

    const otherActor = await record({ owner: { tenantId: "tenant_alpha", actorId: "actor_2" } });
    assert.equal((await validateCheckpointClaim(otherActor, OWNER, SECRET, now)).code, "ACTOR_MISMATCH");

    const consumed = await record({ status: "ROLLED_BACK" });
    assert.equal((await validateCheckpointClaim(consumed, OWNER, SECRET, now)).code, "ALREADY_ROLLED_BACK");

    const late = new Date("2026-07-30T10:20:00.000Z");
    assert.equal((await validateCheckpointClaim(valid, OWNER, SECRET, late)).code, "EXPIRED");
    // Exactly at the deadline is expired, not valid.
    assert.equal((await validateCheckpointClaim(valid, OWNER, SECRET, new Date(valid.expiresAt))).code, "EXPIRED");
});

test("restoration classification separates exact, partial and compensating-only", () => {
    const exact = classifyRestoration({ files: [{ path: "a", contentHash: "h", size: 1, existed: true }], sideEffects: [] });
    assert.equal(exact.classification, "EXACT_RESTORE");
    assert.equal(exact.exactlyRestorable, true);

    const compensating = classifyRestoration({
        files: [],
        sideEffects: [{ id: "e1", kind: "email.send", reversible: false, compensatingAction: "send_correction" }],
    });
    assert.equal(compensating.classification, "COMPENSATING_ACTION_ONLY");
    assert.equal(compensating.exactlyRestorable, false);
    assert.deepEqual(compensating.compensatingActions, ["send_correction"]);

    const partial = classifyRestoration({
        files: [{ path: "a", contentHash: "h", size: 1, existed: true }],
        sideEffects: [{ id: "e1", kind: "webhook.post", reversible: false }],
    });
    assert.equal(partial.classification, "PARTIAL_RESTORE_WITH_COMPENSATION");
    assert.deepEqual(partial.compensatingActions, ["manual_review:webhook.post"]);
});

test("state fingerprints are exact-byte, not normalized like cache hashes", async () => {
    const a = await hashProtectedState("port=8080\n");
    const b = await hashProtectedState("port=8080 ");
    const c = await hashProtectedState("PORT=8080\n");
    assert.notEqual(a, b);
    assert.notEqual(a, c);
    assert.match(a, /^[0-9a-f]{64}$/);
});

test("rollback evidence carries digests only, never paths or protected content", async () => {
    const evidence = await buildRollbackEvidence({
        checkpointId: "ckpt_1",
        owner: OWNER,
        outcome: "RESTORED",
        code: "OK",
        classification: "EXACT_RESTORE",
        paths: ["config/app.conf", "secrets/.env"],
        filesRestored: 2,
        filesDeleted: 0,
        stateVerified: true,
        compensatingActions: [],
        reason: "Exact restoration verified. Contact ops at admin@example.com with key sk-live-abcdefghijklmnopqrstuvwx.",
        now: "2026-07-30T10:05:00.000Z",
    });
    const serialized = JSON.stringify(evidence);
    assert.equal(serialized.includes("app.conf"), false);
    assert.equal(serialized.includes(".env"), false);
    assert.equal(serialized.includes("sk-live-abcdefghijklmnopqrstuvwx"), false);
    assert.equal(evidence.pathDigests.length, 2);
    for (const digest of evidence.pathDigests) assert.match(digest, /^[0-9a-f]{16}$/);
    assert.deepEqual(evidence.pathDigests, [...evidence.pathDigests].sort());
});
