import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, link, symlink } from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";
import * as stub from "./phase2/vscode-stub";
import { initializeBoundaryState, updateRules } from "../ai-boundary/BoundarySnapshot";
import { documentDigest } from "../ai-boundary/policy";
import { registerPublicWorkspaceCommands } from "../project-privacy/publication/commands";

let root: string;
let source: string;
let context: ReturnType<typeof stub.makeExtensionContext>;
const fakeSecret = "sk-proj-" + "SYNTHETIC_TEST_KEY_ONLY_48171".repeat(3);
const openWindow = stub.window as typeof stub.window & { showOpenDialog: (...args: unknown[]) => Promise<stub.Uri[] | undefined> };
const priorDialog = Object.getOwnPropertyDescriptor(stub.window, "showOpenDialog");

beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "soterai-publication-command-unit-"));
    source = path.join(root, "source");
    await mkdir(source);
    stub.resetState(source);
    context = stub.makeExtensionContext(source);
    initializeBoundaryState(context.workspaceState as never);
    stub.state.config.set("soterai.projectPrivacy.safePublication", true);
    Object.defineProperty(stub.window, "showOpenDialog", { configurable: true, writable: true,
        value: async () => undefined });
    registerPublicWorkspaceCommands(context as never);
});
afterEach(async () => {
    context.subscriptions.forEach(value => value.dispose());
    mock.restoreAll();
    if (priorDialog) Object.defineProperty(stub.window, "showOpenDialog", priorDialog);
    else delete (stub.window as unknown as { showOpenDialog?: unknown }).showOpenDialog;
    assert.equal(path.dirname(path.resolve(root)), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith("soterai-publication-command-unit-"));
    await rm(root, { recursive: true, force: true });
});
const uri = (relative: string) => stub.Uri.file(path.join(source, relative));
async function write(relative: string, text: string) {
    await mkdir(path.dirname(path.join(source, relative)), { recursive: true });
    await writeFile(path.join(source, relative), text);
}
function choose(selected: string[]) {
    let count = 0;
    mock.method(openWindow, "showOpenDialog", async () => ++count === 1 ? selected.map(uri) : [stub.Uri.file(root)]);
}
function approve() {
    mock.method(stub.window, "showWarningMessage", async () => "Publish reviewed snapshot" as never);
}
const prepare = () => stub.commands.executeCommand("soterai.preparePublicWorkspace") as Promise<{ status: string; destination?: string }>;

test("native command positive control publishes selected public code with known secrets redacted and source unchanged", async () => {
    const original = `export const greeting = 'Public hello';\nconst API_KEY="${fakeSecret}";\n`;
    await write("app.ts", original);
    choose(["app.ts"]); approve();
    const result = await prepare();
    assert.equal(result.status, "PREPARED");
    const output = await readFile(path.join(result.destination!, "app.ts"), "utf8");
    assert.match(output, /Public hello/);
    assert.ok(!output.includes(fakeSecret));
    assert.equal(await readFile(path.join(source, "app.ts"), "utf8"), original);
    const manifest = await readFile(path.join(result.destination!, "soterai-publication-manifest.json"), "utf8");
    assert.match(manifest, /NO ISOLATION/);
    assert.ok(!manifest.includes(fakeSecret));
    assert.ok(!JSON.stringify(stub.sinks).includes(fakeSecret));
});

test("native selection cannot publish a manually denied regular file", async () => {
    await write("private.ts", "SYNTHETIC_PRIVATE_DENIED_ONLY");
    await updateRules(stub.state.folders[0].uri.toString(), () => ({ paths: [{ kind: "file", pattern: "private.ts" }], regions: [] }));
    choose(["private.ts"]); approve();
    assert.deepEqual(await prepare(), { status: "FAILED" });
    assert.deepEqual(await readdir(root), ["source"]);
    assert.ok(!JSON.stringify(stub.sinks).includes("SYNTHETIC_PRIVATE_DENIED_ONLY"));
});

