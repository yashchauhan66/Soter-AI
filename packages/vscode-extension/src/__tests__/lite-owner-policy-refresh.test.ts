import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { mkdtemp, mkdir, rm, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import * as stub from "./phase2/vscode-stub";
import {
    BoundarySnapshot, initializeBoundaryState, onDidChangeOwnerPolicySession,
    storedRules, updateRules,
} from "../ai-boundary/BoundarySnapshot";
import { RedactedDocumentProvider } from "../ai-boundary/commands";
import { registerProjectPrivacyCommands } from "../project-privacy/commands";
import { OMITTED } from "../ai-boundary/policy";

// Only synthetic files, in-memory extension storage and owned preview providers.
// The refresh observer caps rereads, safely modelling VS Code's onDidChange read.
const PUBLIC = "Useful F03 refresh public control.";
const PRIVATE = "SYNTHETIC_F03_REFRESH_PERMANENT_PRIVATE_TEXT";
const ENV_VALUE = "SYNTHETIC_F03_REFRESH_ENV_VALUE_NEVER_RELEASED";
type ApprovedProvider = {
    provideTextDocumentContent(uri: stub.Uri): string;
    onDidChange(listener: (uri: stub.Uri) => void): stub.Disposable;
};
let root: string, context: ReturnType<typeof stub.makeExtensionContext>;
let redacted: RedactedDocumentProvider, approved: ApprovedProvider, approvedUri: stub.Uri | undefined;
let sessionEvents: string[];
const windowOriginals = Object.getOwnPropertyDescriptors(stub.window);
const providerOriginal = Object.getOwnPropertyDescriptor(stub.workspace, "registerTextDocumentContentProvider");
const uri = (relative: string) => stub.Uri.file(join(root, relative));
const rootKey = () => stub.state.folders[0].uri.toString();
const policyPath = () => join(root, ".soterai", "team-policy.json");
const futurePolicy = () => JSON.stringify({ schemaVersion: 99, presets: [], rules: { paths: [], regions: [] }, sensitiveGlobs: [] });

async function assertInvalid(snapshot: BoundarySnapshot): Promise<void> {
    assert.equal(snapshot.availableForRoot(stub.state.folders[0].uri as never), false);
    for (const filename of ["public.txt", "memo.txt", ".env.synthetic"]) {
        assert.equal(snapshot.blocks(uri(filename) as never), true, filename);
        assert.equal(await snapshot.read(uri(filename) as never), OMITTED, filename);
    }
}
async function openMaskedView(): Promise<stub.Uri> {
    approvedUri = undefined;
    const result = await stub.commands.executeCommand("soterai.reviewSafeFileAccess", uri(".env.synthetic")) as { status: string; text?: string };
    assert.equal(result.status, "ALLOWED_ONCE");
    assert.equal(result.text, "DATABASE_URL=[MASKED]\nPUBLIC_PORT=[MASKED]");
    assert.ok(approvedUri, "The actual safe-preview command must create an owned approved document.");
    assert.equal(approved.provideTextDocumentContent(approvedUri), result.text);
    assert.ok(!stub.capturedText().includes(ENV_VALUE));
    return approvedUri;
}

beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "soterai-f03-refresh-"));
    stub.resetState(root); context = stub.makeExtensionContext(root);
    initializeBoundaryState(context.workspaceState as never);
    await mkdir(join(root, ".soterai"));
    await writeFile(join(root, "public.txt"), PUBLIC);
    await writeFile(join(root, "memo.txt"), PRIVATE);
    await writeFile(join(root, ".env.synthetic"), `DATABASE_URL=${ENV_VALUE}\nPUBLIC_PORT=8080\n`);
    Object.assign(stub.workspace, { registerTextDocumentContentProvider: (scheme: string, provider: ApprovedProvider) => {
        if (scheme === "soterai-approved") approved = provider;
        return new stub.Disposable();
    } });
    Object.assign(stub.window, { showWarningMessage: async () => "Allow safe read once" });
    const openDocument = stub.workspace.openTextDocument.bind(stub.workspace);
    mock.method(stub.workspace, "openTextDocument", async (arg: stub.Uri | { content?: string; language?: string }) => {
        if (arg instanceof stub.Uri && arg.scheme === "soterai-approved") {
            approvedUri = arg;
            return stub.makeDocument(arg, approved.provideTextDocumentContent(arg));
        }
        return openDocument(arg);
    });
    registerProjectPrivacyCommands(context as never);
    await BoundarySnapshot.load();
    await updateRules(rootKey(), rules => ({ ...rules, paths: [{ kind: "file", pattern: "memo.txt" }] }));
    redacted = new RedactedDocumentProvider();
    sessionEvents = [];
    context.subscriptions.push(redacted,
        onDidChangeOwnerPolicySession(root => { sessionEvents.push(root); redacted.refresh(); }));
    stub.resetSinks();
});

afterEach(async () => {
    mock.restoreAll(); context.subscriptions.forEach(item => item.dispose());
    for (const name of Object.keys(stub.window)) {
        if (!(name in windowOriginals)) delete (stub.window as unknown as Record<string, unknown>)[name];
    }
    Object.defineProperties(stub.window, windowOriginals);
    if (providerOriginal) Object.defineProperty(stub.workspace, "registerTextDocumentContentProvider", providerOriginal);
    else delete (stub.workspace as unknown as Record<string, unknown>).registerTextDocumentContentProvider;
    const target = resolve(root);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith("soterai-f03-refresh-"));
    await rm(target, { recursive: true, force: true });
});

