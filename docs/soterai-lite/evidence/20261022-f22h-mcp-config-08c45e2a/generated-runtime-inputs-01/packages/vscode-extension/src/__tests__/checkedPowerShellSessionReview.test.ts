import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type * as vscode from "vscode";
import * as stub from "./phase2/vscode-stub";
import { initializeBoundaryState, BoundarySnapshot } from "../ai-boundary/BoundarySnapshot";
import { CheckedPowerShellSession } from "../terminal/CheckedPowerShellSession";
import { ManagedOutputFilter } from "../terminal/ManagedOutputFilter";

// Synthetic in-project COPY only. The real filter owns an independent private
// registry guard; no application, vault value disclosure or native shell runs.
const PRIVATE = "synthetic-f10-copy-private-registry-value-9jQ";
const SAFE = "approved public safe view\n";
let root: string, context: ReturnType<typeof stub.makeExtensionContext>;
let owned: CheckedPowerShellSession[];
beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "soterai-f10-copy-review-"));
    await writeFile(join(root, "source.txt"), "ordinary synthetic source\n");
    stub.resetState(root); context = stub.makeExtensionContext(root);
    initializeBoundaryState(context.workspaceState as never); await BoundarySnapshot.load(); owned = [];
});
afterEach(() => {
    owned.forEach(session => session.dispose()); mock.restoreAll();
    context.subscriptions.forEach(disposable => disposable.dispose());
});
async function copyFixture(invalidateAtFinalDestinationCheck: boolean) {
    let privateRegistryCurrent = true, filterCreated = false, lateCheckReached = false, reads = 0, filters = 0, workers = 0;
    const originalLoad = BoundarySnapshot.load.bind(BoundarySnapshot);
    mock.method(BoundarySnapshot, "load", async (...args: Parameters<typeof BoundarySnapshot.load>) => {
        const snapshot = await originalLoad(...args);
        // The first destination check is before filter acquisition. A later
        // destination check after acquisition must precede final private output
        // validation, regardless of whether finish was previously called.
        if (filterCreated) {
            lateCheckReached = true;
            if (invalidateAtFinalDestinationCheck) privateRegistryCurrent = false;
        }
        return snapshot;
    });
    const session = new CheckedPowerShellSession({ root: stub.Uri.file(root) as unknown as vscode.Uri,
        reader: { read: async () => { reads++; return { status: "ALLOWED_ONCE", kind: "redacted-file", text: SAFE }; }, revoke() {}, isEnabled: () => true },
        vault: { createManagedOutputFilter: async (_root, sessionGuard) => {
            filters++; const filter = new ManagedOutputFilter([PRIVATE], () => privateRegistryCurrent && sessionGuard());
            filterCreated = true; return filter;
        } },
        enabled: () => true, parentEnvironment: { SystemRoot: "C:\\Windows", LANG: "C" },
    }, { reviewCopy: async () => true, createWorker: () => { workers++; throw new Error("COPY must not start a worker."); } });
    owned.push(session);
    return { session, get lateCheckReached() { return lateCheckReached; }, get reads() { return reads; },
        get filters() { return filters; }, get workers() { return workers; } };
}

test("F10-DR01 late private registry invalidation during final COPY destination check prevents publication", async () => {
    const fixture = await copyFixture(true), result = await fixture.session.execute("copy source.txt declined-copy.txt");
    assert.equal(fixture.lateCheckReached, true, "The asynchronous final destination check must reach the private-registry drift.");
    assert.equal(fixture.reads, 1); assert.equal(fixture.filters, 1); assert.equal(fixture.workers, 0);
    assert.equal(result.status, "WITHHELD"); assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
    await assert.rejects(readFile(join(root, "declined-copy.txt")), { code: "ENOENT" });
});

test("F10-DR02 unchanged private registry preserves approved exclusive safe COPY", async () => {
    const fixture = await copyFixture(false), result = await fixture.session.execute("copy source.txt approved-copy.txt");
    assert.equal(fixture.lateCheckReached, true); assert.equal(fixture.reads, 1); assert.equal(fixture.filters, 1); assert.equal(fixture.workers, 0);
    assert.equal(result.status, "COMPLETE"); assert.equal(await readFile(join(root, "approved-copy.txt"), "utf8"), SAFE);
    assert.ok(!JSON.stringify(result).includes(PRIVATE));
});
