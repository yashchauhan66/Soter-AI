import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { mkdtemp, mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import vm from "node:vm";
import { createHash, randomUUID } from "node:crypto";
import * as stub from "./phase2/vscode-stub";
import { ClineAdapter } from "../adapters/ClineAdapter";
import { CLINE_PIN } from "../adapters/ClineAdapterPolicy";

const policy = () => require("../adapters/ClineAdapterPolicy") as any;
const statePath = (file: string) => file.endsWith(path.join(".cline", "data", "globalState.json"));
const prerequisites = { hooksEnabled: true, optOutOfRemoteConfig: true, planModeApiProvider: "openai", actModeApiProvider: "openai",
    planModeOpenAiModelId: "fixture", actModeOpenAiModelId: "fixture", mode: "act" };

test("legacy Cline route policy allows only an absent or blank own data field", () => {
    const supported = policy().clineLegacyRouteSupported;
    assert.equal(typeof supported, "function");
    for (const state of [{}, { openAiBaseUrl: "" }, { openAiBaseUrl: " \t " }]) assert.equal(supported(state), true);
    for (const value of ["http://127.0.0.1:49011/v1", "https://fixture.invalid/v1", 7, null, {}, [], false, undefined]) {
        assert.equal(supported({ openAiBaseUrl: value }), false);
    }
    let reads = 0;
    assert.equal(supported(Object.defineProperty({}, "openAiBaseUrl", { get() { reads++; return "private"; } })), false);
    assert.equal(reads, 0);
    assert.equal(supported(new Proxy({}, {})), false);
    assert.equal(supported(Object.create({ openAiBaseUrl: "http://127.0.0.1:49011/v1" })), false);
});

for (const [label, value] of [["nonempty", "http://127.0.0.1:49011/v1"], ["number", 7], ["null", null], ["object", {}], ["array", []], ["boolean", false]] as const) {
    test(`legacy ${label} route refuses configuration before broker start or config writes`, async t => {
        stub.resetState("D:\\synthetic-cline-route-project");
        const context = stub.makeExtensionContext("D:\\synthetic-cline-route-storage");
        let starts = 0, writes = 0;
        const adapter = new ClineAdapter(context as never, {
            start: async () => { starts++; return { running: false }; },
            ownedSnapshot: () => ({ state: "stopped" }),
        } as never, { isEnabled: () => true } as never);
        t.after(() => adapter.dispose());
        t.mock.method(adapter as any, "artifact", async () => CLINE_PIN);
        t.mock.method(adapter as any, "read", async (file: string) => {
            assert.ok(statePath(file), "Only the synthetic global-state fixture may be read");
            return JSON.stringify({ ...prerequisites, openAiBaseUrl: value });
        });
        t.mock.method(adapter as any, "write", async () => { writes++; });
        assert.deepEqual(await adapter.configure(), { status: "CLINE_LEGACY_ROUTE_OVERRIDE_UNSUPPORTED" });
        assert.equal(starts, 0); assert.equal(writes, 0);
    });
}

// Public function contract, not extension activation or provider traffic.
test("pinned Cline 4.1.26 prefers cached legacy route over a newly written provider route", t => {
    const file = process.env.SOTERAI_CLINE_RUNTIME_FIXTURE;
    if (!file || !fs.existsSync(file)) { t.skip("Explicit isolated public Cline 4.1.26 runtime fixture required"); return; }
    const bytes = fs.readFileSync(file);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), CLINE_PIN.runtimeSha256);
    const source = bytes.toString("utf8");
    const extract = (name: string) => {
        const start = source.indexOf("function " + name + "("), end = source.indexOf("function ", start + 9);
        assert.ok(start >= 0 && end > start); return source.slice(start, end);
    };
    const oldRoute = "http://127.0.0.1:49011/v1", managedRoute = "http://127.0.0.1:49012/v1/ai/openai-compatible";
    let reads = 0;
    const context: any = { Sg: () => "openai-compatible", INe: () => "openai-compatible",
        Qd: () => ({ getProviderSettings: () => { reads++; return { baseUrl: managedRoute }; } }), Re: { warn: () => {} } };
    vm.runInNewContext(extract("sDu") + extract("sAi"), context, { timeout: 1000 });
    assert.equal(context.sAi("openai", { openAiBaseUrl: oldRoute }), oldRoute);
    assert.equal(reads, 0);
    assert.equal(context.sAi("openai", {}), managedRoute);
    assert.equal(reads, 1);
    // The pinned normalizer trims the legacy URL before testing its presence.
    assert.equal(context.sAi("openai", { openAiBaseUrl: " \t " }), managedRoute);
    assert.equal(reads, 2);
});

