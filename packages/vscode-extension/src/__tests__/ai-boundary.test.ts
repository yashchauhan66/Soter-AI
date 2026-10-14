// Test-only loader: run real product modules with the explicit VS Code stub.
import "./phase2/register.mjs";
import { afterEach, beforeEach, test, mock } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { execFileSync } from "node:child_process";
import * as stub from "./phase2/vscode-stub";
import { BoundarySnapshot, initializeBoundaryState, RULES_KEY, saveRules, storedRules, updateRules } from "../ai-boundary/BoundarySnapshot";
import { documentDigest, matchesGlob, matchesRule, parseAiIgnore, parseManualRules, redactRegions, relativePath, OMITTED } from "../ai-boundary/policy";
import { readBoundaryFile } from "../ai-boundary/readFile";
import { RedactedDocumentProvider, registerAIBoundaryCommands } from "../ai-boundary/commands";
import { gatherContext, setProtectedFileChecker } from "../firewall/ContextGatherer";
import { buildSafeContext, DEFAULT_PROJECT_POLICY } from "@soterai/guard-core";

let root: string;
let context: ReturnType<typeof stub.makeExtensionContext>;
const custom = "Private merchant account: SG-CANARY-NEVER-SEND-73921";
const fakeKey = "sk-proj-" + "FAKEtestCredential73921".repeat(3);
const uri = (rel: string) => stub.Uri.file(path.join(root, rel)) as never;
async function write(rel: string, text: string): Promise<void> {
    await fs.mkdir(path.dirname(path.join(root, rel)), { recursive: true });
    await fs.writeFile(path.join(root, rel), text);
}

beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "soterai-boundary-test-"));
    stub.resetState(root);
    context = stub.makeExtensionContext(root);
    initializeBoundaryState(context.workspaceState as never);
    setProtectedFileChecker(() => false);
    Object.assign(stub.workspace, { textDocuments: [], registerTextDocumentContentProvider: () => new stub.Disposable() });
});
afterEach(async () => {
    context.subscriptions.forEach(d => d.dispose());
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith("soterai-boundary-test-"));
    await fs.rm(resolved, { recursive: true, force: true });
});

test("deny globs cover dotfiles, directory descendants, roots and Windows case", () => {
    assert.deepEqual(parseAiIgnore("\uFEFF# rules\r\n.env\r\nprivate/\n"), [".env", "private/"]);
    for (const [file, pattern] of [["api/.ENV", ".env"], ["a/private/data.txt", "private/"], ["src/nested/key.pem", "src/**/*.pem"], ["src/key.pem", "src/**/*.pem"], ["notes.txt", "*.txt"]]) {
        assert.equal(matchesGlob(file, pattern), true, `${file} denied by ${pattern}`);
    }
    assert.equal(matchesGlob("a/private.txt", "/private.txt"), false);
    assert.equal(matchesGlob("private.txt", "/private.txt"), true);
    assert.equal(matchesGlob("src/a.ts", "src/*.txt"), false);
    assert.equal(matchesRule("weird[1]/data.txt", { kind: "folder", pattern: "weird[1]" }), true);
    assert.equal(matchesRule("weird1/data.txt", { kind: "folder", pattern: "weird[1]" }), false);
    assert.equal(matchesRule("a/data.txt", { kind: "folder", pattern: "." }), true);
});

test("invalid policies cannot silently drop rules or negate defaults", () => {
    for (const value of ["!*.env", "../secrets", "/../secrets", "a/[ab].txt", "a/{b,c}", "a//b", "C:/secret"]) assert.throws(() => parseAiIgnore(value));
    for (const value of ["../outside", "C:\\secret", "/absolute", "a\0b"]) assert.throws(() => relativePath(value));
    assert.throws(() => parseAiIgnore(Array(257).fill("file.txt").join("\n")));
    assert.throws(() => parseManualRules({ paths: [], regions: [{ path: "a", digest: "x", start: 0, end: 1 }] }));
});

test("regions merge, contain no plaintext in storage, and block changed documents", () => {
    const text = "public PRIVATE public";
    const regions = [{ path: "notes.txt", digest: documentDigest(text), start: 7, end: 14 }, { path: "notes.txt", digest: documentDigest(text), start: 9, end: 16 }];
    assert.equal(redactRegions("notes.txt", text, regions), `public ${OMITTED}ublic`);
    assert.equal(redactRegions("notes.txt", "prefix " + text, regions), OMITTED);
    assert.equal(redactRegions("other.txt", text, regions), text);
    assert.ok(!JSON.stringify(regions).includes("PRIVATE"));
});

