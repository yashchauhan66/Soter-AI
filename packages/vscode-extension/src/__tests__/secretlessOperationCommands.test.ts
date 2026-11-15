import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type * as vscode from "vscode";
import { registerSecretlessOperationCommands } from "../secretless-operations/commands";
import type { VaultHttpRequest, VaultHttpResponse } from "../secretless-operations/VaultTokenLeaseProvider";
import type { OperationBinding } from "../../../core/src/SecretlessOperationBroker";
import * as stub from "./phase2/vscode-stub";

const BOOTSTRAP = "hvs.synthetic-native-bootstrap-only-A1b2c3";
const CHILD = "hvs.synthetic-native-issued-once-X7y8z9";
const CONFIG = "soterai.lite.secretlessVaultOperation.v1", SECRET = "soterai.lite.secretlessVaultBootstrap.v1";
const binding: OperationBinding = { sessionId: "native-operation-session", imageDigest: "a".repeat(64), artifactDigest: "b".repeat(64), policyDigest: "c".repeat(64) };
const json = (body: unknown, status = 200): VaultHttpResponse => ({ status, contentType: "application/json", body: Buffer.from(JSON.stringify(body)) });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { resolve, promise }; }
const tick = () => new Promise<void>(done => setImmediate(done));
function fixture(t: TestContext) {
    stub.resetState("C:\\Synthetic secretless operation workspace");
    const context = stub.makeExtensionContext("C:\\Synthetic secretless operation profile");
    const state = { input: [] as Array<string | undefined>, inputOptions: [] as unknown[], calls: [] as VaultHttpRequest[], reviews: [] as string[], refreshes: 0,
        save: true, approve: true, onReview: undefined as (() => Promise<void>) | undefined,
        issuerHold: undefined as ReturnType<typeof deferred<VaultHttpResponse>> | undefined,
        read: json({ initialized: true, sealed: false, standby: false, internal: "not-in-fields" }) };
    t.mock.method(stub.window, "showInputBox", async (options: unknown) => { state.inputOptions.push(options); return state.input.shift(); });
    t.mock.method(stub.window, "showWarningMessage", (async (_message: string, options: { detail?: string }, ...actions: string[]) => {
        state.reviews.push(options.detail ?? "");
        if (actions.includes("Save Vault operation")) return state.save ? "Save Vault operation" : undefined;
        if (actions.includes("Approve one read")) { await state.onReview?.(); return state.approve ? "Approve one read" : undefined; }
        return actions.includes("Remove Vault operation") ? "Remove Vault operation" : undefined;
    }) as never);
    const bridge = registerSecretlessOperationCommands(context as unknown as vscode.ExtensionContext, () => { state.refreshes++; }, { transport: async (request, signal) => {
        state.calls.push(request); assert.equal(signal.aborted, false);
        if (request.url.endsWith("/revoke-self")) return json(null, 204);
        if (request.method === "GET") return state.read;
        if (state.issuerHold) return state.issuerHold.promise;
        return json({ auth: { client_token: CHILD, lease_duration: 60, renewable: false, num_uses: 1, token_type: "service", policies: ["default", "soterai-status-read"] } });
    } });
    t.after(() => { bridge.dispose(); context.subscriptions.forEach(subscription => subscription.dispose()); stub.resetState(); });
    const configure = async () => {
        state.input.push("https://vault.example.com", "soterai-read", "default,soterai-status-read", "/v1/sys/health", "initialized,sealed,standby", "60", BOOTSTRAP);
        return stub.commands.executeCommand("soterai.configureSecretlessVaultOperation") as Promise<{ status: string; operationId?: string }>;
    };
    return { bridge, context, state, configure };
}
function noSecrets(value: unknown): void { const text = JSON.stringify(value); assert.ok(!text.includes(BOOTSTRAP) && !text.includes(CHILD)); }

test("native configuration stores bootstrap only in SecretStorage and makes no issuer request", async t => {
    const f = fixture(t), before = f.bridge.policyDigest(), configured = await f.configure();
    assert.equal(configured.status, "CONFIGURED_UNVERIFIED"); assert.equal(f.state.calls.length, 0); assert.notEqual(f.bridge.policyDigest(), before);
    assert.equal(f.context._inspect.secretStore.get(SECRET), BOOTSTRAP); assert.equal(f.context._inspect.globalStore.has(CONFIG), true);
    assert.ok((f.state.inputOptions[6] as { password?: boolean }).password); assert.equal((f.state.inputOptions[6] as { value?: string }).value, "");
    noSecrets(configured); noSecrets(f.bridge.list()); noSecrets([...f.context._inspect.globalStore]); noSecrets(f.state.reviews);
    noSecrets(stub.sinks.filter(sink => sink.sink !== "secretStorage"));
});

