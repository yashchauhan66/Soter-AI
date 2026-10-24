import { test } from "node:test";
import assert from "node:assert/strict";
const MCP = { endpoint: "http://127.0.0.1:31337/gemini/mcp", token: "a".repeat(64), session: "c9999999-9999-4999-8999-999999999999" };
const GATEWAY = { endpoint: "http://127.0.0.1:31338/gemini", token: "b".repeat(64), session: "c8888888-8888-4888-8888-888888888888" };
async function fixture(options: any = {}) {
    const module = await import("../adapters/GeminiCliAdapterPolicy"); let current: any, owner = "public-owner", enabled = true, prepared: any; const backups = new Map<string, string>();
    const deps: any = { enabled: () => enabled, fingerprint: () => owner, read: async () => current,
        write: async (value: any) => { current = value && { ...value }; }, backups: { store: async (_label: string, text: string) => { backups.set("backup", text); return "backup"; }, retrieve: async (id: string) => backups.get(id) },
        confirm: async () => true, prepare: async (receipt: any) => prepared = receipt, ...options };
    return { module, deps, state: () => current, set: (v: any) => current = v, owner: (v: string) => owner = v, disable: () => enabled = false, prepared: () => prepared, backups };
}
test("F20C dedicated profile renders only pinned controls and separate local roles, with value-free preview", async () => {
    const f = await fixture(), after = f.module.renderGeminiCliProfile(MCP, GATEWAY), settings = JSON.parse(after.settings);
    assert.deepEqual(settings.tools.core, ["mcp_soterai_safe_read_soterai_read_project_file_safely"]); assert.equal(settings.mcpServers.soterai_safe_read.url, MCP.endpoint); assert.equal(settings.mcpServers.soterai_safe_read.type, "http");
    assert.equal(settings.general.maxAttempts, 1); assert.equal(settings.general.retryFetchErrors, false);
    assert.equal(settings.mcpServers.soterai_safe_read.headers.Authorization, "Bearer " + MCP.token); assert(after.environment.includes("GEMINI_API_KEY=" + GATEWAY.token)); assert(after.environment.includes("GOOGLE_GEMINI_BASE_URL=" + GATEWAY.endpoint));
    assert(!after.environment.includes(MCP.token)); const plan = f.module.createGeminiCliPlan(undefined, MCP, GATEWAY); const preview = JSON.stringify(plan.preview()); assert(!preview.includes(MCP.token)); assert(!preview.includes(GATEWAY.token)); assert(!JSON.stringify(plan).includes(GATEWAY.token));
});
test("F20C reviewed creation persists encrypted absence and value-free recovery before two-file write", async () => {
    const f = await fixture(); f.deps.write = async (value: any) => { assert(f.prepared()); assert.equal(f.backups.size, 1); f.set(value); };
    const plan = f.module.createGeminiCliPlan(undefined, MCP, GATEWAY), result = await plan.apply(f.deps); assert.equal(result.status, "APPLIED"); assert(result.receipt); assert.equal(await f.module.geminiCliProfileCurrent(result.receipt, f.deps), true); assert(!JSON.stringify(result.receipt).includes(GATEWAY.token));
    assert.equal((await plan.apply(f.deps)).status, "UNAVAILABLE");
});
test("F20C cancel, disabled flag and changed owner never create settings or env", async () => {
    for (const variant of ["cancel", "flag", "owner"]) { const f = await fixture(); f.deps.confirm = async () => { if (variant === "flag") f.disable(); if (variant === "owner") f.owner("changed-owner"); return variant !== "cancel"; };
        const result = await f.module.createGeminiCliPlan(undefined, MCP, GATEWAY).apply(f.deps); assert.notEqual(result.status, "APPLIED"); assert.equal(f.state(), undefined); }
});
test("F20C existing or concurrently created native files are never overwritten", async () => {
    const f = await fixture(); assert.throws(() => f.module.createGeminiCliPlan({ settings: "PUBLIC_EXISTING" }, MCP, GATEWAY));
    f.deps.confirm = async () => { f.set({ environment: "PUBLIC_CONCURRENT" }); return true; };
    assert.equal((await f.module.createGeminiCliPlan(undefined, MCP, GATEWAY).apply(f.deps)).status, "CHANGED"); assert.deepEqual(f.state(), { environment: "PUBLIC_CONCURRENT" });
});
test("F20C malformed endpoints, shared/swapped tokens and nonloopback routes refuse before plan", async () => {
    const f = await fixture();
    for (const endpoint of ["http://localhost:31337/gemini/mcp", MCP.endpoint + "?raw=1", GATEWAY.endpoint]) assert.throws(() => f.module.renderGeminiCliProfile({ ...MCP, endpoint }, GATEWAY));
    for (const token of [MCP.token, "newline\n", "short"]) assert.throws(() => f.module.renderGeminiCliProfile(MCP, { ...GATEWAY, token }));
    assert.throws(() => f.module.renderGeminiCliProfile(MCP, { ...GATEWAY, endpoint: MCP.endpoint }));
});
test("F20C write/backup/prepare failures cannot report protection; partial files remain recoverable", async () => {
    for (const stage of ["backup", "prepare", "write"]) { const f = await fixture();
        if (stage === "backup") f.deps.backups.store = async () => { throw Error("Unavailable"); };
        if (stage === "prepare") f.deps.prepare = async () => { throw Error("Unavailable"); };
        if (stage === "write") f.deps.write = async (value: any) => { f.set({ settings: value.settings }); throw Error("Partial fixture write"); };
        const result = await f.module.createGeminiCliPlan(undefined, MCP, GATEWAY).apply(f.deps); assert.notEqual(result.status, "APPLIED");
        if (stage === "write") { assert.equal(result.status, "INCOMPLETE"); assert(result.receipt); assert.equal(await f.module.geminiCliProfileCurrent(result.receipt, f.deps), false); }
        else assert.equal(f.state(), undefined);
    }
});
test("F20C exact reviewed restore removes only owned members and resumes partial restoration", async () => {
    for (const missing of ["none", "settings", "environment"]) { const f = await fixture(), result = await f.module.createGeminiCliPlan(undefined, MCP, GATEWAY).apply(f.deps); assert.equal(result.status, "APPLIED");
        if (missing !== "none") { const partial = { ...f.state() }; delete partial[missing]; f.set(partial); }
        assert.equal((await f.module.undoGeminiCliProfile(result.receipt, f.deps)).status, "RESTORED"); assert.equal(f.state(), undefined);
    }
});
test("F20C foreign changed remaining file and unavailable backup withhold all restoration", async () => {
    for (const variant of ["changed", "backup", "owner", "cancel"]) { const f = await fixture(), result = await f.module.createGeminiCliPlan(undefined, MCP, GATEWAY).apply(f.deps); const state = { ...f.state() };
        if (variant === "changed") f.set({ settings: "PUBLIC_FOREIGN", environment: state.environment });
        if (variant === "backup") f.backups.clear(); if (variant === "owner") f.owner("new-owner"); if (variant === "cancel") f.deps.confirm = async () => false;
        const before = f.state(); assert.notEqual((await f.module.undoGeminiCliProfile(result.receipt, f.deps)).status, "RESTORED"); assert.deepEqual(f.state(), before);
    }
});
test("F20C cancellation while native confirmation is pending releases no profile", async () => {
    let reached!: () => void; const entered = new Promise<void>(resolve => reached = resolve), controller = new AbortController(), f = await fixture({ confirm: () => { reached(); return new Promise(() => {}); } });
    const result = f.module.createGeminiCliPlan(undefined, MCP, GATEWAY).apply(f.deps, controller.signal); await entered; controller.abort(); assert.equal((await result).status, "CANCELLED"); assert.equal(f.state(), undefined);
});

test("F20C partial restore that resolves without removing every file retains its receipt", async () => {
    const f = await fixture(), applied = await f.module.createGeminiCliPlan(undefined, MCP, GATEWAY).apply(f.deps);
    f.deps.write = async () => f.set({ environment: f.state().environment });
    const result = await f.module.undoGeminiCliProfile(applied.receipt, f.deps);
    assert.equal(result.status, "INCOMPLETE"); assert.deepEqual(result.receipt, applied.receipt);
});