async function configuredFixture(t: any) {
    const root = await mkdtemp(path.join(tmpdir(), "soterai-cline-route-"));
    const project = path.join(root, "project"), profile = path.join(root, "profile");
    await mkdir(project); await mkdir(profile); stub.resetState(project);
    const context = stub.makeExtensionContext(profile);
    let session = randomUUID(), starts = 0, confirmations = 0, vendorVersion = CLINE_PIN.version, stopped = false;
    let admission: (() => Promise<boolean>) | undefined;
    let state = JSON.stringify(prerequisites);
    const paths = { providers: path.join(profile, "providers.json"), mcp: path.join(profile, "mcp.json"), globals: path.join(profile, "globals.json"),
        hook: path.join(project, ".clinerules/hooks/PreToolUse.ps1"), taskHook: path.join(project, ".clinerules/hooks/TaskStart.ps1") };
    await writeFile(paths.providers, JSON.stringify({ version: 1, modes: {}, providers: { "openai-compatible": { settings: { provider: "openai-compatible", model: "fixture", apiKey: "TEST_ONLY_OLD_PROVIDER" } } } }));
    await writeFile(paths.mcp, '{"mcpServers":{}}'); await writeFile(paths.globals, '{}');
    const manager = {
        start: async () => { starts++; return { running: true, url: "http://127.0.0.1:12345" }; },
        ownedSnapshot: () => ({ state: stopped ? "stopped" : "healthy", session, port: 12345 }),
        getClientToken: async () => "TEST_ONLY_CURRENT_SESSION_TOKEN",
        registerGatewayAdmissionGuard: (_id: string, check: () => Promise<boolean>) => { admission = check; return { dispose: () => { admission = undefined; } }; },
        stop: async () => { stopped = true; },
    };
    const adapter = new ClineAdapter(context as never, manager as never, { isEnabled: () => true } as never);
    t.after(() => adapter.dispose());
    t.mock.method(adapter as any, "artifact", async () => CLINE_PIN);
    t.mock.method(stub.extensions as any, "getExtension", () => ({ packageJSON: { version: vendorVersion } }));
    t.mock.method(adapter as any, "paths", () => paths);
    const originalRead = (adapter as any).read.bind(adapter);
    t.mock.method(adapter as any, "read", async (file: string) => {
        if (statePath(file)) return state;
        assert.ok(path.resolve(file).startsWith(root + path.sep), "Real profile reads are forbidden");
        return originalRead(file);
    });
    t.mock.method(stub.window, "showWarningMessage", async (_message: string, _options: unknown, ...actions: string[]) => {
        confirmations++; return actions.find(action => action === "Apply reviewed Cline changes");
    });
    assert.equal((await adapter.configure() as { status: string }).status, "APPLIED");
    const snapshot = async () => ({ files: await Promise.all(Object.values(paths).map(file => readFile(file, "utf8"))),
        backups: (await readdir(path.join(context.globalStorageUri.fsPath, "config-backups"))).sort(),
        receipt: JSON.stringify(context.globalState.get("soterai.lite.clineAdapter.receipt.v1")) });
    return { adapter, context, manager, paths, snapshot, admission: () => admission?.(), counts: () => ({ starts, confirmations }), changeSession: () => { session = randomUUID(); },
        changeVersion: () => { vendorVersion = "4.1.25"; },
        changeSelection: (patch: object) => { state = JSON.stringify({ ...prerequisites, ...patch }); },
        setLegacyRoute: () => { state = JSON.stringify({ ...prerequisites, openAiBaseUrl: "http://127.0.0.1:49011/v1" }); } };
}

for (const [name, patch] of [["provider fallback", { actModeApiProvider: "cline" }], ["inactive provider", { planModeApiProvider: "anthropic" }],
    ["model", { planModeOpenAiModelId: "changed", actModeOpenAiModelId: "changed" }], ["mode", { mode: "plan" }]] as const) {
    test(`a ${name} change withdraws the current managed session`, async t => {
        const fixture = await configuredFixture(t), before = await fixture.snapshot();
        fixture.changeSelection(patch);
        assert.equal(await fixture.admission(), false);
        assert.equal((fixture.adapter.status() as { status: string }).status, "UNAVAILABLE");
        assert.equal((fixture.adapter.status() as { sessionState: string }).sessionState, "WITHDRAWN");
        assert.equal(fixture.manager.ownedSnapshot().state, "stopped");
        fixture.changeSelection({});
        assert.equal((await fixture.adapter.configure() as { status: string }).status, "CLINE_RESTORE_REQUIRED");
        assert.deepEqual(await fixture.snapshot(), before);
    });
}

