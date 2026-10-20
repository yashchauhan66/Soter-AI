import assert from "node:assert/strict";
import { test } from "node:test";
const load = () => import("../adapters/CodexIdeAdapterPolicy");
const gateway = { endpoint: "http://127.0.0.1:43124/codex", token: "b".repeat(64), session: "12345678-1234-4234-9234-123456789abc" };
const connection = { endpoint: "http://127.0.0.1:43123/codex/mcp", token: "a".repeat(64), session: "12345678-1234-4234-9234-123456789abc" };
async function fixture() {
    const p = await load(); let file: string | undefined, writes = 0, prepared = false;
    const saved = new Map<string, string>();
    const deps = { enabled: () => true, fingerprint: () => "owner", read: async () => file,
        write: async (v: string | undefined) => { assert.equal(prepared, true); file = v; writes++; },
        backups: { store: async (_name: string, text: string) => { saved.set("encrypted-id", text); return "encrypted-id"; },
            retrieve: async (id: string) => saved.get(id) ?? null },
        confirm: async (_preview: unknown) => true, prepare: async (_receipt: unknown) => { prepared = true; } };
    return { p, deps, saved, plan: p.createCodexIdePlan(undefined, connection, gateway), file: () => file, mutate: (v: string | undefined) => { file = v; }, writes: () => writes };
}
test("F20B-P01 new profile requests disabled native preferences and binds F04 plus inspected text Responses", async () => {
    const f = await fixture(), r = await f.plan.apply(f.deps);
    assert.equal(r.status, "APPLIED"); const text = f.file()!;
    for (const field of ["shell_tool", "shell_snapshot", "unified_exec", "view_image", "image_generation", "apps", "plugins", "multi_agent", "js_repl"]) assert.match(text, new RegExp("^" + field + " = false$", "m"));
    assert.match(text, /^project_doc_max_bytes = 0$/m); assert.match(text, /^web_search = "disabled"$/m);
    assert.match(text, /^required = true$/m); assert.match(text, /^enabled_tools = \["soterai_read_project_file_safely"\]$/m);
    assert.equal(text.includes("danger-full-access"), false); assert.equal(text.includes("model_provider"), true);
    assert.equal(await f.p.codexIdeProfileCurrent(r.receipt, f.deps), true);
    assert.equal(f.saved.size, 1); assert.equal(JSON.stringify(r).includes(connection.token), false);
});
test("F20B-P02 refuses existing config instead of silently merging unknown routes", async () => {
    const p = await load();
    for (const before of ["", "model='public'", "[mcp_servers.other]\ncommand='public'"]) assert.throws(() => p.createCodexIdePlan(before, connection, gateway), /unavailable/i);
});
test("F20B-P03 rejects malformed connections and profile injection", async () => {
    const p = await load();
    for (const c of [{ ...connection, endpoint: "https://example.invalid/codex/mcp" }, { ...connection, endpoint: connection.endpoint + "?x=1" },
        { ...connection, endpoint: connection.endpoint.replace("127.0.0.1", "localhost") }, { ...connection, token: 'a"\n[features]' },
        { ...connection, session: "x" }, { ...connection, raw: true }]) assert.throws(() => p.createCodexIdePlan(undefined, c, gateway), /unavailable/i);
});
test("F20B-P04 review is value-free and plan is single use", async () => {
    const f = await fixture(); let review: unknown;
    f.deps.confirm = async p => { review = p; return true; }; assert.equal((await f.plan.apply(f.deps)).status, "APPLIED");
    assert.equal(JSON.stringify(review).includes(connection.token), false); assert.equal(JSON.stringify(review).includes(connection.endpoint), false);
    assert.match(JSON.stringify(review), /buffered/i); assert.equal((await f.plan.apply(f.deps)).status, "UNAVAILABLE");
});
for (const kind of ["cancel", "disabled", "owner-drift", "file-drift", "aborted"] as const) test("F20B-P05 no write on " + kind, async () => {
    const f = await fixture(), abort = new AbortController();
    if (kind === "cancel") f.deps.confirm = async () => false;
    if (kind === "disabled") f.deps.enabled = () => false;
    if (kind === "owner-drift") f.deps.confirm = async () => { f.deps.fingerprint = () => "other"; return true; };
    if (kind === "file-drift") f.deps.confirm = async () => { f.mutate("unowned"); return true; };
    if (kind === "aborted") abort.abort();
    assert.notEqual((await f.plan.apply(f.deps, abort.signal)).status, "APPLIED"); assert.equal(f.writes(), 0); assert.equal(f.saved.size, 0);
});
for (const kind of ["backup", "durable-receipt"] as const) test("F20B-P06 " + kind + " failure precedes writes", async () => {
    const f = await fixture(); if (kind === "backup") f.deps.backups.store = async () => { throw Error(connection.token); };
    else f.deps.prepare = async () => { throw Error(connection.token); };
    const r = await f.plan.apply(f.deps); assert.equal(r.status, "UNAVAILABLE"); assert.equal(f.writes(), 0); assert.equal(JSON.stringify(r).includes(connection.token), false);
});
test("F20B-P07 write-then-throw rolls back only exact owned bytes", async () => {
    const f = await fixture(), write = f.deps.write; let first = true;
    f.deps.write = async v => { await write(v); if (first) { first = false; throw Error("synthetic"); } };
    assert.equal((await f.plan.apply(f.deps)).status, "ROLLED_BACK"); assert.equal(f.file(), undefined); assert.equal(f.saved.size, 1);
});
test("F20B-P08 post-write unowned changes are retained with INCOMPLETE recovery", async () => {
    const f = await fixture(), write = f.deps.write;
    f.deps.write = async v => { await write(v); f.mutate("unowned"); throw Error("synthetic"); };
    const r = await f.plan.apply(f.deps); assert.equal(r.status, "INCOMPLETE"); assert.ok(r.receipt); assert.equal(f.file(), "unowned");
});
test("F20B-P09 explicit reviewed restore removes owned config and retains backup", async () => {
    const f = await fixture(), r = await f.plan.apply(f.deps);
    assert.equal((await f.p.undoCodexIdeProfile(r.receipt, f.deps)).status, "RESTORED"); assert.equal(f.file(), undefined); assert.equal(f.saved.size, 1);
});
for (const kind of ["cancel", "config-drift", "corrupt-backup", "owner-drift", "bad-receipt"] as const) test("F20B-P10 restore withholds on " + kind, async () => {
    const f = await fixture(), r = await f.plan.apply(f.deps); const writes = f.writes();
    if (kind === "cancel") f.deps.confirm = async () => false;
    if (kind === "config-drift") f.mutate("unowned");
    if (kind === "corrupt-backup") f.saved.set("encrypted-id", '{"version":1,"present":true,"before":"unowned"}');
    if (kind === "owner-drift") f.deps.fingerprint = () => "other";
    const receipt = kind === "bad-receipt" ? { ...r.receipt, afterDigest: "bad" } : r.receipt;
    assert.notEqual((await f.p.undoCodexIdeProfile(receipt as any, f.deps)).status, "RESTORED"); assert.equal(f.writes(), writes);
});
test("F20B-P11 drift during restore review cannot delete unowned config", async () => {
    const f = await fixture(), r = await f.plan.apply(f.deps);
    f.deps.confirm = async () => { f.mutate("unowned"); return true; }; const writes = f.writes();
    assert.equal((await f.p.undoCodexIdeProfile(r.receipt, f.deps)).status, "CHANGED"); assert.equal(f.writes(), writes);
});
test("F20B-P12 current profile authority is withdrawn on owner, feature or byte drift", async () => {
    for (const kind of ["owner", "flag", "bytes"]) {
        const f = await fixture(), r = await f.plan.apply(f.deps);
        if (kind === "owner") f.deps.fingerprint = () => "other"; if (kind === "flag") f.deps.enabled = () => false; if (kind === "bytes") f.mutate(f.file() + " ");
        assert.equal(await f.p.codexIdeProfileCurrent(r.receipt, f.deps), false);
    }
});
