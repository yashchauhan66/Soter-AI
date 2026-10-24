import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { beforeEach, afterEach, test } from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type * as vscode from "vscode";
import * as stub from "./phase2/vscode-stub";
import { initializeBoundaryState, BoundarySnapshot, updateRules } from "../ai-boundary/BoundarySnapshot";
import { StreamingOutputRedactor, type OutputResult } from "../../../core/src/StreamingOutputRedactor";
import type { AccessResult } from "../project-privacy/ProjectFileAccess";

const PRIVATE = "synthetic-f10-session-secret-9qM42";
const withheld = (result: OutputResult) => { assert.equal(result.status, "WITHHELD"); assert.equal(result.stdout, ""); assert.equal(result.stderr, ""); };
let root: string, context: ReturnType<typeof stub.makeExtensionContext>, sessions: { dispose(): void }[];
beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "soterai-f10-session-")); await writeFile(join(root, "note.txt"), "source public\n");
    await writeFile(join(root, ".env"), "API_KEY=" + PRIVATE + "\n");
    stub.resetState(root); context = stub.makeExtensionContext(root); initializeBoundaryState(context.workspaceState as never); await BoundarySnapshot.load(); sessions = [];
});
afterEach(() => { sessions.forEach(session => session.dispose()); context.subscriptions.forEach(d => d.dispose()); });
async function fixture() {
    const { CheckedPowerShellSession } = await import("../terminal/CheckedPowerShellSession");
    const calls = { reads: [] as string[], filters: 0, workers: [] as Record<string, any>[], revokes: 0, copies: 0 };
    let enabled = true, approveCopy = true, response: AccessResult = { status: "ALLOWED_ONCE", kind: "redacted-file", text: "first\nsecond\nthird\n" };
    let duringRead: (() => Promise<void>) | undefined, duringFilter: (() => Promise<void>) | undefined, duringCopy: (() => Promise<void>) | undefined;
    const session = new CheckedPowerShellSession({ root: stub.Uri.file(root) as unknown as vscode.Uri,
        reader: { read: async (uri: vscode.Uri) => { calls.reads.push(uri.fsPath); await duringRead?.(); return response; }, revoke: () => { calls.revokes++; }, isEnabled: () => enabled },
        vault: { createManagedOutputFilter: async (_root: vscode.Uri, guard: () => boolean) => {
            calls.filters++; await duringFilter?.(); const filter = new StreamingOutputRedactor([PRIVATE], { enabled: guard });
            return Object.assign(filter, { available: guard, canRelease: guard });
        } }, enabled: () => enabled,
        parentEnvironment: { SystemRoot: "C:\\Windows", LANG: "C", OPENAI_API_KEY: PRIVATE, PATH: PRIVATE },
    }, { createWorker: (options: Record<string, any>) => {
        calls.workers.push(options); let cancelled = false;
        return { start: async () => ({ id: options.id, state: "RUNNING" }), snapshot: () => ({ id: options.id, state: cancelled ? "CANCELLED" : "EXITED" }),
            cancel: () => { cancelled = true; options.output.cancel(); }, dispose: () => { cancelled = true; options.output.cancel(); },
            completion: Promise.resolve().then(() => { options.output.push("stdout", Buffer.from("public result\n")); return { snapshot: { id: options.id, state: "EXITED", exitCode: 0 }, output: options.output.finish(0) }; }),
        } as never;
    }, reviewCopy: async () => { calls.copies++; await duringCopy?.(); return approveCopy; } });
    sessions.push(session);
    return { session, calls, set enabled(value: boolean) { enabled = value; }, set approveCopy(value: boolean) { approveCopy = value; },
        set response(value: AccessResult) { response = value; }, set duringRead(value: (() => Promise<void>) | undefined) { duringRead = value; },
        set duringFilter(value: (() => Promise<void>) | undefined) { duringFilter = value; }, set duringCopy(value: (() => Promise<void>) | undefined) { duringCopy = value; } };
}
test("F10-D01 unsupported whole input never reaches a reader, worker, filter or destination review", async () => {
    const f = await fixture(); for (const input of ["Get-Date; Get-Content .env", "node -e 'printenv'", "git show HEAD:.env", "git diff", "cat ../outside", "echo 'unterminated", null]) withheld(await f.session.execute(input));
    assert.deepEqual(f.calls, { reads: [], workers: [], filters: 0, revokes: 0, copies: 0 });
});
test("F10-D02 public operation uses the fixed worker with a filtered private output sink", async () => {
    const f = await fixture(), result = await f.session.execute("Get-Date"); assert.equal(result.stdout, "public result\n"); assert.equal(f.calls.workers.length, 1);
    assert.deepEqual(f.calls.workers[0].operation, { kind: "PUBLIC", action: "date", args: [] }); assert.equal(f.calls.reads.length, 0);
});
test("F10-D03 protected file is routed through the trusted reader and never forwarded to a worker", async () => {
    const f = await fixture(); f.response = { status: "ALLOWED_ONCE", kind: "environment-schema", text: "API_KEY=[MASKED]\n" };
    const result = await f.session.execute("Get-Content .env"); assert.equal(result.stdout, "API_KEY=[MASKED]\n"); assert.deepEqual(f.calls.reads, [join(root, ".env")]); assert.equal(f.calls.workers.length, 0);
});
test("F10-D04 denied approval releases no result and never creates an output filter", async () => {
    const f = await fixture(); f.response = { status: "DENIED" }; withheld(await f.session.execute("cat note.txt")); assert.equal(f.calls.filters, 0);
});
test("F10-D05 head tail and literal search transform only approved safe text", async () => {
    const f = await fixture();
    assert.equal((await f.session.execute("head -n 1 note.txt")).stdout, "first\n");
    assert.equal((await f.session.execute("tail -n 1 note.txt")).stdout, "third\n");
    assert.equal((await f.session.execute("grep second note.txt")).stdout, "second\n");
    assert.equal((await f.session.execute("rg '.*' note.txt")).stdout, "");
    assert.equal(f.calls.reads.length, 4); assert.equal(f.calls.workers.length, 0);
});
test("F10-D06 registered output is masked even if an internal reader accidentally returns a value", async () => {
    const f = await fixture(); f.response = { status: "ALLOWED_ONCE", kind: "redacted-file", text: PRIVATE };
    const result = await f.session.execute("cat note.txt"); assert.equal(result.status, "COMPLETE"); assert.equal(result.stdout, "[REDACTED_SECRET_OUTPUT]");
});
test("F10-D07 env lists only minimal child-base names with masks", async () => {
    const f = await fixture(), result = await f.session.execute("env"); assert.ok(result.stdout.includes("SystemRoot=[MASKED]")); assert.ok(result.stdout.includes("LANG=[MASKED]"));
    assert.ok(!result.stdout.includes("Windows")); assert.ok(!result.stdout.includes("OPENAI_API_KEY")); assert.ok(!result.stdout.includes(PRIVATE));
    assert.equal((await f.session.execute("printenv OPENAI_API_KEY")).stdout, ""); assert.equal(f.calls.reads.length, 0); assert.equal(f.calls.workers.length, 0);
});
test("F10-D08 copy reviews the new destination then writes only finalized filtered safe text", async () => {
    const f = await fixture(); let reviewed = false; f.duringCopy = async () => { reviewed = true; }; f.duringRead = async () => { assert.ok(reviewed); };
    f.response = { status: "ALLOWED_ONCE", kind: "environment-schema", text: "API_KEY=[MASKED]\n" };
    assert.equal((await f.session.execute("copy .env safe-copy.txt")).status, "COMPLETE"); assert.equal(await readFile(join(root, "safe-copy.txt"), "utf8"), "API_KEY=[MASKED]\n"); assert.equal(f.calls.copies, 1);
});
test("F10-D09 declined destination review starts no source read and creates no destination", async () => {
    const f = await fixture(); f.approveCopy = false; withheld(await f.session.execute("copy note.txt declined.txt")); assert.equal(f.calls.reads.length, 0);
    await assert.rejects(readFile(join(root, "declined.txt")), { code: "ENOENT" });
});
test("F10-D10 copy never overwrites an existing destination", async () => {
    const f = await fixture(); await writeFile(join(root, "exists.txt"), "owner data"); withheld(await f.session.execute("copy note.txt exists.txt")); assert.equal(await readFile(join(root, "exists.txt"), "utf8"), "owner data");
});
test("F10-D11 copy refuses policy and sensitive destinations", async () => {
    const f = await fixture(); await mkdir(join(root, ".soterai"));
    for (const destination of [".soterai/policy.json", ".aiignore", ".env.copy"]) withheld(await f.session.execute("copy note.txt " + destination));
    assert.equal(f.calls.reads.length, 0);
});
test("F10-D12 source change while approval is pending withholds the old view", async () => {
    const f = await fixture(); f.duringRead = async () => { await writeFile(join(root, "note.txt"), "changed source data\n"); };
    withheld(await f.session.execute("cat note.txt")); assert.equal(f.calls.filters, 0);
});
test("F10-D13 cancellation during pending read is sticky after the reader resolves", async () => {
    const f = await fixture(); f.duringRead = async () => { f.session.cancel(); }; withheld(await f.session.execute("cat note.txt")); assert.ok(f.calls.revokes > 0);
});
test("F10-D14 feature withdrawal during output acquisition withholds result and copy", async () => {
    const f = await fixture(); f.duringFilter = async () => { f.enabled = false; };
    withheld(await f.session.execute("copy note.txt withdrawn.txt")); await assert.rejects(readFile(join(root, "withdrawn.txt")), { code: "ENOENT" });
});
test("F10-D15 one session refuses a second pending command without extra approvals", async () => {
    const f = await fixture(); let release!: () => void, entered!: () => void;
    const held = new Promise<void>(done => { release = done; }), arrival = new Promise<void>(done => { entered = done; });
    f.duringRead = async () => { entered(); await held; }; const first = f.session.execute("cat note.txt"); await arrival;
    try { withheld(await f.session.execute("cat .env")); assert.equal(f.calls.reads.length, 1); assert.equal(f.session.snapshot().state, "BUSY"); }
    finally { release(); await first; } assert.equal(f.session.snapshot().state, "IDLE");
});
test("F10-D16 closed session stays unavailable and exposes no previous arguments or result", async () => {
    const f = await fixture(); f.session.dispose(); withheld(await f.session.execute("echo '" + PRIVATE + "'")); assert.equal(f.calls.workers.length, 0);
    assert.equal(f.session.snapshot().state, "CLOSED"); assert.ok(!JSON.stringify(f.session).includes(PRIVATE)); assert.ok(!JSON.stringify(f.session.snapshot()).includes(PRIVATE));
});
test("F10-D17 normal directory listing dispatches while protected directory listing is withheld", async () => {
    const f = await fixture(); await mkdir(join(root, "public")); assert.equal((await f.session.execute("ls public")).status, "COMPLETE");
    await updateRules(stub.Uri.file(root).toString(), rules => ({ ...rules, paths: [...rules.paths, { kind: "folder", pattern: "public" }] }));
    withheld(await f.session.execute("ls public")); assert.equal(f.calls.workers.length, 1);
});
test("F10-D18 junction directory cannot route a listing outside the project", { skip: process.platform !== "win32" }, async () => {
    const f = await fixture(), outside = await mkdtemp(join(tmpdir(), "soterai-f10-outside-")); await writeFile(join(outside, "outside-name.txt"), "public synthetic");
    await symlink(outside, join(root, "linked"), "junction"); withheld(await f.session.execute("ls linked")); assert.equal(f.calls.workers.length, 0);
});
test("F10-D19 parent alias cannot receive a safe copy", { skip: process.platform !== "win32" }, async () => {
    const f = await fixture(), outside = await mkdtemp(join(tmpdir(), "soterai-f10-copy-outside-")); await symlink(outside, join(root, "linked"), "junction");
    withheld(await f.session.execute("copy note.txt linked/copy.txt")); await assert.rejects(readFile(join(outside, "copy.txt")), { code: "ENOENT" });
});
test("F10-D20 actual finite worker releases output after its single-use private filter completes", { skip: process.platform !== "win32", timeout: 8000 }, async () => {
    const { CheckedPowerShellSession } = await import("../terminal/CheckedPowerShellSession");
    const { ManagedOutputFilter } = await import("../terminal/ManagedOutputFilter");
    const session = new CheckedPowerShellSession({ root: stub.Uri.file(root) as unknown as vscode.Uri,
        reader: { read: async () => ({ status: "DENIED" }), revoke() {}, isEnabled: () => true },
        vault: { createManagedOutputFilter: async (_uri, enabled) => new ManagedOutputFilter([PRIVATE], enabled) },
        enabled: () => true, parentEnvironment: { SystemRoot: "C:\\Windows", WINDIR: "C:\\Windows", TEMP: tmpdir(), TMP: tmpdir() } });
    sessions.push(session); const result = await session.execute("version"); assert.equal(result.status, "COMPLETE"); assert.match(result.stdout.trim(), /^5\.1(?:\.|$)/);
});
