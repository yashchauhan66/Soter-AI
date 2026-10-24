import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { mkdtemp, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type * as vscode from "vscode";
import * as stub from "./phase2/vscode-stub";
import { BoundarySnapshot, initializeBoundaryState, updateRules, RULES_KEY } from "../ai-boundary/BoundarySnapshot";
import { CheckedPowerShellSession } from "../terminal/CheckedPowerShellSession";
import { ManagedOutputFilter } from "../terminal/ManagedOutputFilter";
import type { PowerShell51Completion, PowerShell51Snapshot } from "../terminal/PowerShell51Worker";

// Frozen F10-only root metadata controls. No actual directory enumeration,
// file-content reader, policy-probe read or child/native process is performed.
const NAMES = "public.txt\n.env\n";
const PRIVATE = "synthetic-f10-directory-output-registry-canary-yX92";
let root: string, context: ReturnType<typeof stub.makeExtensionContext>, sessions: CheckedPowerShellSession[];
beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "soterai-f10-root-listing-")); await mkdir(join(root, "public"));
    stub.resetState(root); context = stub.makeExtensionContext(root);
    initializeBoundaryState(context.workspaceState as never); await BoundarySnapshot.load(); sessions = [];
});
afterEach(() => { sessions.forEach(session => session.dispose()); context.subscriptions.forEach(item => item.dispose()); });
function fixture() {
    let filters = 0, workers = 0, reads = 0, operation: unknown;
    const session = new CheckedPowerShellSession({ root: stub.Uri.file(root) as unknown as vscode.Uri,
        reader: { read: async () => { reads++; return { status: "DENIED" }; }, revoke() {}, isEnabled: () => true },
        vault: { createManagedOutputFilter: async (_uri, enabled) => { filters++; return new ManagedOutputFilter([PRIVATE], enabled); } },
        enabled: () => true, parentEnvironment: { SystemRoot: "C:\\Windows", LANG: "C" },
    }, { createWorker: options => {
        workers++; operation = options.operation; let state: PowerShell51Snapshot["state"] = "READY", settled = false;
        const snapshot = (): PowerShell51Snapshot => Object.freeze({ id: options.id, state, ...(state === "EXITED" ? { exitCode: 0 } : {}) });
        let resolve!: (result: PowerShell51Completion) => void;
        const completion = new Promise<PowerShell51Completion>(done => { resolve = done; });
        return { snapshot, completion,
            start: async () => {
                state = "RUNNING"; const running = snapshot();
                assert.equal(options.output.push("stdout", Buffer.from(NAMES, "utf8")).status, "BUFFERED");
                const output = options.output.finish(0); options.output.dispose(); state = "EXITED"; settled = true;
                resolve(Object.freeze({ snapshot: snapshot(), output })); return running;
            },
            cancel: () => { if (settled) return; settled = true; state = "CANCELLED"; options.output.cancel();
                resolve(Object.freeze({ snapshot: snapshot(), output: { status: "WITHHELD" as const, stdout: "", stderr: "", redacted: false, reason: "synthetic_withheld" } })); },
            dispose: () => { options.output.dispose(); },
        };
    } });
    sessions.push(session);
    return { session, get filters() { return filters; }, get workers() { return workers; }, get reads() { return reads; }, get operation() { return operation; } };
}
function assertWithheld(result: Awaited<ReturnType<CheckedPowerShellSession["execute"]>>) {
    assert.equal(result.status, "WITHHELD"); assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
}
test("F10-RL01 ordinary workspace root directory metadata dispatches without reading a probe or child contents", async () => {
    const f = fixture(), result = await f.session.execute("ls .");
    assert.equal(result.status, "COMPLETE"); assert.equal(result.stdout, NAMES); assert.equal(result.stderr, "");
    assert.equal(f.filters, 1); assert.equal(f.workers, 1); assert.equal(f.reads, 0);
    assert.deepEqual(f.operation, { kind: "PUBLIC", action: "list", args: ["."] });
});
test("F10-RL02 ordinary child-directory metadata retains its existing positive route", async () => {
    const f = fixture(), result = await f.session.execute("ls public");
    assert.equal(result.status, "COMPLETE"); assert.equal(result.stdout, NAMES); assert.equal(f.filters, 1); assert.equal(f.workers, 1); assert.equal(f.reads, 0);
    assert.deepEqual(f.operation, { kind: "PUBLIC", action: "list", args: ["public"] });
});
test("F10-RL03 whole-project glob deny still withholds root metadata before any worker", async () => {
    await updateRules(stub.Uri.file(root).toString(), rules => ({ ...rules, paths: [...rules.paths, { kind: "glob", pattern: "**" }] }));
    const f = fixture(); assertWithheld(await f.session.execute("ls .")); assert.equal(f.filters, 0); assert.equal(f.workers, 0); assert.equal(f.reads, 0);
});
test("F10-RL04 whole-project folder-dot deny still withholds root metadata before any worker", async () => {
    await updateRules(stub.Uri.file(root).toString(), rules => ({ ...rules, paths: [...rules.paths, { kind: "folder", pattern: "." }] }));
    const f = fixture(); assertWithheld(await f.session.execute("ls .")); assert.equal(f.filters, 0); assert.equal(f.workers, 0); assert.equal(f.reads, 0);
});
test("F10-RL05 corrupt stored policy withholds root metadata before any worker", async () => {
    await context.workspaceState.update(RULES_KEY, []);
    const f = fixture(); assertWithheld(await f.session.execute("ls .")); assert.equal(f.filters, 0); assert.equal(f.workers, 0); assert.equal(f.reads, 0);
});