test("F03-RF01 repeated future-policy snapshot loads notify once and retain every permanent deny", async () => {
    const permanent = structuredClone(storedRules(rootKey()));
    await writeFile(policyPath(), futurePolicy());
    for (let read = 0; read < 6; read++) await assertInvalid(await BoundarySnapshot.load());
    assert.deepEqual(sessionEvents, [rootKey()], "One invalid interval must produce one owned-view invalidation, even with no session grants.");
    assert.deepEqual(storedRules(rootKey()), permanent);
    assert.ok(!stub.capturedText().includes(PRIVATE));
});

test("F03-RF02 owned preview rereads cannot create a refresh loop and each new invalid interval clears approved masked views", async () => {
    const publicView = redacted.createUri(uri("public.txt") as never);
    assert.equal(await redacted.provideTextDocumentContent(publicView), PUBLIC);
    const firstApproved = await openMaskedView();
    const refreshed: string[] = [], approvedChanges: string[] = [], rereads: Promise<string>[] = [];
    let followingRefreshes = true;
    context.subscriptions.push(redacted.onDidChange(target => {
        refreshed.push(target.toString());
        // A real host rereads provider content after onDidChange. Cap the observer
        // at three follow-ups so a regression produces a bounded failing test.
        if (followingRefreshes && refreshed.length <= 3) {
            rereads.push(Promise.resolve().then(() => redacted.provideTextDocumentContent(target)));
        }
    }), approved.onDidChange(target => approvedChanges.push(target.toString())));
    await writeFile(policyPath(), futurePolicy());
    assert.equal(await redacted.provideTextDocumentContent(publicView), OMITTED);
    for (let next = 0; next < rereads.length; next++) assert.equal(await rereads[next], OMITTED);
    assert.deepEqual(refreshed, [publicView.toString()], "Invalid provider rereads must not trigger another onDidChange.");
    assert.deepEqual(sessionEvents, [rootKey()]);
    assert.deepEqual(approvedChanges, [firstApproved.toString()]);
    assert.equal(approved.provideTextDocumentContent(firstApproved), OMITTED,
        "The first invalid transition must clear owned masked views even when no owner session grant exists.");
    followingRefreshes = false;
    await unlink(policyPath());
    const recovered = await BoundarySnapshot.load();
    assert.equal(await recovered.read(uri("public.txt") as never), PUBLIC);
    assert.equal(await recovered.read(uri("memo.txt") as never), OMITTED);
    const secondApproved = await openMaskedView();
    assert.notEqual(secondApproved.toString(), firstApproved.toString());
    const beforeSecondFailure = sessionEvents.length;
    await writeFile(policyPath(), "{ malformed synthetic policy");
    await assertInvalid(await BoundarySnapshot.load());
    assert.equal(sessionEvents.length, beforeSecondFailure + 1, "A valid recovery must rearm the next invalid transition.");
    assert.equal(approved.provideTextDocumentContent(secondApproved), OMITTED);
    assert.equal(approvedChanges.filter(target => target === secondApproved.toString()).length, 1);
    for (let read = 0; read < 3; read++) assert.equal(await redacted.provideTextDocumentContent(publicView), OMITTED);
    assert.equal(sessionEvents.length, beforeSecondFailure + 1);
    assert.ok(!stub.capturedText().includes(ENV_VALUE));
});

test("F03-RF03 concurrent invalid loads produce one transition and recovery rearms concurrent failures", async () => {
    await writeFile(policyPath(), futurePolicy());
    const failed = await Promise.all(Array.from({ length: 8 }, () => BoundarySnapshot.load()));
    for (const snapshot of failed) await assertInvalid(snapshot);
    assert.deepEqual(sessionEvents, [rootKey()]);
    await unlink(policyPath());
    assert.equal(await (await BoundarySnapshot.load()).read(uri("public.txt") as never), PUBLIC);
    const beforeSecondFailure = sessionEvents.length;
    await writeFile(policyPath(), "{ malformed concurrent synthetic policy");
    const failedAgain = await Promise.all(Array.from({ length: 8 }, () => BoundarySnapshot.load()));
    for (const snapshot of failedAgain) await assertInvalid(snapshot);
    assert.equal(sessionEvents.length, beforeSecondFailure + 1);
    assert.ok(storedRules(rootKey()).paths.some(rule => rule.pattern === "memo.txt"));
});

test("F03-RF04 initially disabled policy needs one invalid transition even without a parsing exception", async () => {
    stub.state.config.set("soterai.hardening.addOnlyPolicy", false);
    for (let read = 0; read < 4; read++) await assertInvalid(await BoundarySnapshot.load());
    assert.deepEqual(sessionEvents, [rootKey()]);
    stub.state.config.set("soterai.hardening.addOnlyPolicy", true);
    assert.equal(await (await BoundarySnapshot.load()).read(uri("public.txt") as never), PUBLIC);
    const beforeSecondFailure = sessionEvents.length;
    stub.state.config.set("soterai.hardening.addOnlyPolicy", false);
    await assertInvalid(await BoundarySnapshot.load());
    assert.equal(sessionEvents.length, beforeSecondFailure + 1);
});
