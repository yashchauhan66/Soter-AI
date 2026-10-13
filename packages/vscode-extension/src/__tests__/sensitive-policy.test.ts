import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync } from "node:fs";
import * as stub from "./phase2/vscode-stub";
import { BoundarySnapshot, initializeBoundaryState, RULES_KEY, storedRules, updateRules } from "../ai-boundary/BoundarySnapshot";
import { mergeManualRules, parseManualRules, type ManualRules } from "../ai-boundary/policy";
import { registerProjectPrivacyCommands } from "../project-privacy/commands";
import { registerAIBoundaryCommands } from "../ai-boundary/commands";
import { SENSITIVE_MARKS_KEY, parseSensitiveMarks } from "../project-privacy/SensitiveRestrictions";

const privateText = "TEST_ONLY_SENSITIVE_POLICY_VALUE_20261012";
let root: string;
let context: ReturnType<typeof stub.makeExtensionContext>;
const uri = (rel: string) => stub.Uri.file(join(root, rel));
const rootKey = () => stub.state.folders[0].uri.toString();

beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "soterai-sensitive-policy-"));
    stub.resetState(root);
    // Preserve these legacy one-write/fault contracts; F02 tests separately
    // cover atomic upgraded storage with automatic defaults enabled.
    stub.state.config.set("soterai.lite.versionedPolicy", false);
    context = stub.makeExtensionContext(root);
    initializeBoundaryState(context.workspaceState as never);
    Object.assign(stub.workspace, { registerTextDocumentContentProvider: () => new stub.Disposable() });
    await writeFile(join(root, "private.txt"), privateText);
    await writeFile(join(root, "public.txt"), "Useful public control.");
});
afterEach(async () => {
    context.subscriptions.forEach(item => item.dispose());
    mock.restoreAll();
    const target = resolve(root);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith("soterai-sensitive-policy-"));
    await rm(target, { recursive: true, force: true });
});

test("sensitive marking commits deny and classification in one logical policy write", async () => {
    const update = context.workspaceState.update;
    const writes: string[] = [];
    mock.method(context.workspaceState, "update", async (key: string, value: unknown) => { writes.push(key); await update(key, value); });
    registerProjectPrivacyCommands(context as never);
    await stub.commands.executeCommand("soterai.restrictSensitiveFile", uri("private.txt"));
    assert.deepEqual(writes, [RULES_KEY]);
    assert.deepEqual(storedRules(rootKey()).paths, [{ kind: "file", pattern: "private.txt", sensitive: true }]);
    const snapshot = await BoundarySnapshot.load();
    assert.equal(snapshot.blocks(uri("private.txt") as never), true);
    assert.equal(snapshot.isSensitive(uri("private.txt") as never), true);
    assert.equal(snapshot.blocks(uri("public.txt") as never), false);
    mock.method(stub.window, "showWarningMessage", async () => "Allow safe read once");
    const result = await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("private.txt")) as { status: string; text: string };
    assert.equal(result.status, "ALLOWED_ONCE");
    assert.match(result.text, /MASKED/);
    assert.ok(!result.text.includes(privateText));
    const control = await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("public.txt")) as { text: string };
    assert.equal(control.text, "Useful public control.");
    assert.ok(!stub.capturedText().includes(privateText));
});

test("a failed policy save leaves no partial new record or success notification", async () => {
    mock.method(context.workspaceState, "update", async () => { throw new Error("Synthetic storage failure."); });
    registerProjectPrivacyCommands(context as never);
    await stub.commands.executeCommand("soterai.restrictSensitiveFile", uri("private.txt"));
    assert.equal(context.workspaceState.get(RULES_KEY), undefined);
    assert.equal(context.workspaceState.get(SENSITIVE_MARKS_KEY), undefined);
    assert.match(stub.capturedText(), /could not be saved/);
    assert.doesNotMatch(stub.capturedText(), /Sensitive restriction saved/);
});

