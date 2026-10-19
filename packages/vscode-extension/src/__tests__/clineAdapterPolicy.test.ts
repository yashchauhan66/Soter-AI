import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { buildSecurePlan, KNOWN_AI_TOOLS } from "../broker/AutoSecureEngine";
const policy = () => import("../adapters/ClineAdapterPolicy");
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const OLD = "TEST_ONLY_F18_PREVIOUS_PROVIDER_CREDENTIAL";
const OWNER = "TEST_ONLY_F18_EPHEMERAL_OWNED_CREDENTIAL";
const binding = { url: "http://127.0.0.1:12345/v1/ai/openai-compatible", credential: OWNER, codePath: "D:/fixture/Code.exe", mcpPath: "D:/fixture/dist/soterai-mcp-server.js", ticketPath: "D:/fixture/global/adapter-sessions/cline-session.ticket", workspace: "D:/fixture/project", session: "test-session-A" };
function inputs() { return {
    providers: JSON.stringify({ version: 1, lastUsedProvider: "openai-compatible", modes: {}, providers: { "openai-compatible": { settings: { provider: "openai-compatible", apiKey: OLD, model: "synthetic-model", baseUrl: "https://provider.invalid/v1" }, tokenSource: "fixture" }, preserved: { settings: { value: "public" } } } }),
    mcp: JSON.stringify({ mcpServers: { preserved: { command: "public-helper", args: [] } } }),
    globals: JSON.stringify({ autoUpdateEnabled: true, telemetryOptOut: false, preserved: "public" }), hook: undefined as string | undefined, taskHook: undefined as string | undefined,
}; }
async function fixture(overrides: Record<string, unknown> = {}) {
    const module = await policy(), files: ReturnType<typeof inputs> & Record<string, string | undefined> = inputs(), backups = new Map<string, string>(); let reviews = 0, writes = 0;
    const deps = { enabled: () => true, fingerprint: () => "fixture-lease-A", read: async (key: string) => files[key], write: async (key: string, value: string | undefined) => { writes++; files[key] = value; },
        backups: { store: async (_key: string, value: string) => { const handle = "handle-" + backups.size; backups.set(handle, value); return handle; }, retrieve: async (handle: string) => backups.get(handle) ?? null },
        confirm: async (preview: unknown) => { reviews++; const text = JSON.stringify(preview); assert.ok(!text.includes(OLD) && !text.includes(OWNER)); return true; }, ...overrides };
    return { module, files, backups, deps, counts: () => ({ reviews, writes }), plan: module.createClinePlan(files, binding) };
}
test("F18 legacy generic Cline env writer cannot advertise a version-unverified routing change", () => {
    const spec = KNOWN_AI_TOOLS.find(tool => tool.id === "cline")!;
    const before = '{"baseURL":"https://provider.invalid/v1"}';
    const plan = buildSecurePlan([{ spec, status: "found", configs: [{ kind: "openai-compatible", path: "/synthetic/cline/config.json", exists: true, notes: [] }] }], { "/synthetic/cline/config.json": before }, 12345);
    assert.equal(plan.proposed.length, 0); assert.ok(plan.unsupported.some(item => item.toolId === "cline"));
});
test("F18 artifact gate uses actual bytes and refuses version/publisher/runtime/manifest drift", async () => {
    const { verifyClineArtifact } = await policy(), manifest = JSON.stringify({ publisher: "saoudrizwan", name: "claude-dev", version: "4.1.25", main: "./dist/extension.js" }), runtime = "public runtime fixture";
    const pin = { publisher: "saoudrizwan", name: "claude-dev", version: "4.1.25", manifestSha256: sha(manifest), runtimeSha256: sha(runtime) };
    assert.equal(verifyClineArtifact(Buffer.from(manifest), Buffer.from(runtime), pin), true);
    for (const [left, right] of [[manifest + " ", runtime], [manifest, runtime + " changed"], [manifest.replace("4.1.25", "4.1.26"), runtime], ["{broken", runtime]]) assert.equal(verifyClineArtifact(Buffer.from(left), Buffer.from(right), pin), false);
});
test("F18 current providers/MCP/global schema preserves unrelated fields and masks the entire review", async () => {
    const { plan } = await fixture(); const preview = JSON.stringify(plan.preview()); assert.ok(!preview.includes(OLD) && !preview.includes(OWNER)); assert.ok(!JSON.stringify(plan).includes(OLD));
    assert.deepEqual(plan.preview().changes.slice().sort(), ["providers", "mcp", "globals", "hook", "taskHook"].sort());
});
test("F18 approval, backup and exact apply round trip route only the selected pinned provider", async () => {
    const { plan, deps, files, backups, counts } = await fixture(); const result = await plan.apply(deps); assert.equal(result.status, "APPLIED"); assert.equal(counts().reviews, 1); assert.equal(backups.size, 5);
    const providers = JSON.parse(files.providers!), mcp = JSON.parse(files.mcp!), globals = JSON.parse(files.globals!);
    assert.equal(providers.providers["openai-compatible"].settings.baseUrl, binding.url); assert.equal(providers.providers["openai-compatible"].settings.apiKey, OWNER); assert.equal(providers.providers["openai-compatible"].settings.model, "synthetic-model"); assert.equal(providers.providers.preserved.settings.value, "public");
    assert.equal(mcp.mcpServers.preserved.command, "public-helper"); assert.equal(mcp.mcpServers.soterai_safe_read.env.SOTERAI_SAFE_READ_TICKET_PATH, binding.ticketPath); assert.ok(!files.mcp!.includes(OWNER));
    assert.equal(globals.autoUpdateEnabled, false); assert.equal(globals.telemetryOptOut, true); assert.equal(globals.preserved, "public"); assert.ok(!JSON.stringify(result).includes(OLD) && !JSON.stringify(result).includes(OWNER));
    assert.ok(files.taskHook?.includes("--cline-hook")); assert.ok(files.taskHook?.includes("SOTERAI_CLINE_WORKSPACE"));
});
test("F18 cancelled review writes nothing and creates no backup grant", async () => {
    const { plan, deps, backups, counts } = await fixture({ confirm: async () => false }); assert.equal((await plan.apply(deps)).status, "CANCELLED"); assert.equal(counts().writes, 0); assert.equal(backups.size, 0);
});
test("F18 unavailable encrypted backup stops all config writes without echoing its exception", async () => {
    const { plan, deps, counts } = await fixture({ backups: { store: async () => { throw Error(OLD); }, retrieve: async () => null } }); const result = await plan.apply(deps); assert.equal(result.status, "UNAVAILABLE"); assert.equal(counts().writes, 0); assert.ok(!JSON.stringify(result).includes(OLD));
});
test("F18 config drift while review is pending invalidates the complete planned write", async () => {
    const item = await fixture(); item.deps.confirm = async () => { item.files.providers += " "; return true; }; assert.equal((await item.plan.apply(item.deps)).status, "CHANGED"); assert.equal(item.counts().writes, 0);
});
test("F18 owner/session/flag withdrawal after review returns no changes", async () => {
    let fingerprint = "fixture-lease-A", enabled = true; const item = await fixture({ fingerprint: () => fingerprint, enabled: () => enabled }); item.deps.confirm = async () => { fingerprint = "fixture-lease-B"; enabled = false; return true; };
    assert.notEqual((await item.plan.apply(item.deps)).status, "APPLIED"); assert.equal(item.counts().writes, 0);
});
test("F18 a partial write failure restores only unchanged owned changes using encrypted backups", async () => {
    const item = await fixture(), before = { ...item.files }; let writes = 0;
    item.deps.write = async (key, value) => { if (++writes === 2) throw Error(OLD); item.files[key] = value; };
    const result = await item.plan.apply(item.deps); assert.equal(result.status, "ROLLED_BACK"); assert.deepEqual(item.files, before); assert.ok(!JSON.stringify(result).includes(OLD));
});
test("F18 undo restores the exact previous private configuration without exposing it", async () => {
    const item = await fixture(), before = { ...item.files }; const result = await item.plan.apply(item.deps); assert.equal(result.status, "APPLIED");
    const undo = await item.module.undoClineFiles(result.receipt, item.deps); assert.equal(undo.status, "RESTORED"); assert.deepEqual(item.files, before); assert.ok(!JSON.stringify(undo).includes(OLD));
});
test("F18 undo refuses to overwrite a later vendor/user config edit", async () => {
    const item = await fixture(); const result = await item.plan.apply(item.deps); item.files.providers += " "; const before = { ...item.files }; assert.equal((await item.module.undoClineFiles(result.receipt, item.deps)).status, "CHANGED"); assert.deepEqual(item.files, before);
});
test("F18 malformed/future schemas, custom modes, unowned MCP name/hook and external destinations refuse", async () => {
    const { createClinePlan } = await policy();
    for (const patch of [{ providers: "{broken" }, { providers: JSON.stringify({ version: 2, providers: {}, modes: {} }) }, { providers: JSON.stringify({ version: 1, providers: {}, modes: { custom: {} } }) }, { mcp: '{"mcpServers":{"soterai_safe_read":{"command":"other"}}}' }, { hook: "Unowned custom hook" }, { taskHook: "Unowned TaskStart" }]) assert.throws(() => createClinePlan({ ...inputs(), ...patch }, binding), /unavailable|unsupported/i);
    assert.throws(() => createClinePlan(inputs(), { ...binding, url: "https://provider.invalid" }), /unavailable|unsupported/i);
});