test("selection changes while owned files are checked withhold admission", async t => {
    const fixture = await configuredFixture(t);
    const read = (fixture.adapter as any).read.bind(fixture.adapter);
    t.mock.method(fixture.adapter as any, "read", async (file: string) => {
        const result = await read(file);
        if (file === fixture.paths.providers) fixture.changeSelection({ mode: "plan" });
        return result;
    });
    assert.equal(await fixture.admission(), false);
    assert.equal((fixture.adapter.status() as { reason: string }).reason, "CLINE_SELECTION_CHANGED");
});

test("repeat configure preserves an unchanged current session and its original recovery receipt", async t => {
    const fixture = await configuredFixture(t), before = await fixture.snapshot();
    assert.equal((await fixture.adapter.configure() as { status: string }).status, "ALREADY_CONFIGURED");
    assert.notEqual((fixture.adapter.status() as { status: string }).status, "UNAVAILABLE");
    assert.deepEqual(await fixture.snapshot(), before);
    assert.deepEqual(fixture.counts(), { starts: 1, confirmations: 1 });
});

test("expired session configuration is refused without replacing prior owned files or recovery receipt", async t => {
    const fixture = await configuredFixture(t), before = await fixture.snapshot(); fixture.changeSession();
    assert.equal((await fixture.adapter.configure() as { status: string }).status, "CLINE_RESTORE_REQUIRED");
    assert.deepEqual(await fixture.snapshot(), before);
    assert.deepEqual(fixture.counts(), { starts: 1, confirmations: 1 });
});

test("changed owned configuration refuses a refresh and retains recovery evidence", async t => {
    const fixture = await configuredFixture(t);
    await writeFile(fixture.paths.providers, (await readFile(fixture.paths.providers, "utf8")) + " ");
    const before = await fixture.snapshot();
    assert.equal((await fixture.adapter.configure() as { status: string }).status, "CLINE_RESTORE_REQUIRED");
    assert.deepEqual(await fixture.snapshot(), before);
    assert.deepEqual(fixture.counts(), { starts: 1, confirmations: 1 });
});

test("legacy route changes revoke eligibility for an established session", async t => {
    const fixture = await configuredFixture(t), before = await fixture.snapshot(); fixture.setLegacyRoute();
    assert.equal(await (fixture.adapter as any).eligible(), false);
    assert.equal(await (fixture.adapter as any).configuredFiles(fixture.paths, () => true), false);
    assert.equal((await fixture.adapter.configure() as { status: string }).status, "CLINE_LEGACY_ROUTE_OVERRIDE_UNSUPPORTED");
    assert.equal((fixture.adapter.status() as { status: string }).status, "UNAVAILABLE");
    assert.deepEqual(await fixture.snapshot(), before);
    assert.deepEqual(fixture.counts(), { starts: 1, confirmations: 1 });
});

test("a new adapter instance requires reviewed restoration of an old managed configuration", async t => {
    const fixture = await configuredFixture(t), before = await fixture.snapshot();
    fixture.adapter.dispose();
    const next = new ClineAdapter(fixture.context as never, fixture.manager as never, { isEnabled: () => true } as never);
    t.after(() => next.dispose());
    t.mock.method(next as any, "artifact", async () => CLINE_PIN);
    t.mock.method(next as any, "prerequisiteStatus", async () => "READY");
    t.mock.method(next as any, "paths", () => fixture.paths);
    assert.equal((await next.configure() as { status: string }).status, "CLINE_RESTORE_REQUIRED");
    assert.deepEqual(await fixture.snapshot(), before);
    assert.deepEqual(fixture.counts(), { starts: 1, confirmations: 1 });
});

test("vendor version changes cannot reuse an existing managed lease", async t => {
    const fixture = await configuredFixture(t), before = await fixture.snapshot(); fixture.changeVersion();
    assert.equal((await fixture.adapter.configure() as { status: string }).status, "CLINE_RESTORE_REQUIRED");
    assert.deepEqual(await fixture.snapshot(), before);
    assert.deepEqual(fixture.counts(), { starts: 1, confirmations: 1 });
});

test("a later profile override cannot refresh or overwrite a current session", async t => {
    const fixture = await configuredFixture(t), before = await fixture.snapshot(), prior = process.env.CLINE_DATA_DIR;
    process.env.CLINE_DATA_DIR = "D:\\synthetic-other-cline-profile";
    t.after(() => { if (prior === undefined) delete process.env.CLINE_DATA_DIR; else process.env.CLINE_DATA_DIR = prior; });
    assert.equal((await fixture.adapter.configure() as { status: string }).status, "CLINE_DEFAULT_PROFILE_REQUIRED");
    assert.deepEqual(await fixture.snapshot(), before);
    assert.deepEqual(fixture.counts(), { starts: 1, confirmations: 1 });
});
