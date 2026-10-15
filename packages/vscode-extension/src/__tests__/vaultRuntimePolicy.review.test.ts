import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type * as vscode from "vscode";
import * as stub from "./phase2/vscode-stub";
import { initializeBoundaryState, BoundarySnapshot } from "../ai-boundary/BoundarySnapshot";
import { VaultManager } from "../firewall/VaultManager";

// Synthetic-only actual-manager lease fixture. No owner review is requested,
// no owner session is granted, no app is spawned and no drift monitor is needed:
// the retained private guard itself must notice a changed public policy source.
const FAKE = "postgresql://synthetic-f09-policy:fake-password@policy.invalid/database";
const ENTRY = "exports.start = () => {};\n";
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const team = (pattern: string) => JSON.stringify({ schemaVersion: 1, presets: [],
    rules: { paths: [{ kind: "file", pattern }], regions: [] }, sensitiveGlobs: [] });
const POLICIES = [
    { id: "aiignore", relative: [".aiignore"], before: "private-before.txt\n", after: "private-after.txt\n" },
    { id: "project", relative: [".soterai", "policy.json"],
        before: JSON.stringify({ version: 1, protectedFiles: ["owner-private-before.txt"] }),
        after: JSON.stringify({ version: 1, protectedFiles: ["owner-private-after.txt"] }) },
    { id: "team", relative: [".soterai", "team-policy.json"], before: team("team-private-before.txt"), after: team("team-private-after.txt") },
] as const;
type Selection = { name: string; placeholder: string };
type LeaseManager = VaultManager & {
    runtimeSelections(uri: vscode.Uri): Promise<readonly Selection[]>;
    withRuntimeValues<T>(descriptor: unknown, use: (values: Readonly<Record<string, string>>, guard: () => boolean) => T,
        enabled: () => boolean): Promise<T>;
};
let context: ReturnType<typeof stub.makeExtensionContext>, manager: LeaseManager, root: string;
let sourceDocumentReads = 0;
const originals = Object.getOwnPropertyDescriptors(stub.window);
const workspaceOriginals = Object.getOwnPropertyDescriptors(stub.workspace);
const uri = () => stub.Uri.file(join(root, ".env")) as unknown as vscode.Uri;

async function descriptor(): Promise<Record<string, unknown>> {
    return { schemaVersion: 1, id: "2680da6f-815e-4f2c-97ad-5f00a72b3609", root,
        source: uri().fsPath, program: join(root, "app.cjs"), cwd: root,
        programDigest: sha(ENTRY), args: [], selections: await manager.runtimeSelections(uri()) };
}
async function unavailable(work: () => Promise<unknown>): Promise<void> {
    await assert.rejects(work, error => {
        assert.ok(!(error instanceof assert.AssertionError));
        assert.ok(!String(error).includes(FAKE)); return true;
    });
}
beforeEach(async () => {
    const fixture = await mkdtemp(join(tmpdir(), "soterai-f09-policy-review-"));
    root = join(fixture, "project"); const storage = join(fixture, "storage");
    await mkdir(root); await mkdir(storage); await mkdir(join(root, ".soterai"));
    await writeFile(join(root, ".env"), `DATABASE_URL='${FAKE}'\nPORT=8080\n`);
    await writeFile(join(root, "app.cjs"), ENTRY);
    for (const policy of POLICIES) await writeFile(join(root, ...policy.relative), policy.before);
    stub.resetState(root); context = stub.makeExtensionContext(root); context.globalStorageUri = stub.Uri.file(storage);
    initializeBoundaryState(context.workspaceState as never); await BoundarySnapshot.load(); sourceDocumentReads = 0;
    Object.assign(stub.window, { showWarningMessage: async (_message: string, _options: unknown, ...actions: string[]) =>
        actions.includes("Run selected app") ? "Run selected app" : actions.includes("Migrate securely") ? "Migrate securely" : undefined });
    Object.assign(stub.workspace, { openTextDocument: async () => {
        sourceDocumentReads++; throw new Error("no source TextDocument allowed");
    } });
    manager = new VaultManager(context as never) as LeaseManager;
    assert.equal(await manager.migrate(uri()), 1); stub.resetSinks();
});
afterEach(() => {
    context.subscriptions.forEach(disposable => disposable.dispose()); mock.restoreAll();
    for (const name of Object.keys(stub.window)) if (!(name in originals)) delete (stub.window as unknown as Record<string, unknown>)[name];
    for (const name of Object.keys(stub.workspace)) if (!(name in workspaceOriginals)) delete (stub.workspace as unknown as Record<string, unknown>)[name];
    Object.defineProperties(stub.window, originals); Object.defineProperties(stub.workspace, workspaceOriginals);
});

test("F09-P01 unchanged enrolled public policies retain the approved private guard", async () => {
    const d = await descriptor(); let guard!: () => boolean, calls = 0;
    await manager.withRuntimeValues(d, (values, check) => {
        calls++; assert.equal(values.DATABASE_URL, FAKE); guard = check;
    }, () => true);
    assert.equal(calls, 1); assert.equal(guard(), true);
    for (const policy of POLICIES) assert.equal(await readFile(join(root, ...policy.relative), "utf8"), policy.before);
    assert.equal(guard(), true); assert.equal(sourceDocumentReads, 0);
    for (const sink of stub.sinks) assert.ok(!sink.text.includes(FAKE));
});

for (const policy of POLICIES) {
    test(`F09-P02-${policy.id} changed public policy revokes a prepared lease without owner-review grants`, async () => {
        const d = await descriptor(); let guard!: () => boolean, calls = 0;
        await manager.withRuntimeValues(d, (_values, check) => { calls++; guard = check; }, () => true);
        assert.equal(calls, 1); assert.equal(guard(), true);
        await writeFile(join(root, ...policy.relative), policy.after);
        assert.equal(guard(), false, "policy changes must invalidate before a waiting child can receive START");
        assert.equal(sourceDocumentReads, 0);
    });

    test(`F09-P03-${policy.id} policy drift during the last existing-key read prevents the private callback`, async () => {
        const d = await descriptor(), original = context.secrets.get.bind(context.secrets);
        let reads = 0, changed = false, calls = 0;
        mock.method(context.secrets, "get", async (key: string) => {
            const value = await original(key); reads++;
            // key(false) verifies each existing key twice; this is its final
            // verification read, after the last asynchronous source capture.
            if (reads === 4) {
                await writeFile(join(root, ...policy.relative), policy.after); changed = true;
            }
            return value;
        });
        await unavailable(() => manager.withRuntimeValues(d, () => { calls++; }, () => true));
        assert.ok(changed, "the final held SecretStorage read must reach the policy mutation");
        assert.equal(calls, 0); assert.equal(sourceDocumentReads, 0);
        for (const sink of stub.sinks) assert.ok(!sink.text.includes(FAKE));
    });
}