test(".aiignore and manual folder rules exclude arbitrary data before gathering", async () => {
    await write("private/memo.txt", custom);
    await write("reports/a.csv", custom);
    await write("public.txt", "public example");
    await write(".aiignore", "private/\n");
    await saveRules(stub.state.folders[0].uri.toString(), { paths: [{ kind: "folder", pattern: "reports" }], regions: [] });
    for (const file of ["private/memo.txt", "reports/a.csv", "public.txt"]) stub.openTab(path.join(root, file));
    const gathered = await gatherContext();
    assert.deepEqual(gathered.map(i => i.path), ["public.txt"]);
    assert.ok(!JSON.stringify(gathered).includes(custom));
});

test("defaults apply before reading even when Protected Workspace Mode is off", async () => {
    await write(".env", custom);
    await stub.openEditor(path.join(root, ".env"));
    stub.openTab(path.join(root, ".env"));
    assert.deepEqual(await gatherContext(), []);
});

test("malformed/unreadable policy blocks its root and a repaired policy reloads", async () => {
    await write("public.txt", "normal");
    await write(".aiignore", "!private/**");
    assert.equal((await BoundarySnapshot.load()).blocks(uri("public.txt")), true);
    await write(".aiignore", "private/**");
    assert.equal((await BoundarySnapshot.load()).blocks(uri("public.txt")), false);
    await write(".soterai/policy.json", "{ broken");
    assert.equal((await BoundarySnapshot.load()).blocks(uri("public.txt")), true);
});

test("project denies are additive; empty protectedFiles cannot remove defaults", async () => {
    await write(".soterai/policy.json", '{"protectedFiles": ["private/**"]}');
    let snapshot = await BoundarySnapshot.load();
    assert.equal(snapshot.blocks(uri("private/a.txt")), true);
    assert.equal(snapshot.blocks(uri(".env")), true);
    await write(".soterai/policy.json", '{"protectedFiles": []}');
    snapshot = await BoundarySnapshot.load();
    assert.equal(snapshot.blocks(uri(".env")), true);
});

test("region redaction precedes selection extraction; stale edits block entire content", async () => {
    const text = `start ${custom} finish`;
    await write("notes.txt", text);
    await saveRules(stub.state.folders[0].uri.toString(), { paths: [], regions: [{ path: "notes.txt", digest: documentDigest(text), start: 6, end: 6 + custom.length }] });
    await stub.openEditor(path.join(root, "notes.txt"), { from: 0, to: 0 });
    stub.openTab(path.join(root, "notes.txt"));
    let items = await gatherContext();
    assert.ok(items.length > 0);
    assert.equal(items.find(i => i.kind === "selection")?.content, "start " + OMITTED + " finish");
    assert.ok(!JSON.stringify(items).includes(custom));
    await write("notes.txt", `edited ${text}`);
    await stub.openEditor(path.join(root, "notes.txt"));
    items = await gatherContext();
    assert.ok(items.every(i => i.content === OMITTED));
});

test("bounded reads reject hardlinks, junctions, external paths, binary and invalid UTF-8", async () => {
    await write("source.txt", custom);
    await fs.link(path.join(root, "source.txt"), path.join(root, "alias.txt"));
    await assert.rejects(readBoundaryFile(root, path.join(root, "alias.txt")));
    await write("big.txt", "x".repeat(65537));
    await assert.rejects(readBoundaryFile(root, path.join(root, "big.txt")));
    await write("binary.txt", "a\0b");
    await assert.rejects(readBoundaryFile(root, path.join(root, "binary.txt")));
    await fs.writeFile(path.join(root, "invalid.txt"), Buffer.from([0xc0, 0xaf]));
    await assert.rejects(readBoundaryFile(root, path.join(root, "invalid.txt")));
    await assert.rejects(readBoundaryFile(root, path.join(root, "..", "outside.txt")));
    await fs.mkdir(path.join(root, "private"));
    await write("private/key.txt", custom);
    await fs.symlink(path.join(root, "private"), path.join(root, "junction"), "junction");
    await assert.rejects(readBoundaryFile(root, path.join(root, "junction", "key.txt")));
});

test("a symlinked .aiignore fails closed", async () => {
    await write("policy.txt", "private/\n");
    // A hardlink needs no Windows symlink privilege and is rejected equally.
    await fs.link(path.join(root, "policy.txt"), path.join(root, ".aiignore"));
    assert.equal((await BoundarySnapshot.load()).blocks(uri("public.txt")), true);
});

