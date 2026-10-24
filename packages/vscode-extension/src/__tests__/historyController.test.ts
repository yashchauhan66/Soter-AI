import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import * as stub from "./phase2/vscode-stub";
import { initializeBoundaryState, updateRules } from "../ai-boundary/BoundarySnapshot";
import { HygieneExposureLedger, HYGIENE_LEDGER_KEY } from "../hygiene/HygieneExposureLedger";
import { HistoryGitProcess, type HistoryGitOperation, type HistoryGitOutcome } from "../history/HistoryGitProcess";

// F23 controller test-first owner/lifecycle controls. The only repository on
// disk is manually constructed synthetic metadata. Git children are never run;
// per-kind private protocol results come from the mocked process start method.
const PRIVATE = "TEST_ONLY_F23_CONTROLLER_PRIVATE_84da91e6";
const TEXT = "PASSWORD=" + PRIVATE + "\nPORT=3000\n";
const BODY = Buffer.from(TEXT);
const OBJECT = createHash("sha1").update("blob " + BODY.length + "\0").update(BODY).digest("hex");
const COMMIT = "b".repeat(40);
const CONFIG = "[core]\n repositoryformatversion = 0\n bare = false\n";
const ACTION = "Analyze local Git history";
type Controller = { review(): Promise<any>; status(): { status: string; busy: boolean; scope: string }; current(value: unknown): boolean; withdraw(): void; dispose(): void };
type Constructor = new (context: unknown, options?: { now?: () => number }) => Controller;
const tick = async () => { await new Promise<void>(done => setImmediate(done)); };
const safe = (value: unknown) => {
    const text = JSON.stringify(value) ?? "";
    for (const denied of [PRIVATE, "PASSWORD", "private-history-source.env", ".env"])
        assert(!text.includes(denied));
};
function gate<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => resolve = done); return { promise, resolve }; }

async function fixture(t: TestContext, options: { now?: () => number } = {}) {
    const module = await import("../history/HistoryController"); assert.equal(typeof module.HistoryController, "function");
    const base = await mkdtemp(join(tmpdir(), "soter-f23-controller-")), root = join(base, "project"), profile = join(base, "profile");
    await mkdir(join(root, ".git", "objects", "info"), { recursive: true }); await mkdir(join(root, ".git", "objects", "pack"), { recursive: true });
    await mkdir(join(root, ".git", "refs", "heads"), { recursive: true }); await mkdir(profile);
    await writeFile(join(root, ".git", "config"), CONFIG, { flag: "wx" }); await writeFile(join(root, ".git", "HEAD"), "ref: refs/heads/main\n", { flag: "wx" });
    await writeFile(join(root, ".git", "refs", "heads", "main"), COMMIT + "\n", { flag: "wx" });
    stub.resetState(root); const context = stub.makeExtensionContext(profile); context.globalStorageUri = stub.Uri.file(profile);
    initializeBoundaryState(context.workspaceState as never);
    const secretEvents = new stub.EventEmitter<{ key: string }>(), configEvents = new stub.EventEmitter<{ affectsConfiguration(name: string): boolean }>();
    context.secrets.onDidChange = secretEvents.event as never;
    t.mock.method(stub.workspace, "onDidChangeConfiguration", configEvents.event);
    let opened = 0;
    t.mock.method(stub.workspace, "openTextDocument", async () => { opened++; throw Error(PRIVATE); });
    const controller = new (module.HistoryController as unknown as Constructor)(context, options);
    const calls: HistoryGitOperation[] = [];
    let hook: ((operation: HistoryGitOperation) => void | Promise<void>) | undefined;
    let outcomeOverride: ((operation: HistoryGitOperation, process: HistoryGitProcess) => HistoryGitOutcome | Promise<HistoryGitOutcome> | undefined) | undefined;
    t.mock.method(HistoryGitProcess.prototype, "start", async function (this: HistoryGitProcess): Promise<HistoryGitOutcome> {
        const operation = (this as unknown as { options: { operation: HistoryGitOperation } }).options.operation;
        Object.defineProperty(this, "closed", { configurable: true, value: Promise.resolve() }); calls.push(operation);
        const custom = await outcomeOverride?.(operation, this); if (custom) return custom;
        if (hook) await hook(operation);
        if (operation.kind === "version") return { status: "COMPLETE", bytes: Buffer.from("git version 2.53.0.windows.1\n") };
        if (operation.kind === "commits") return { status: "COMPLETE", bytes: Buffer.from(COMMIT + "\n") };
        if (operation.kind === "tree") { assert.equal(operation.oid, COMMIT); return { status: "COMPLETE", bytes: Buffer.from("100644 blob " + OBJECT + " " + BODY.length + "\t.env\0") }; }
        assert.equal(operation.kind, "batch"); assert.deepEqual(operation.objects, [{ oid: OBJECT, size: BODY.length }]);
        return { status: "COMPLETE", bytes: Buffer.concat([Buffer.from(OBJECT + " blob " + BODY.length + "\n"), BODY, Buffer.from("\n")]) };
    });
    const ledger = new HygieneExposureLedger(context.globalState, context.secrets), rootUri = stub.Uri.file(root).toString();
    t.after(() => { controller.dispose(); secretEvents.dispose(); configEvents.dispose(); context.subscriptions.forEach(disposable => disposable.dispose()); });
    return { controller, context, root, profile, calls, ledger, rootUri, secretEvents, configEvents, opened: () => opened,
        hook(value: typeof hook) { hook = value; }, outcome(value: typeof outcomeOverride) { outcomeOverride = value; } };
}
function approve(t: TestContext) {
    return t.mock.method(stub.window, "showWarningMessage", async (message: string, details: unknown, action: string) => {
        safe([message, details]); assert.equal(action, ACTION); return action;
    });
}
async function noFindings(f: Awaited<ReturnType<typeof fixture>>) {
    const view = await f.ledger.view(f.rootUri); assert.deepEqual(view.rows, []); safe(view);
}