test("marking revokes a pending review even when persistence fails", { timeout: 10_000 }, async () => {
    let finish!: (choice: string) => void;
    let started!: () => void;
    const reviewing = new Promise<void>(done => { started = done; });
    mock.method(stub.window, "showWarningMessage", () => new Promise<string>(done => { finish = done; started(); }));
    registerProjectPrivacyCommands(context as never);
    const pending = stub.commands.executeCommand("soterai.readProjectFileSafely", uri("private.txt"));
    await reviewing;
    assert.ok(finish);
    mock.method(context.workspaceState, "update", async () => { throw new Error("Synthetic storage failure."); });
    await stub.commands.executeCommand("soterai.restrictSensitiveFile", uri("private.txt"));
    finish("Allow safe read once");
    assert.deepEqual(await pending, { status: "EXPIRED" });
});

test("reads begun during a pending sensitive save are withheld, while public work continues", { timeout: 10_000 }, async () => {
    let rejectSave!: (error: Error) => void;
    let started!: () => void;
    const saving = new Promise<void>(done => { started = done; });
    mock.method(context.workspaceState, "update", () => new Promise<void>((_done, reject) => { rejectSave = reject; started(); }));
    let reviews = 0;
    mock.method(stub.window, "showWarningMessage", async () => { reviews++; return "Allow safe read once"; });
    registerProjectPrivacyCommands(context as never);
    const marking = stub.commands.executeCommand("soterai.restrictSensitiveFile", uri("private.txt"));
    await saving;
    assert.deepEqual(await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("private.txt")), { status: "UNAVAILABLE" });
    assert.equal(reviews, 0);
    const control = await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("public.txt")) as { text: string };
    assert.equal(control.text, "Useful public control.");
    rejectSave(new Error("Synthetic pending write failure."));
    await marking;
    assert.equal(context.workspaceState.get(RULES_KEY), undefined);
    assert.doesNotMatch(stub.capturedText(), /Sensitive restriction saved/);
});

test("upgrading a deny at the rule limit preserves its slot and strongest treatment", async () => {
    const paths: ManualRules["paths"] = Array.from({ length: 256 }, (_, i) => ({ kind: "file", pattern: i === 0 ? "PRIVATE.txt" : `file-${i}.txt` }));
    await updateRules(rootKey(), () => ({ paths, regions: [] }));
    registerProjectPrivacyCommands(context as never);
    await stub.commands.executeCommand("soterai.restrictSensitiveFile", uri("private.txt"));
    assert.equal(storedRules(rootKey()).paths.length, 256);
    assert.equal(storedRules(rootKey()).paths[0].sensitive, true);
    await updateRules(rootKey(), () => ({ paths: [{ kind: "file", pattern: "private.txt" }], regions: [] }));
    assert.equal(storedRules(rootKey()).paths[0].sensitive, true);
});

test("invalid sensitive flags and corrupt legacy records fail closed", async () => {
    for (const flag of [false, "true", null]) {
        assert.throws(() => parseManualRules({ paths: [{ kind: "file", pattern: "private.txt", sensitive: flag }], regions: [] }));
    }
    assert.throws(() => parseManualRules({ paths: [{ kind: "glob", pattern: "**", sensitive: true }], regions: [] }));
    for (const raw of [null, [], { [rootKey()]: null }, { [rootKey()]: ["../outside"] }]) {
        assert.throws(() => parseSensitiveMarks(raw, rootKey()));
        await context.workspaceState.update(SENSITIVE_MARKS_KEY, raw);
        const snapshot = await BoundarySnapshot.load();
        assert.equal(snapshot.blocks(uri("public.txt") as never), true);
        assert.equal(snapshot.accessRevision(uri("public.txt") as never), undefined);
    }
});

test("legacy marks migrate before release and survive loss of the legacy record", async () => {
    const legacy = { [rootKey()]: ["PRIVATE.txt"] };
    await context.workspaceState.update(SENSITIVE_MARKS_KEY, legacy);
    registerProjectPrivacyCommands(context as never);
    mock.method(stub.window, "showWarningMessage", async () => "Allow safe read once");
    const first = await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("private.txt")) as { text: string };
    assert.match(first.text, /MASKED/);
    assert.deepEqual(context.workspaceState.get(SENSITIVE_MARKS_KEY), legacy);
    const persisted = context.workspaceState.get<Record<string, ManualRules>>(RULES_KEY)!;
    assert.equal(persisted[rootKey()].paths[0].sensitive, true);
    context._inspect.workspaceStore.delete(SENSITIVE_MARKS_KEY);
    initializeBoundaryState(context.workspaceState as never);
    const again = await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("private.txt")) as { text: string };
    assert.match(again.text, /MASKED/);
    assert.ok(!again.text.includes(privateText));
});