test("Git diff obeys file, custom-glob and protected-region boundaries", async () => {
    await write(".env", "initial");
    await write("private.txt", "initial");
    await write("region.txt", "initial");
    await write("public.txt", "initial");
    const git = (args: string[]) => execFileSync("git", args, { cwd: root, stdio: "pipe", windowsHide: true });
    git(["init", "-q"]);
    git(["-c", "user.name=SecretGuard test", "-c", "user.email=test@example.invalid", "add", "."]);
    git(["-c", "user.name=SecretGuard test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "-qm", "fixture"]);
    for (const file of [".env", "private.txt", "region.txt"]) await write(file, custom);
    await write("public.txt", "public changed");
    await write(".aiignore", "private.txt");
    await saveRules(stub.state.folders[0].uri.toString(), { paths: [], regions: [{ path: "region.txt", digest: documentDigest(custom), start: 0, end: custom.length }] });
    const items = await gatherContext();
    assert.ok(items.some(i => i.kind === "git_diff" && i.path === "public.txt"));
    assert.ok(!JSON.stringify(items).includes(custom));
    assert.ok(!items.some(i => i.path === "git diff"));
    git(["add", "."]);
    assert.ok(!JSON.stringify(await gatherContext()).includes(custom));
    stub.state.isTrusted = false;
    assert.ok(!(await gatherContext()).some(i => i.kind === "git_diff"));
});

test("redacted virtual documents use opaque URIs and re-evaluate new deny rules", async () => {
    await write("app.txt", `public\n${fakeKey}`);
    const provider = new RedactedDocumentProvider();
    try {
        const preview = provider.createUri(uri("app.txt"));
        assert.ok(!preview.toString().includes("app.txt"));
        const safe = await provider.provideTextDocumentContent(preview);
        assert.ok(safe.includes("public"));
        assert.ok(!safe.includes(fakeKey));
        await write(".aiignore", "app.txt");
        assert.equal(await provider.provideTextDocumentContent(preview), OMITTED);
    } finally { provider.dispose(); }
});

test("closed-file previews retain public text around a manually protected region", async () => {
    const source = "public " + custom + " suffix";
    await write("notes.txt", source);
    await saveRules(stub.state.folders[0].uri.toString(), {
        paths: [], regions: [{ path: "notes.txt", digest: documentDigest(source), start: 7, end: 7 + custom.length }],
    });
    const provider = new RedactedDocumentProvider();
    try {
        const preview = provider.createUri(uri("notes.txt"));
        assert.equal(await provider.provideTextDocumentContent(preview), "public " + OMITTED + " suffix");
        await write("notes.txt", "edited " + source);
        assert.equal(await provider.provideTextDocumentContent(preview), OMITTED);
    } finally { provider.dispose(); }
});

test("Explorer Block from AI uses clicked folder, not the active editor", async () => {
    await write("clicked/memo.txt", custom);
    await write("other.txt", "normal");
    await stub.openEditor(path.join(root, "other.txt"));
    registerAIBoundaryCommands(context as never);
    await stub.commands.executeCommand("soterai.blockFromAI", uri("clicked"));
    const snapshot = await BoundarySnapshot.load();
    assert.equal(snapshot.blocks(uri("clicked/memo.txt")), true);
    assert.equal(snapshot.blocks(uri("other.txt")), false);
    assert.ok(!stub.capturedText().includes(custom));
});

test("marking a new selection after edits cannot silently clear an older protection", async () => {
    await write("notes.txt", "private first\npublic second");
    await stub.openEditor(path.join(root, "notes.txt"), { from: 0, to: 0 });
    registerAIBoundaryCommands(context as never);
    await stub.commands.executeCommand("soterai.blockSelectionFromAI");
    const first = storedRules(stub.state.folders[0].uri.toString()).regions[0];
    assert.ok(first);

    const changed = "private first changed\nprivate second";
    await write("notes.txt", changed);
    await stub.openEditor(path.join(root, "notes.txt"), { from: 1, to: 1 });
    await stub.commands.executeCommand("soterai.blockSelectionFromAI");
    const rules = storedRules(stub.state.folders[0].uri.toString());
    assert.equal(rules.regions.length, 2);
    assert.deepEqual(rules.regions[0], first, "the earlier protection requires explicit removal");
    assert.equal((await BoundarySnapshot.load()).sanitize(uri("notes.txt"), changed), OMITTED);
});

test("multi-root .aiignore rules do not bleed between identically named paths", async () => {
    await write("one/.aiignore", "memo.txt");
    await write("one/memo.txt", custom);
    await write("two/memo.txt", "public");
    stub.state.folders = ["one", "two"].map((name, index) => ({ uri: stub.Uri.file(path.join(root, name)), name, index }));
    const snapshot = await BoundarySnapshot.load();
    assert.equal(snapshot.blocks(uri("one/memo.txt")), true);
    assert.equal(snapshot.blocks(uri("two/memo.txt")), false);
});

test("corrupt manual state denies instead of silently discarding a region", async () => {
    await context.workspaceState.update(RULES_KEY, { [stub.state.folders[0].uri.toString()]: { regions: "broken", paths: [] } });
    assert.equal((await BoundarySnapshot.load()).blocks(uri("public.txt")), true);
    assert.throws(() => storedRules(stub.state.folders[0].uri.toString()));
});

test("fake provider keys never survive a normal file into a safe context bundle", async () => {
    await write("app.txt", `ordinary example\n${fakeKey}`);
    stub.openTab(path.join(root, "app.txt"));
    const safe = buildSafeContext(await gatherContext(), DEFAULT_PROJECT_POLICY);
    assert.ok(!JSON.stringify(safe).includes(fakeKey));
    assert.ok(safe.safeText.includes("ordinary example"));
});


test("concurrent manual rule updates preserve each deny across roots", async () => {
    const roots = [stub.state.folders[0].uri.toString(), "file:///another-root"];
    await Promise.all(Array.from({ length: 20 }, (_, index) => updateRules(roots[index % 2], rules => {
        rules.paths.push({ kind: "file", pattern: "private-" + index + ".txt" });
        return rules;
    })));
    for (const rootKey of roots) assert.equal(storedRules(rootKey).paths.length, 10);
});

test("selection-only overlap removes protected bytes without losing adjacent public text", () => {
    const text = "public PRIVATE public";
    const regions = [{ path: "notes.txt", digest: documentDigest(text), start: 7, end: 14 }];
    assert.equal(redactRegions("notes.txt", text, regions, 3, 10), "lic " + OMITTED);
    assert.equal(redactRegions("notes.txt", text, regions, 8, 12), OMITTED);
    assert.equal(redactRegions("notes.txt", text, regions, 14, text.length), " public");
});

test("accepted repository denies survive deletion, replacement and a fresh snapshot", async () => {
    await write("memo.txt", custom);
    await write(".aiignore", "memo.txt");
    assert.equal((await BoundarySnapshot.load()).blocks(uri("memo.txt")), true);
    await fs.unlink(path.join(root, ".aiignore"));
    initializeBoundaryState(context.workspaceState as never);
    assert.equal((await BoundarySnapshot.load()).blocks(uri("memo.txt")), true);
    await write(".soterai/policy.json", '{"protectedFiles":["reports/**"]}');
    assert.equal((await BoundarySnapshot.load()).blocks(uri("reports/a.txt")), true);
    await write(".soterai/policy.json", '{"protectedFiles":[],"aiContext":{"protectedFileAction":"allow"}}');
    assert.equal((await BoundarySnapshot.load()).blocks(uri("reports/a.txt")), true);
});

test("public policy update and save APIs cannot clear a deny; flag off withdraws sharing", async () => {
    const key = stub.state.folders[0].uri.toString();
    await saveRules(key, { paths: [{kind:"file",pattern:"memo.txt"}], regions: [] });
    await saveRules(key, { paths: [], regions: [] });
    await updateRules(key, () => ({ paths: [], regions: [] }));
    assert.equal(storedRules(key).paths.length, 1);
    stub.state.config.set("soterai.hardening.addOnlyPolicy", false);
    assert.equal((await BoundarySnapshot.load()).blocks(uri("public.txt")), true);
    await assert.rejects(saveRules(key, {paths:[],regions:[]}));
    assert.equal(storedRules(key).paths.length, 1);
});

test("relaxation ignores command arguments and the obsolete modal cannot remove a permanent deny", async () => {
    const key = stub.state.folders[0].uri.toString();
    await saveRules(key, {paths:[{kind:"file",pattern:"memo.txt"}],regions:[]});
    registerAIBoundaryCommands(context as never);
    const methods: Array<{mock:{restore():void}}> = [
        mock.method(stub.window, "showWorkspaceFolderPick", async () => stub.state.folders[0]),
        mock.method(stub.window, "showQuickPick", async (items: Array<{label:string}>) => items[0]),
    ];
    try {
        await stub.commands.executeCommand("soterai.manageAIRules", { approved:true, remove:"memo.txt" });
        assert.equal(storedRules(key).paths.length,1);
        assert.match(stub.capturedText(), /not agent-proof/);
        methods.push(mock.method(stub.window,"showWarningMessage",async()=>"Relax this deny"));
        await stub.commands.executeCommand("soterai.manageAIRules");
        assert.equal(storedRules(key).paths.length,1);
    } finally { methods.forEach(m=>m.mock.restore()); }
});
