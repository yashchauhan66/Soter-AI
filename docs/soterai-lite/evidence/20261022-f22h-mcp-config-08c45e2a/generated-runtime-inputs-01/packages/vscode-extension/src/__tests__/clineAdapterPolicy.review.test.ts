import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createClinePlan, undoClineFiles } from "../adapters/ClineAdapterPolicy";
import { sealBridgeConnection, openBridgeTicket } from "../agent/SealedBridgeTicket";
const connection = { endpoint: "http://127.0.0.1:12345/safe-read", token: "b".repeat(64), session: "f18abcde-1234-4123-8123-0123456789ab" };
const binding = { url: "http://127.0.0.1:12345/v1/ai/openai-compatible", credential: "TEST_ONLY_F18_OWNER", codePath: "D:/fixture/Code.exe", mcpPath: "D:/fixture/dist/soterai-mcp-server.js", ticketPath: "D:/fixture/global/adapter-sessions/cline-session.ticket", workspace: "D:/fixture/project", session: "lease-A" };
const inputs = () => ({ providers: '{"version":1,"lastUsedProvider":"openai-compatible","modes":{},"providers":{"openai-compatible":{"settings":{"provider":"openai-compatible","model":"public"}}}}', mcp: '{"mcpServers":{}}', globals: '{}', hook: undefined as string | undefined, taskHook: undefined as string | undefined });
test("F18 review rejects non-ASCII aliases of an otherwise valid sealed ticket frame", async () => {
    // Identity transform isolates framing only; real cryptography has separate
    // AES-GCM and actual native DPAPI round-trip tests.
    const identity = async (_mode: "seal" | "open", value: Buffer) => Buffer.from(value);
    const sealed = (await sealBridgeConnection(connection, identity))!; const alias = Buffer.from(sealed); alias[0] |= 0x80;
    assert.deepEqual(await openBridgeTicket(sealed, identity), connection); assert.equal(await openBridgeTicket(alias, identity), undefined);
});
test("F18 review refuses noncanonical aliases of the pinned broker URL", () => {
    for (const url of [" " + binding.url, binding.url + "\n", binding.url.replace("127.0.0.1", "127.000.0.1")]) assert.throws(() => createClinePlan(inputs(), { ...binding, url }), /unavailable|unsupported/i);
});
test("F18 review a ticket path inside the project cannot enter the vendor config", () => {
    assert.throws(() => createClinePlan(inputs(), { ...binding, ticketPath: "D:/fixture/project/adapter-sessions/cline-session.ticket" }), /unavailable|unsupported/i);
});
test("F18 review abort promptly resolves a pending native review without writes", async () => {
    const files = inputs(), plan = createClinePlan(files, binding), abort = new AbortController(); let reviewed = false, writes = 0;
    const work = plan.apply({ enabled: () => true, fingerprint: () => "lease-A", read: async key => files[key], write: async () => { writes++; }, backups: { store: async () => "unused", retrieve: async () => null }, confirm: async () => { reviewed = true; return new Promise<boolean>(() => undefined); } }, abort.signal);
    while (!reviewed) await new Promise<void>(done => setImmediate(done)); abort.abort();
    assert.notEqual((await work).status, "APPLIED"); assert.equal(writes, 0);
});
test("F18 review a withdrawn partial apply can recover untouched and written entries after owner re-enables", async () => {
    const files = inputs(), original = { ...files }, plan = createClinePlan(files, binding), backups = new Map<string, string>(); let enabled = true;
    const deps = { enabled: () => enabled, fingerprint: () => "lease-A", read: async (key: keyof typeof files) => files[key],
        write: async (key: keyof typeof files, value: string | undefined) => { if (!enabled) throw Error("Withdrawn"); (files as Record<string, string | undefined>)[key] = value; enabled = false; },
        backups: { store: async (_key: string, value: string) => { const handle = "backup-" + backups.size; backups.set(handle, value); return handle; }, retrieve: async (handle: string) => backups.get(handle) ?? null }, confirm: async () => true };
    const result = await plan.apply(deps); assert.equal(result.status, "INCOMPLETE"); assert.ok(result.receipt); enabled = true;
    deps.write = async (key, value) => { (files as Record<string, string | undefined>)[key] = value; };
    assert.equal((await undoClineFiles(result.receipt, deps)).status, "RESTORED"); assert.deepEqual(files, original);
});
