import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type * as vscode from "vscode";
import * as stub from "./phase2/vscode-stub";
import { BoundarySnapshot, initializeBoundaryState } from "../ai-boundary/BoundarySnapshot";
import { CheckedPowerShellSession } from "../terminal/CheckedPowerShellSession";
import { ManagedOutputFilter } from "../terminal/ManagedOutputFilter";
import type { PowerShell51Completion, PowerShell51Snapshot } from "../terminal/PowerShell51Worker";
import type { OutputResult } from "../../../core/src/StreamingOutputRedactor";

// Publication-binding regression, not a secret-leak claim. The real private
// filter finishes public bytes under a valid binding. Only fake worker promise
// publication is held; no real process, secret file, cipher or native shell runs.
const PRIVATE = "synthetic-f10-publication-private-binding-canary-qX92";
const PUBLIC = "public completed worker output\n";
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve };
}
const withheld = (): OutputResult => Object.freeze({ status: "WITHHELD", stdout: "", stderr: "", redacted: false, reason: "synthetic_withheld" });
let root: string, context: ReturnType<typeof stub.makeExtensionContext>, sessions: CheckedPowerShellSession[];
beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "soterai-f10-publication-review-"));
    stub.resetState(root); context = stub.makeExtensionContext(root);
    initializeBoundaryState(context.workspaceState as never); await BoundarySnapshot.load(); sessions = [];
});
afterEach(() => { sessions.forEach(session => session.dispose()); context.subscriptions.forEach(item => item.dispose()); });
function fixture() {
    let privateCurrent = true, filters = 0, workers = 0, reads = 0, finishedWhilePrivateCurrent = false;
    let finished: OutputResult | undefined, filter: ManagedOutputFilter | undefined;
    let id = "", state: PowerShell51Snapshot["state"] = "READY", settled = false;
    const filtered = deferred<void>(), completion = deferred<PowerShell51Completion>();
    const snapshot = (): PowerShell51Snapshot => Object.freeze({ id, state, ...(state === "EXITED" ? { exitCode: 0 } : {}) });
    const publish = () => {
        assert.ok(finished, "Filtering must finish before the fake worker publishes completion.");
        if (settled) return; settled = true; state = "EXITED";
        completion.resolve(Object.freeze({ snapshot: snapshot(), output: finished }));
    };
    const session = new CheckedPowerShellSession({ root: stub.Uri.file(root) as unknown as vscode.Uri,
        reader: { read: async () => { reads++; return { status: "DENIED" }; }, revoke() {}, isEnabled: () => true },
        vault: { createManagedOutputFilter: async (_uri, sessionGuard) => {
            filters++; filter = new ManagedOutputFilter([PRIVATE], () => privateCurrent && sessionGuard()); return filter;
        } },
        enabled: () => true, parentEnvironment: { SystemRoot: "C:\\Windows", LANG: "C" },
    }, { createWorker: options => {
        workers++; id = options.id;
        return { snapshot, completion: completion.promise,
            start: async () => {
                state = "RUNNING";
                queueMicrotask(() => {
                    assert.equal(options.output.push("stdout", Buffer.from(PUBLIC, "utf8")).status, "BUFFERED");
                    finishedWhilePrivateCurrent = privateCurrent;
                    finished = options.output.finish(0);
                    options.output.dispose(); // Same single-use sink ownership as the actual worker.
                    filtered.resolve();
                });
                return snapshot();
            },
            cancel: () => {
                if (settled) return; settled = true; state = "CANCELLED"; options.output.cancel();
                completion.resolve(Object.freeze({ snapshot: snapshot(), output: withheld() })); filtered.resolve();
            },
            dispose: () => { options.output.dispose(); },
        };
    } });
    sessions.push(session);
    return { session, filtered: filtered.promise, publish, revokePrivate: () => { privateCurrent = false; },
        get privateCurrent() { return privateCurrent; }, get finishedWhilePrivateCurrent() { return finishedWhilePrivateCurrent; },
        get finished() { return finished; }, get filter() { return filter; }, get filters() { return filters; },
        get workers() { return workers; }, get reads() { return reads; } };
}

test("F10-PR01 stable private binding publishes completed public output after single-use filter disposal", { timeout: 3000 }, async () => {
    const f = fixture(), run = f.session.execute("Get-Date"); await f.filtered;
    assert.equal(f.finishedWhilePrivateCurrent, true); assert.equal(f.finished?.status, "COMPLETE");
    assert.equal(f.finished?.stdout, PUBLIC); assert.equal(f.filter?.available(), false, "A finished single-use sink is normally closed.");
    assert.equal(f.session.snapshot().state, "BUSY"); assert.equal(f.privateCurrent, true); f.publish();
    const result = await run; assert.equal(result.status, "COMPLETE"); assert.equal(result.stdout, PUBLIC); assert.equal(result.stderr, "");
    assert.equal(f.filters, 1); assert.equal(f.workers, 1); assert.equal(f.reads, 0); assert.equal(f.session.snapshot().state, "IDLE");
    assert.ok(!JSON.stringify(result).includes(PRIVATE));
});
test("F10-PR02 revoked private binding after filter finish but before worker completion withholds publication", { timeout: 3000 }, async () => {
    const f = fixture(), run = f.session.execute("Get-Date"); await f.filtered;
    assert.equal(f.finishedWhilePrivateCurrent, true); assert.equal(f.finished?.status, "COMPLETE"); assert.equal(f.finished?.stdout, PUBLIC);
    assert.equal(f.filter?.available(), false); assert.equal(f.session.snapshot().state, "BUSY");
    f.revokePrivate(); assert.equal(f.privateCurrent, false); f.publish();
    const result = await run; assert.equal(result.status, "WITHHELD"); assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
    assert.equal(f.filters, 1); assert.equal(f.workers, 1); assert.equal(f.reads, 0); assert.equal(f.session.snapshot().state, "IDLE");
    assert.ok(!JSON.stringify(result).includes(PRIVATE));
});