test("F23 controller construction/status has no history process, source open or analyzer-key side effect", async t => {
    const f = await fixture(t), status = f.controller.status(); assert.equal(status.status, "OWNER_REVIEW_REQUIRED"); assert.equal(status.busy, false); safe(status);
    assert.equal(f.calls.length, 0); assert.equal(f.opened(), 0); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined);
    assert.equal(f.controller.current({ status: "ANALYZED", findings: [] }), false); assert.equal(f.controller.current(undefined), false);
});

test("F23 native review cancellation precedes history processes and analyzer-key creation", async t => {
    const f = await fixture(t); t.mock.method(stub.window, "showWarningMessage", async () => undefined);
    const result = await f.controller.review(); assert.equal(result.status, "CANCELLED"); assert.equal(f.controller.current(result), false); safe(result);
    assert.equal(f.calls.length, 0); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined); assert.equal(f.opened(), 0); await noFindings(f);
});

test("F23 approved history analysis publishes only exact current keyed metadata and shared possible-exposure rows", async t => {
    const f = await fixture(t); approve(t); const result = await f.controller.review(); assert.equal(result.status, "ANALYZED"); assert.equal(result.findings.length, 1); safe(result);
    assert.deepEqual(f.calls.map(operation => operation.kind), ["version", "commits", "tree", "batch"]);
    assert.equal(f.controller.current(result), true); assert.equal(f.controller.current({ ...result }), false); assert.equal(f.controller.current(JSON.parse(JSON.stringify(result))), false);
    for (const field of ["id", "fileRef", "valueRef"]) assert.match(result.findings[0][field], /^[a-f0-9]{64}$/);
    assert.deepEqual(result.findings[0].suggestions, ["rotation-checklist"]);
    const view = await f.ledger.view(f.rootUri); assert.equal(view.rows.length, 1); assert.equal(view.rows[0].lastAction, "possible-project-exposure"); safe(view);
    safe([...f.context._inspect.globalStore]); assert.equal(f.opened(), 0); assert.equal(await f.context.secrets.get("soterai.vaultKey"), undefined);
    assert.equal(typeof await f.context.secrets.get(HYGIENE_LEDGER_KEY), "string");
});

test("F23 readonly history review preserves synthetic metadata and works with vaultMode disabled", async t => {
    const f = await fixture(t); approve(t); stub.state.configInspect.set("soterai.lite.vaultMode", { globalValue: false });
    const names = ["config", "HEAD", "refs/heads/main"], before = await Promise.all(names.map(name => readFile(join(f.root, ".git", name))));
    const result = await f.controller.review(); assert.equal(result.status, "ANALYZED");
    assert.deepEqual(await Promise.all(names.map(name => readFile(join(f.root, ".git", name)))), before);
    assert.equal(await f.context.secrets.get("soterai.vaultKey"), undefined); safe(result);
});