test("trusted bridge performs native per-use approval then one real provider issuance/read/disposal sequence", async t => {
    const f = fixture(t), configured = await f.configure(); assert.ok(configured.operationId);
    const result = await f.bridge.executeApproved(configured.operationId, binding); await tick();
    assert.deepEqual(result, { status: "COMPLETE", operationId: configured.operationId, resource: "/v1/sys/health", fields: { initialized: true, sealed: false, standby: false } });
    assert.equal(f.state.calls.length, 3); assert.equal(f.state.calls[0].token, BOOTSTRAP); assert.equal(f.state.calls[1].token, CHILD); assert.equal(f.state.calls[2].token, CHILD);
    const approval = JSON.parse(f.state.reviews[1]); assert.equal(approval.resource, "/v1/sys/health"); assert.deepEqual(approval.binding, binding);
    assert.deepEqual(approval.responseFields, ["initialized", "sealed", "standby"]); noSecrets(f.state.reviews); noSecrets(result);
});

test("missing configuration/bootstrap and cancelled native consent remain unavailable without issuance", async t => {
    const f = fixture(t);
    assert.deepEqual(await f.bridge.executeApproved("unknown", binding), { status: "WITHHELD" }); assert.deepEqual(f.bridge.list(), []);
    const configured = await f.configure(); f.state.approve = false;
    assert.deepEqual(await f.bridge.executeApproved(configured.operationId!, binding), { status: "WITHHELD" }); assert.equal(f.state.calls.length, 0);
    f.state.approve = true; f.context._inspect.secretStore.delete(SECRET);
    assert.deepEqual(await f.bridge.executeApproved(configured.operationId!, binding), { status: "WITHHELD" }); assert.equal(f.state.calls.length, 0);
});

test("command arguments cannot supply credentials, operation configuration or approval", async t => {
    const f = fixture(t);
    for (const command of ["configureSecretlessVaultOperation", "removeSecretlessVaultOperation", "secretlessOperationStatus"]) {
        assert.deepEqual(await stub.commands.executeCommand("soterai." + command, { token: BOOTSTRAP, approve: true }), { status: "UNAVAILABLE" });
    }
    assert.equal(f.state.inputOptions.length, 0); assert.equal(f.context._inspect.secretStore.size, 0); assert.equal(f.state.calls.length, 0);
});

test("owner configuration changes while consent is pending invalidate the exact proposed read", async t => {
    const f = fixture(t), configured = await f.configure();
    f.state.onReview = async () => { const saved = f.context._inspect.globalStore.get(CONFIG) as Record<string, unknown>; f.context._inspect.globalStore.set(CONFIG, { ...saved, ttlSeconds: 30 }); };
    assert.deepEqual(await f.bridge.executeApproved(configured.operationId!, binding), { status: "WITHHELD" }); assert.equal(f.state.calls.length, 0);
});

test("known bootstrap or issued credentials in an allowed field never return to the guest", async t => {
    const f = fixture(t), configured = await f.configure();
    for (const value of [BOOTSTRAP, CHILD]) {
        f.state.read = json({ initialized: true, sealed: value, standby: false });
        const result = await f.bridge.executeApproved(configured.operationId!, binding); assert.deepEqual(result, { status: "WITHHELD" }); noSecrets(result);
    }
});

test("bridge disposal cancels pending issuance and late issued token is revoked", async t => {
    const f = fixture(t), configured = await f.configure(), held = deferred<VaultHttpResponse>(); f.state.issuerHold = held;
    const work = f.bridge.executeApproved(configured.operationId!, binding); await tick(); assert.equal(f.state.calls.length, 1); f.bridge.dispose();
    assert.deepEqual(await work, { status: "WITHHELD" });
    held.resolve(json({ auth: { client_token: CHILD, lease_duration: 60, renewable: false, num_uses: 1, token_type: "service", policies: ["default", "soterai-status-read"] } }));
    await tick(); assert.equal(f.state.calls.filter(call => call.method === "GET").length, 0);
    assert.ok(f.state.calls.some(call => call.url.endsWith("/revoke-self")));
});

test("cancelled setup preserves existing configuration and bootstrap", async t => {
    const f = fixture(t); await f.configure(); const before = JSON.stringify([...f.context._inspect.globalStore]); f.state.save = false;
    assert.equal((await f.configure()).status, "CANCELLED"); assert.equal(JSON.stringify([...f.context._inspect.globalStore]), before);
    assert.equal(f.context._inspect.secretStore.get(SECRET), BOOTSTRAP); assert.equal(f.state.calls.length, 0);
});

test("reviewed removal deletes configuration and bootstrap and invalidates policy identity", async t => {
    const f = fixture(t); await f.configure(); const before = f.bridge.policyDigest();
    assert.deepEqual(await stub.commands.executeCommand("soterai.removeSecretlessVaultOperation"), { status: "REMOVED" });
    assert.notEqual(f.bridge.policyDigest(), before); assert.deepEqual(f.bridge.list(), []); assert.equal(f.context._inspect.secretStore.has(SECRET), false);
    assert.equal(f.state.calls.length, 0);
});