test("repository-classified sensitive files are withheld even when their configured treatment is redact", async () => {
    await write("domain.txt", "SYNTHETIC_BUSINESS_PRIVATE_VALUE");
    await write(".soterai/policy.json", JSON.stringify({ sensitivePaths: ["domain.txt"], aiContext: { sensitivePathAction: "redact" } }));
    choose(["domain.txt"]); approve();
    assert.deepEqual(await prepare(), { status: "FAILED" });
    assert.deepEqual(await readdir(root), ["source"]);
    assert.ok(!JSON.stringify(stub.sinks).includes("SYNTHETIC_BUSINESS_PRIVATE_VALUE"));
});

test("ordinary selected code retains public context while protected regions stay withheld", async () => {
    const prefix = "export const greeting = 'public';\n";
    const hidden = "SYNTHETIC_REGION_PRIVATE_VALUE";
    const original = prefix + hidden + "\nexport const count = 1;\n";
    await write("app.ts", original);
    await updateRules(stub.state.folders[0].uri.toString(), () => ({ paths: [],
        regions: [{ path: "app.ts", start: prefix.length, end: prefix.length + hidden.length, digest: documentDigest(original) }] }));
    choose(["app.ts"]); approve();
    const result = await prepare();
    assert.equal(result.status, "PREPARED");
    const output = await readFile(path.join(result.destination!, "app.ts"), "utf8");
    assert.match(output, /greeting = 'public'/);
    assert.match(output, /count = 1/);
    assert.ok(!output.includes(hidden));
    assert.equal(await readFile(path.join(source, "app.ts"), "utf8"), original);
});

test("environment selection exposes only approved keys and synthetic values, never raw original values or unapproved keys", async () => {
    await write(".env", `DATABASE_URL=postgresql://original-private.invalid/fixture\nAPI_KEY=${fakeSecret}\n`);
    choose([".env"]); approve();
    let picks = 0;
    mock.method(stub.window, "showQuickPick", async () => ++picks === 1 ? [{ label: "DATABASE_URL" }] as never : { preset: "text" } as never);
    const result = await prepare();
    assert.equal(result.status, "PREPARED");
    assert.ok(!(await readdir(result.destination!)).includes(".env"));
    const environment = await readFile(path.join(result.destination!, ".env.example"), "utf8");
    assert.equal(environment, "# Synthetic development examples only; no original values.\nDATABASE_URL=SOTERAI_SYNTHETIC_VALUE\n");
    assert.ok(!environment.includes("API_KEY"));
    const sinks = JSON.stringify(stub.sinks);
    assert.ok(!sinks.includes("original-private.invalid"));
    assert.ok(!sinks.includes(fakeSecret));
});

test("native approved-name development-defaults selection produces fixed synthetic values only", async () => {
    await write(".env", "PORT=8452\nDATABASE_URL=postgresql://original-private.invalid/fixture\nAPI_URL=https://original-private.invalid/endpoint\n");
    choose([".env"]); approve();
    let picks = 0;
    mock.method(stub.window, "showQuickPick", async () => ++picks === 1
        ? [{ label: "PORT" }, { label: "DATABASE_URL" }, { label: "API_URL" }] as never : { preset: "local-defaults" } as never);
    const result = await prepare();
    assert.equal(result.status, "PREPARED");
    const environment = await readFile(path.join(result.destination!, ".env.example"), "utf8");
    assert.match(environment, /PORT=3000/);
    assert.match(environment, /DATABASE_URL=postgresql:\/\/soterai_fixture:soterai_fixture@127\.0\.0\.1/);
    assert.match(environment, /API_URL=http:\/\/127\.0\.0\.1:3000\/synthetic-only/);
    assert.doesNotMatch(environment, /8452|original-private/);
});