test("F23 machine history/hygiene flags are strict and repository settings cannot enable either", async t => {
    const f = await fixture(t); approve(t);
    for (const name of ["soterai.lite.historyScanner", "soterai.lite.hygieneAssistant"]) {
        for (const value of [false, "true"]) {
            stub.state.configInspect.set(name, { defaultValue: true, globalValue: value, workspaceValue: true });
            const result = await f.controller.review(); assert.equal(result.status, "UNAVAILABLE"); assert.equal(f.controller.current(result), false); safe(result);
        }
        stub.state.configInspect.delete(name);
    }
    assert.equal(f.calls.length, 0); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined);
});

test("F23 untrusted and multi-root reviews refuse before key or history authority", async t => {
    const f = await fixture(t); approve(t); stub.state.isTrusted = false; assert.equal((await f.controller.review()).status, "UNAVAILABLE");
    stub.state.isTrusted = true; stub.state.folders.push({ uri: stub.Uri.file(f.profile), index: 1, name: "second synthetic root" });
    assert.equal((await f.controller.review()).status, "UNAVAILABLE"); assert.equal(f.calls.length, 0); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined);
});

test("F23 a flag withdrawal event during owner approval stays revoked after the flag is reenabled", async t => {
    const f = await fixture(t); t.mock.method(stub.window, "showWarningMessage", async () => {
        stub.state.configInspect.set("soterai.lite.historyScanner", { globalValue: false }); f.configEvents.fire({ affectsConfiguration: () => true });
        stub.state.configInspect.set("soterai.lite.historyScanner", { globalValue: true }); return ACTION;
    });
    const result = await f.controller.review(); assert.equal(result.status, "UNAVAILABLE"); assert.equal(f.calls.length, 0); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined); safe(result);
});

test("F23 actual owner-policy drift while approval is pending cannot authorize history reads", async t => {
    const f = await fixture(t); t.mock.method(stub.window, "showWarningMessage", async () => {
        await updateRules(f.rootUri, rules => ({ ...rules, paths: [...rules.paths, { kind: "file", pattern: "synthetic-public.txt" }] })); return ACTION;
    });
    const result = await f.controller.review(); assert.notEqual(result.status, "ANALYZED"); assert.equal(f.calls.length, 0); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined); safe(result);
});

test("F23 machine withdrawal after a completed private await stops subsequent tree/body operations", async t => {
    const f = await fixture(t); approve(t); f.hook(operation => { if (operation.kind === "commits") stub.state.configInspect.set("soterai.lite.historyScanner", { globalValue: false }); });
    const result = await f.controller.review(); assert.equal(result.status, "UNAVAILABLE"); assert.deepEqual(f.calls.map(operation => operation.kind), ["version", "commits"]); safe(result); await noFindings(f);
});

test("F23 repository metadata drift during a private await cannot publish or persist mock history findings", async t => {
    const f = await fixture(t); approve(t); f.hook(async operation => { if (operation.kind === "commits") await writeFile(join(f.root, ".git", "HEAD"), "a".repeat(40) + "\n"); });
    const result = await f.controller.review(); assert.equal(result.status, "UNAVAILABLE"); assert(f.calls.length <= 2); assert.equal(f.controller.current(result), false); safe(result); await noFindings(f);
});

test("F23 late analyzer-key replacement discards the pending historical candidates", async t => {
    const f = await fixture(t); approve(t); f.hook(async operation => {
        if (operation.kind === "batch") { await f.context.secrets.store(HYGIENE_LEDGER_KEY, Buffer.alloc(32, 61).toString("base64")); f.secretEvents.fire({ key: HYGIENE_LEDGER_KEY }); await tick(); }
    });
    const result = await f.controller.review(); assert.equal(result.status, "UNAVAILABLE"); assert.equal(f.controller.current(result), false); safe(result); await noFindings(f);
});

test("F23 failed metadata persistence returns generic unavailable without exposing private errors", async t => {
    const f = await fixture(t); approve(t); t.mock.method(f.context.globalState, "update", async () => { throw Error(PRIVATE); });
    const result = await f.controller.review(); assert.equal(result.status, "UNAVAILABLE"); assert.equal(f.controller.current(result), false); safe(result); await noFindings(f);
});

test("F23 approval expiry and monotonic clock reversal suppress further authority", async t => {
    let time = 0; const f = await fixture(t, { now: () => time });
    t.mock.method(stub.window, "showWarningMessage", async () => { time = 60001; return ACTION; });
    const expired = await f.controller.review(); assert.equal(expired.status, "UNAVAILABLE"); assert.equal(f.calls.length, 0); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined); safe(expired);
    time = 1000; approve(t); f.hook(operation => { if (operation.kind === "version") time = 999; });
    const reversed = await f.controller.review(); assert.equal(reversed.status, "UNAVAILABLE"); assert.equal(f.calls.length, 1); safe(reversed); await noFindings(f);
});