test("migration write failure withholds managed reads and retains legacy metadata", async () => {
    const legacy = { [rootKey()]: ["private.txt"] };
    await context.workspaceState.update(SENSITIVE_MARKS_KEY, legacy);
    mock.method(context.workspaceState, "update", async () => { throw new Error("Synthetic migration failure."); });
    registerProjectPrivacyCommands(context as never);
    assert.deepEqual(await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("private.txt")), { status: "UNAVAILABLE" });
    assert.equal(context.workspaceState.get(RULES_KEY), undefined);
    assert.deepEqual(context.workspaceState.get(SENSITIVE_MARKS_KEY), legacy);
});

test("concurrent roots retain every sensitive and ordinary deny", async () => {
    const keys = [rootKey(), "file:///synthetic-second-project"];
    await Promise.all(Array.from({ length: 20 }, (_, i) => updateRules(keys[i % 2], () => ({
        paths: [{ kind: "file", pattern: `private-${i}.txt`, ...(i % 3 === 0 ? { sensitive: true as const } : {}) }], regions: [],
    }))));
    for (const key of keys) assert.equal(storedRules(key).paths.length, 10);
    assert.equal(keys.flatMap(key => storedRules(key).paths).filter(rule => rule.sensitive).length, 7);
});

test("sensitivity changes the immutable policy revision and additive merges cannot downgrade it", async () => {
    await updateRules(rootKey(), () => ({ paths: [{ kind: "file", pattern: "private.txt" }], regions: [] }));
    const before = await BoundarySnapshot.load();
    await updateRules(rootKey(), () => ({ paths: [{ kind: "file", pattern: "private.txt", sensitive: true }], regions: [] }));
    const after = await BoundarySnapshot.load();
    assert.notEqual(before.accessRevision(uri("private.txt") as never), after.accessRevision(uri("private.txt") as never));
    assert.equal(before.isSensitive(uri("private.txt") as never), false);
    assert.equal(after.isSensitive(uri("private.txt") as never), true);
    assert.equal(mergeManualRules(storedRules(rootKey()), { paths: [{ kind: "file", pattern: "PRIVATE.txt" }], regions: [] }).paths[0].sensitive, true);
});

test("generic deny relaxation cannot select or clear a sensitive entry", async () => {
    await updateRules(rootKey(), () => ({ paths: [
        { kind: "file", pattern: "private.txt", sensitive: true }, { kind: "file", pattern: "public.txt" },
    ], regions: [] }));
    registerAIBoundaryCommands(context as never);
    mock.method(stub.window, "showWorkspaceFolderPick", async () => stub.state.folders[0]);
    mock.method(stub.window, "showQuickPick", async (choices: Array<{ label: string }>) => {
        assert.equal(choices.length, 1);
        assert.ok(!choices[0].label.includes("private.txt"));
        return choices[0];
    });
    mock.method(stub.window, "showWarningMessage", async () => "Relax this deny");
    await stub.commands.executeCommand("soterai.manageAIRules", { remove: "private.txt", approved: true });
    assert.deepEqual(storedRules(rootKey()).paths, [{ kind: "file", pattern: "private.txt", sensitive: true }]);
});

test("dedicated rollback flag withdraws the reader while retaining denies and masking defaults", async () => {
    registerProjectPrivacyCommands(context as never);
    await stub.commands.executeCommand("soterai.restrictSensitiveFile", uri("private.txt"));
    stub.state.config.set("soterai.projectPrivacy.atomicSensitivePolicy", false);
    assert.deepEqual(await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("private.txt")), { status: "UNAVAILABLE" });
    await stub.commands.executeCommand("soterai.restrictSensitiveFile", uri("public.txt"));
    assert.equal(storedRules(rootKey()).paths.length, 1);
    assert.equal((await BoundarySnapshot.load()).blocks(uri("private.txt") as never), true);
    assert.equal(stub.workspace.getConfiguration("soterai").get("projectPrivacy.enabled", true), true);
    const manifest = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf8"));
    const key = "soterai.projectPrivacy.atomicSensitivePolicy";
    assert.equal(manifest.contributes.configuration.properties[key].scope, "machine");
    assert.equal(manifest.contributes.configuration.properties[key].default, true);
    assert.ok(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes(key));
});