test("environment with protected regions is withheld before any schema parsing or publication", async () => {
    const original = "X=\"synthetic private\nASSIGNMENT_LOOKING_PRIVATE=value\n\"\n";
    await write(".env", original);
    await updateRules(stub.state.folders[0].uri.toString(), () => ({ paths: [],
        regions: [{ path: ".env", start: 0, end: 20, digest: documentDigest(original) }] }));
    choose([".env"]); approve();
    assert.deepEqual(await prepare(), { status: "FAILED" });
    assert.ok(!JSON.stringify(stub.sinks).includes("ASSIGNMENT_LOOKING_PRIVATE"));
});

test("preview returns PREVIEWED with safe metadata and creates no export folder", async () => {
    await write("public.txt", "Public documentation.");
    choose(["public.txt"]);
    const result = await stub.commands.executeCommand("soterai.previewDevelopmentContract") as { status: string };
    assert.equal(result.status, "PREVIEWED");
    assert.deepEqual(await readdir(root), ["source"]);
    assert.match(JSON.stringify(stub.sinks), /NO ISOLATION/);
});

test("cancellation at native approval creates no public files", async () => {
    await write("public.txt", "Public documentation.");
    choose(["public.txt"]);
    assert.deepEqual(await prepare(), { status: "CANCELLED" });
    assert.deepEqual(await readdir(root), ["source"]);
});

test("feature flag and workspace trust disable public preparation before reading source files", async () => {
    let dialogs = 0;
    mock.method(openWindow, "showOpenDialog", async () => { dialogs++; return [uri("never-read.txt")]; });
    stub.state.config.set("soterai.projectPrivacy.safePublication", false);
    assert.deepEqual(await prepare(), { status: "UNAVAILABLE" });
    stub.state.config.set("soterai.projectPrivacy.safePublication", true);
    stub.state.isTrusted = false;
    assert.deepEqual(await prepare(), { status: "UNAVAILABLE" });
    assert.equal(dialogs, 0);
});

test("caller-supplied approval, path and secret arguments cannot replace native user selection", async () => {
    await write("public.txt", "Public documentation.");
    // Call the actual registered product handler; the generic stub executeCommand recorder itself records caller input.
    const handler = stub.registeredCommands.get("soterai.preparePublicWorkspace")!;
    const result = await handler({
        approved: true, path: "public.txt", destination: root, secret: fakeSecret,
    });
    assert.deepEqual(result, { status: "CANCELLED" });
    assert.deepEqual(await readdir(root), ["source"]);
    assert.ok(!JSON.stringify(stub.sinks).includes(fakeSecret));
});

test("history and credential paths fail before source content enters any preview", async () => {
    for (const file of [".git/config", ".npmrc", "control-auth-token"]) {
        await write(file, "SYNTHETIC_HISTORY_OR_CREDENTIAL_CONTENT");
        // Install a fresh test-controlled native choice for each request.
        mock.restoreAll();
        choose([file]); approve();
        assert.deepEqual(await prepare(), { status: "FAILED" });
        assert.ok(!JSON.stringify(stub.sinks).includes("SYNTHETIC_HISTORY_OR_CREDENTIAL_CONTENT"));
    }
});

test("multiple hardlinks are withheld by the real source reader", async () => {
    await write("public.txt", "Public documentation.");
    await link(path.join(source, "public.txt"), path.join(source, "public-copy.txt"));
    choose(["public-copy.txt"]); approve();
    assert.deepEqual(await prepare(), { status: "FAILED" });
});

test("file symlink aliases are withheld by the real source reader", async t => {
    await write("public.txt", "Public documentation.");
    try { await symlink(path.join(source, "public.txt"), path.join(source, "public-alias.txt"), "file"); }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EPERM") { t.skip("OS denied synthetic file-symlink creation; assertion UNTESTED."); return; }
        throw error;
    }
    choose(["public-alias.txt"]); approve();
    assert.deepEqual(await prepare(), { status: "FAILED" });
});