test("F23 one pending native approval keeps controller busy and grants no early key or process", async t => {
    const f = await fixture(t), entered = gate<void>(), choice = gate<string>();
    t.mock.method(stub.window, "showWarningMessage", async () => { entered.resolve(); return choice.promise; });
    const pending = f.controller.review(); await entered.promise; assert.equal(f.controller.status().busy, true); assert.equal(f.calls.length, 0);
    assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined); assert.equal((await f.controller.review()).status, "UNAVAILABLE");
    choice.resolve(ACTION); assert.equal((await pending).status, "ANALYZED"); assert.equal(f.controller.status().busy, false);
});

test("F23 disposal while native consent is pending prevents late approval from starting work", async t => {
    const f = await fixture(t), entered = gate<void>(), choice = gate<string>();
    t.mock.method(stub.window, "showWarningMessage", async () => { entered.resolve(); return choice.promise; });
    const pending = f.controller.review(); await entered.promise; f.controller.dispose(); choice.resolve(ACTION);
    const result = await pending; assert.equal(result.status, "UNAVAILABLE"); assert.equal(f.controller.status().status, "UNAVAILABLE");
    assert.equal(f.calls.length, 0); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined); assert.equal(f.controller.current(result), false); safe(result);
});

test("F23 manual withdrawal before candidate publication suppresses ledger writes", async t => {
    const f = await fixture(t); approve(t); f.hook(operation => { if (operation.kind === "batch") f.controller.withdraw(); });
    const result = await f.controller.review(); assert.equal(result.status, "UNAVAILABLE"); assert.equal(f.controller.current(result), false); safe(result); await noFindings(f);
});

test("F23 STOP_UNCONFIRMED returns unavailable while retaining busy ownership until the process closes", async t => {
    const f = await fixture(t), close = gate<void>(); approve(t);
    f.outcome((_operation, process) => {
        let active = true; Object.defineProperty(process, "closed", { configurable: true, value: close.promise });
        Object.defineProperty(process, "busy", { configurable: true, get: () => active }); void close.promise.then(() => { active = false; });
        return { status: "STOP_UNCONFIRMED" };
    });
    const result = await f.controller.review(); assert.equal(result.status, "UNAVAILABLE"); assert.equal(f.controller.status().busy, true); assert.equal(f.controller.current(result), false); safe(result);
    assert.equal((await f.controller.review()).status, "UNAVAILABLE"); assert.equal(f.calls.length, 1); close.resolve(); await tick(); await tick();
    assert.equal(f.controller.status().busy, false); await noFindings(f);
});

test("F23 published result identity is withdrawn permanently by configuration events", async t => {
    const f = await fixture(t); approve(t); const result = await f.controller.review(); assert.equal(f.controller.current(result), true);
    stub.state.configInspect.set("soterai.lite.historyScanner", { globalValue: false }); f.configEvents.fire({ affectsConfiguration: () => true });
    assert.equal(f.controller.current(result), false); stub.state.configInspect.set("soterai.lite.historyScanner", { globalValue: true });
    assert.equal(f.controller.current(result), false); assert.equal((await f.ledger.view(f.rootUri)).rows.length, 1);
});

test("F23 observed key change suppresses published authority before asynchronous key validation resolves", async t => {
    const f = await fixture(t); approve(t); const result = await f.controller.review(); assert.equal(f.controller.current(result), true);
    const pending = gate<string | undefined>(), get = f.context.secrets.get.bind(f.context.secrets);
    t.mock.method(f.context.secrets, "get", async (name: string) => name === HYGIENE_LEDGER_KEY ? pending.promise : get(name));
    f.secretEvents.fire({ key: HYGIENE_LEDGER_KEY });
    assert.equal(f.controller.current(result), false);
    pending.resolve(Buffer.alloc(32, 62).toString("base64")); await tick(); await tick();
    assert.equal(f.controller.current(result), false);
});

test("F23 delayed same-key notification cannot revive the old publication after its synchronous withdrawal", async t => {
    const f = await fixture(t); approve(t); const result = await f.controller.review(); assert.equal(f.controller.current(result), true);
    const encoded = await f.context.secrets.get(HYGIENE_LEDGER_KEY), pending = gate<string | undefined>();
    t.mock.method(f.context.secrets, "get", async () => pending.promise);
    f.secretEvents.fire({ key: HYGIENE_LEDGER_KEY }); assert.equal(f.controller.current(result), false);
    pending.resolve(encoded); await tick(); await tick(); assert.equal(f.controller.current(result), false);
});
