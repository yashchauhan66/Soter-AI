/**
 * Runtime checkpoint-rollback enforcement tests.
 *
 * These drive the REAL adapter against a REAL temporary filesystem through the
 * authenticated broker HTTP surface. Nothing here is mocked except one injected
 * write failure (test 10), which is the only way to exercise a partial-restore
 * failure without corrupting a real disk.
 *
 * Lifecycle proven end-to-end: authenticate tenant + actor -> create checkpoint
 * -> fingerprint protected state -> execute a real change -> verify the state
 * changed -> request rollback -> validate ownership, integrity and expiry ->
 * restore -> verify exact restoration -> emit privacy-safe evidence.
 */

import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { mkdtemp, readFile, rm, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { BrokerServer } from "../BrokerServer";
import { FilesystemCheckpointStore } from "../CheckpointStore";
import { signCheckpoint, type CheckpointRecord, type RollbackEvidence } from "@soterai/guard-core";

const TOKEN = "test_local_broker_token_0123456789abcdef";
const SECRET = "checkpoint_integrity_secret_0123456789abcdef";
const TENANT = "tenant_alpha";
const ACTOR = "actor_agent_1";

const ORIGINAL = "port=8080\napi_key=sk-live-DO-NOT-LEAK-abcdefghij0123456789\n";
const MUTATED = "port=9999\napi_key=sk-live-DO-NOT-LEAK-abcdefghij0123456789\nrogue=true\n";

const roots: string[] = [];

after(async () => {
    for (const dir of roots) await rm(dir, { recursive: true, force: true });
});

async function makeFixture(): Promise<{ root: string; snapshotRoot: string; file: string }> {
    const base = await mkdtemp(join(tmpdir(), "soterai-ckpt-"));
    roots.push(base);
    const root = join(base, "workspace");
    const snapshotRoot = join(base, "snapshots");
    const file = join(root, "config", "app.conf");
    await writeFile(join(base, ".keep"), "");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(join(root, "config"), { recursive: true });
    await mkdir(snapshotRoot, { recursive: true });
    await writeFile(file, ORIGINAL, "utf8");
    return { root, snapshotRoot, file };
}

function makeStore(overrides: Partial<ConstructorParameters<typeof FilesystemCheckpointStore>[0]> & { root: string; snapshotRoot: string }) {
    return new FilesystemCheckpointStore({ secret: SECRET, ...overrides });
}

async function withBroker(
    checkpoint: ConstructorParameters<typeof FilesystemCheckpointStore>[0],
    run: (call: (endpoint: string, body: unknown, headers?: Record<string, string>) => Promise<{ status: number; json: any; text: string }>) => Promise<void>,
): Promise<void> {
    const broker = new BrokerServer({ token: TOKEN, port: 0, checkpoint });
    const { url } = await broker.start();
    const call = async (endpoint: string, body: unknown, headers: Record<string, string> = {}) => {
        const response = await fetch(`${url}${endpoint}`, {
            method: "POST",
            headers: {
                authorization: `Bearer ${TOKEN}`,
                "content-type": "application/json",
                "x-soterai-tenant": TENANT,
                "x-soterai-actor": ACTOR,
                ...headers,
            },
            body: JSON.stringify(body),
        });
        const text = await response.text();
        return { status: response.status, json: text ? JSON.parse(text) : null, text };
    };
    try {
        await run(call);
    } finally {
        await broker.stop();
    }
}

describe("Checkpoint rollback runtime enforcement", () => {
    it("1. creates a checkpoint that fingerprints real protected state without exposing it", async () => {
        const { root, snapshotRoot, file } = await makeFixture();
        await withBroker({ root, snapshotRoot, secret: SECRET }, async (call) => {
            const created = await call("/v1/checkpoint/create", { paths: ["config/app.conf"] });
            assert.equal(created.status, 201);
            assert.match(created.json.checkpointId, /^ckpt_/);
            assert.equal(created.json.fileCount, 1);
            assert.equal(created.json.status, "OPEN");
            assert.equal(created.json.classification, "EXACT_RESTORE");
            // The HTTP response must not carry protected bytes or the absolute path.
            assert.equal(created.text.includes("sk-live-DO-NOT-LEAK"), false);
            assert.equal(created.text.includes(file), false);
            assert.ok(new Date(created.json.expiresAt).getTime() > new Date(created.json.createdAt).getTime());
        });
    });

    it("2. rolls back a real filesystem change and restores exact bytes", async () => {
        const { root, snapshotRoot, file } = await makeFixture();
        await withBroker({ root, snapshotRoot, secret: SECRET }, async (call) => {
            const created = await call("/v1/checkpoint/create", { paths: ["config/app.conf"] });

            // Execute a REAL change, then verify the state actually changed.
            await writeFile(file, MUTATED, "utf8");
            assert.equal(await readFile(file, "utf8"), MUTATED);

            const rolled = await call("/v1/checkpoint/rollback", { checkpointId: created.json.checkpointId });
            assert.equal(rolled.status, 200);
            const evidence = rolled.json.evidence as RollbackEvidence;
            assert.equal(evidence.outcome, "RESTORED");
            assert.equal(evidence.code, "OK");
            assert.equal(evidence.stateVerified, true);
            assert.equal(evidence.filesRestored, 1);
            // Exact restoration, byte for byte.
            assert.equal(await readFile(file, "utf8"), ORIGINAL);
        });
    });

    it("3. rolls back after a partial failure, including deleting files created after the checkpoint", async () => {
        const { root, snapshotRoot, file } = await makeFixture();
        const store = makeStore({ root, snapshotRoot });
        const created = await store.createCheckpoint({
            owner: { tenantId: TENANT, actorId: ACTOR },
            paths: ["config/app.conf", "config/new-file.conf"],
        });
        assert.equal(created.files.find((f) => f.path === "config/new-file.conf")?.existed, false);

        // Simulate a half-applied change set: one file modified, one newly created.
        await writeFile(file, MUTATED, "utf8");
        const newFile = join(root, "config", "new-file.conf");
        await writeFile(newFile, "created by the failed operation", "utf8");

        const result = await store.rollback(created.id, { tenantId: TENANT, actorId: ACTOR });
        assert.equal(result.ok, true);
        assert.equal(result.evidence.filesRestored, 1);
        assert.equal(result.evidence.filesDeleted, 1);
        assert.equal(await readFile(file, "utf8"), ORIGINAL);
        await assert.rejects(() => stat(newFile), /ENOENT/);
    });

    it("4. refuses rollback for the wrong tenant", async () => {
        const { root, snapshotRoot, file } = await makeFixture();
        await withBroker({ root, snapshotRoot, secret: SECRET }, async (call) => {
            const created = await call("/v1/checkpoint/create", { paths: ["config/app.conf"] });
            await writeFile(file, MUTATED, "utf8");

            const denied = await call("/v1/checkpoint/rollback", { checkpointId: created.json.checkpointId }, { "x-soterai-tenant": "tenant_beta" });
            assert.equal(denied.status, 403);
            assert.equal((denied.json.evidence as RollbackEvidence).code, "TENANT_MISMATCH");
            // The protected state must remain untouched by a denied rollback.
            assert.equal(await readFile(file, "utf8"), MUTATED);
        });
    });

    it("5. refuses rollback for the wrong actor in the right tenant", async () => {
        const { root, snapshotRoot, file } = await makeFixture();
        await withBroker({ root, snapshotRoot, secret: SECRET }, async (call) => {
            const created = await call("/v1/checkpoint/create", { paths: ["config/app.conf"] });
            await writeFile(file, MUTATED, "utf8");

            const denied = await call("/v1/checkpoint/rollback", { checkpointId: created.json.checkpointId }, { "x-soterai-actor": "actor_agent_2" });
            assert.equal(denied.status, 403);
            assert.equal((denied.json.evidence as RollbackEvidence).code, "ACTOR_MISMATCH");
            assert.equal(await readFile(file, "utf8"), MUTATED);
        });
    });

    it("6. refuses an expired checkpoint and requires compensating review", async () => {
        const { root, snapshotRoot, file } = await makeFixture();
        const store = makeStore({ root, snapshotRoot, ttlMs: 1000 });
        const createdAt = new Date("2026-07-30T10:00:00.000Z");
        const created = await store.createCheckpoint({ owner: { tenantId: TENANT, actorId: ACTOR }, paths: ["config/app.conf"], now: createdAt });
        await writeFile(file, MUTATED, "utf8");

        const result = await store.rollback(created.id, { tenantId: TENANT, actorId: ACTOR }, new Date(createdAt.getTime() + 60_000));
        assert.equal(result.ok, false);
        assert.equal(result.evidence.code, "EXPIRED");
        assert.deepEqual(result.evidence.compensatingActions, ["manual_compensating_review"]);
        assert.equal(await readFile(file, "utf8"), MUTATED);
    });

    it("7. refuses a tampered checkpoint record before checking ownership", async () => {
        const { root, snapshotRoot, file } = await makeFixture();
        const store = makeStore({ root, snapshotRoot });
        const created = await store.createCheckpoint({ owner: { tenantId: TENANT, actorId: ACTOR }, paths: ["config/app.conf"] });
        await writeFile(file, MUTATED, "utf8");

        // Rewrite the recorded fingerprint, keeping the original signature.
        const tampered: CheckpointRecord = {
            ...created,
            files: created.files.map((f) => ({ ...f, contentHash: "0".repeat(64) })),
        };
        store.overwriteRecordUnsafe(tampered);

        const result = await store.rollback(created.id, { tenantId: TENANT, actorId: ACTOR });
        assert.equal(result.ok, false);
        assert.equal(result.evidence.code, "INTEGRITY_FAILED");
        assert.equal(await readFile(file, "utf8"), MUTATED);

        // A correctly re-signed record with a different owner still fails ownership.
        const reowned = { ...created, owner: { tenantId: "tenant_beta", actorId: ACTOR } };
        store.overwriteRecordUnsafe({ ...reowned, integrity: await signCheckpoint(reowned, SECRET) });
        const owned = await store.rollback(created.id, { tenantId: TENANT, actorId: ACTOR });
        assert.equal(owned.evidence.code, "TENANT_MISMATCH");
    });

    it("8. serializes concurrent rollback requests so state is restored exactly once", async () => {
        const { root, snapshotRoot, file } = await makeFixture();
        let writes = 0;
        const store = makeStore({
            root,
            snapshotRoot,
            writeImpl: async (path, data) => {
                writes += 1;
                await writeFile(path, data);
            },
        });
        const created = await store.createCheckpoint({ owner: { tenantId: TENANT, actorId: ACTOR }, paths: ["config/app.conf"] });
        await writeFile(file, MUTATED, "utf8");

        const [first, second] = await Promise.all([
            store.rollback(created.id, { tenantId: TENANT, actorId: ACTOR }),
            store.rollback(created.id, { tenantId: TENANT, actorId: ACTOR }),
        ]);
        const codes = [first.evidence.code, second.evidence.code].sort();
        assert.deepEqual(codes, ["ALREADY_ROLLED_BACK", "OK"]);
        assert.equal(writes, 1);
        assert.equal(await readFile(file, "utf8"), ORIGINAL);
    });

    it("9. is idempotent: a repeated rollback does not restore again", async () => {
        const { root, snapshotRoot, file } = await makeFixture();
        await withBroker({ root, snapshotRoot, secret: SECRET }, async (call) => {
            const created = await call("/v1/checkpoint/create", { paths: ["config/app.conf"] });
            await writeFile(file, MUTATED, "utf8");

            const first = await call("/v1/checkpoint/rollback", { checkpointId: created.json.checkpointId });
            assert.equal((first.json.evidence as RollbackEvidence).outcome, "RESTORED");

            // Post-rollback drift must NOT be silently re-restored by a repeat call.
            await writeFile(file, "drift after rollback", "utf8");
            const second = await call("/v1/checkpoint/rollback", { checkpointId: created.json.checkpointId });
            assert.equal(second.status, 200);
            const evidence = second.json.evidence as RollbackEvidence;
            assert.equal(evidence.outcome, "REJECTED");
            assert.equal(evidence.code, "ALREADY_ROLLED_BACK");
            assert.equal(evidence.filesRestored, 0);
            assert.equal(await readFile(file, "utf8"), "drift after rollback");
        });
    });

    it("10. reports a rollback failure honestly instead of claiming restoration", async () => {
        const { root, snapshotRoot, file } = await makeFixture();
        const store = makeStore({
            root,
            snapshotRoot,
            writeImpl: async () => {
                const error = new Error("device is read-only") as Error & { code?: string };
                error.code = "EROFS";
                throw error;
            },
        });
        const created = await store.createCheckpoint({ owner: { tenantId: TENANT, actorId: ACTOR }, paths: ["config/app.conf"] });
        await writeFile(file, MUTATED, "utf8");

        const result = await store.rollback(created.id, { tenantId: TENANT, actorId: ACTOR });
        assert.equal(result.ok, false);
        assert.equal(result.evidence.outcome, "FAILED");
        assert.equal(result.evidence.code, "RESTORE_FAILED");
        assert.equal(result.evidence.stateVerified, false);
        assert.ok(result.evidence.compensatingActions.includes("manual_compensating_review"));
        assert.equal(store.get(created.id)?.status, "FAILED");
        assert.equal(await readFile(file, "utf8"), MUTATED);
    });

    it("11. classifies compensating-action-only when exact restoration is impossible", async () => {
        const { root, snapshotRoot } = await makeFixture();
        const store = makeStore({ root, snapshotRoot });
        const compensating = await store.createCheckpoint({
            owner: { tenantId: TENANT, actorId: ACTOR },
            paths: [],
            sideEffects: [{ id: "email_1", kind: "email.send", reversible: false, compensatingAction: "send_correction_email" }],
        });
        const result = await store.rollback(compensating.id, { tenantId: TENANT, actorId: ACTOR });
        assert.equal(result.evidence.classification, "COMPENSATING_ACTION_ONLY");
        assert.deepEqual(result.evidence.compensatingActions, ["send_correction_email"]);

        // With restorable files AND an irreversible effect, it is partial, not exact.
        const mixed = await store.createCheckpoint({
            owner: { tenantId: TENANT, actorId: ACTOR },
            paths: ["config/app.conf"],
            sideEffects: [{ id: "webhook_1", kind: "webhook.post", reversible: false }],
        });
        const mixedResult = await store.rollback(mixed.id, { tenantId: TENANT, actorId: ACTOR });
        assert.equal(mixedResult.evidence.classification, "PARTIAL_RESTORE_WITH_COMPENSATION");
        assert.deepEqual(mixedResult.evidence.compensatingActions, ["manual_review:webhook.post"]);
    });

    it("12. never records raw protected state, paths, or secrets in evidence or logs", async () => {
        const { root, snapshotRoot, file } = await makeFixture();
        const logs: Array<{ message: string; metadata?: Record<string, unknown> }> = [];
        const store = makeStore({ root, snapshotRoot, logger: (message, metadata) => logs.push({ message, metadata }) });
        const created = await store.createCheckpoint({ owner: { tenantId: TENANT, actorId: ACTOR }, paths: ["config/app.conf"] });
        await writeFile(file, MUTATED, "utf8");
        const result = await store.rollback(created.id, { tenantId: TENANT, actorId: ACTOR });

        const serialized = JSON.stringify({ evidence: result.evidence, logs });
        assert.equal(serialized.includes("sk-live-DO-NOT-LEAK"), false);
        assert.equal(serialized.includes("app.conf"), false);
        assert.equal(serialized.includes(root.replace(/\\/g, "\\\\")), false);
        assert.equal(serialized.includes("port=8080"), false);
        // Path evidence is a truncated digest only.
        assert.equal(result.evidence.pathDigests.length, 1);
        assert.match(result.evidence.pathDigests[0], /^[0-9a-f]{16}$/);
        assert.ok(logs.some((entry) => entry.message === "checkpoint_rollback_completed"));
    });

    it("rejects protected paths that escape the isolation root", async () => {
        const { root, snapshotRoot } = await makeFixture();
        await withBroker({ root, snapshotRoot, secret: SECRET }, async (call) => {
            const escape = await call("/v1/checkpoint/create", { paths: ["../../etc/hosts"] });
            assert.equal(escape.status, 403);
            assert.equal(escape.json.error.code, "checkpoint_out_of_scope");
        });
    });

    it("requires a canonical tenant and actor, and 501s when checkpointing is not configured", async () => {
        const { root, snapshotRoot } = await makeFixture();
        await withBroker({ root, snapshotRoot, secret: SECRET }, async (call) => {
            const noTenant = await call("/v1/checkpoint/create", { paths: ["config/app.conf"] }, { "x-soterai-tenant": "" });
            assert.equal(noTenant.status, 400);
            assert.equal(noTenant.json.error.code, "missing_tenant");
        });

        const broker = new BrokerServer({ token: TOKEN, port: 0 });
        const { url } = await broker.start();
        try {
            const response = await fetch(`${url}/v1/checkpoint/create`, {
                method: "POST",
                headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
                body: JSON.stringify({ paths: ["x"] }),
            });
            assert.equal(response.status, 501);
            assert.equal((await response.json() as any).error.code, "checkpoint_disabled");
        } finally {
            await broker.stop();
        }
    });

    it("rejects unauthenticated checkpoint requests", async () => {
        const { root, snapshotRoot } = await makeFixture();
        const broker = new BrokerServer({ token: TOKEN, port: 0, checkpoint: { root, snapshotRoot, secret: SECRET } });
        const { url } = await broker.start();
        try {
            const response = await fetch(`${url}/v1/checkpoint/rollback`, {
                method: "POST",
                headers: { "content-type": "application/json", "x-soterai-tenant": TENANT, "x-soterai-actor": ACTOR },
                body: JSON.stringify({ checkpointId: "ckpt_anything" }),
            });
            assert.equal(response.status, 401);
        } finally {
            await broker.stop();
        }
    });

    it("refuses a snapshot root inside the protected root and a weak integrity secret", async () => {
        const { root } = await makeFixture();
        assert.throws(() => makeStore({ root, snapshotRoot: join(root, "snaps") }), /snapshotRoot must be outside/);
        assert.throws(
            () => new FilesystemCheckpointStore({ root, snapshotRoot: join(root, "..", "snaps"), secret: "short" }),
            /at least 32 characters/,
        );
    });
});
