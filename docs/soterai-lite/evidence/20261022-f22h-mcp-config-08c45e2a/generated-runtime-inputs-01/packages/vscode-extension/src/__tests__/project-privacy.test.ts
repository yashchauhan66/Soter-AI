import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import * as stub from "./phase2/vscode-stub";
import { BoundarySnapshot, initializeBoundaryState, saveRules, storedRules } from "../ai-boundary/BoundarySnapshot";
import { buildSafeFileView, environmentSchema, terminalSafeText } from "../project-privacy/SafeFileView";
import { ProjectFileAccess, type CapturedFile, type AccessReceipt } from "../project-privacy/ProjectFileAccess";
import { ProjectReadTerminal, parseReadCommand } from "../project-privacy/ReadTerminal";
import { registerProjectPrivacyCommands, approvalMessage } from "../project-privacy/commands";
import { SENSITIVE_MARKS_KEY, parseSensitiveMarks } from "../project-privacy/SensitiveRestrictions";
import { projectPrivacyHtml, PROJECT_PRIVACY_ACTIONS, openProjectPrivacyPanel } from "../project-privacy/panel";

const syntheticValue = "TEST_ONLY_PROJECT_PRIVATE_VALUE_73921";
const fakeKey = "sk-proj-" + "FAKE_TEST_CREDENTIAL_73921".repeat(3);
const tick = () => new Promise<void>(done => setImmediate(done));
let root: string;
let context: ReturnType<typeof stub.makeExtensionContext>;
const uri = (rel: string) => stub.Uri.file(join(root, rel));
async function write(rel: string, text: string): Promise<void> {
    await mkdir(dirname(join(root, rel)), { recursive: true });
    await writeFile(join(root, rel), text);
}

beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "soterai-project-privacy-"));
    stub.resetState(root);
    context = stub.makeExtensionContext(root);
    initializeBoundaryState(context.workspaceState as never);
    // Finish automatic default enrollment before this suite drives render events.
    await BoundarySnapshot.load();
    Object.assign(stub.workspace, { registerTextDocumentContentProvider: () => new stub.Disposable() });
});
afterEach(async () => {
    context.subscriptions.forEach(item => item.dispose());
    mock.restoreAll();
    const target = resolve(root);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith("soterai-project-privacy-"));
    await rm(target, { recursive: true, force: true });
});

test("dotenv safe views preserve names and mask every value, comments and multiline text", () => {
    const input = `# ${syntheticValue}\nDATABASE_URL=postgresql://fake:fake@db.invalid/private\nexport API_KEY="${fakeKey}"\nPORT=7\nEMPTY=\nMULTILINE="first\n${syntheticValue}\nlast"\nDATABASE_URL=second\ninvalid line ${syntheticValue}`;
    for (const name of [".env", "nested/.ENV.local", "nested\\.env.production", ".env.example"]) {
        const result = buildSafeFileView(name, input);
        assert.equal(result.kind, "environment-schema");
        assert.equal(result.text, "DATABASE_URL=[MASKED]\nAPI_KEY=[MASKED]\nPORT=[MASKED]\nEMPTY=[MASKED]\nMULTILINE=[MASKED]");
        assert.equal(result.fieldCount, 5);
        assert.ok(!JSON.stringify(result).includes(syntheticValue));
        assert.ok(!JSON.stringify(result).includes(fakeKey));
        assert.doesNotMatch(result.text, /db\.invalid|postgresql|first|second|last/);
    }
});

test("unsupported dotenv lines never return the original text", () => {
    assert.match(environmentSchema(syntheticValue).text, /withheld/);
    assert.throws(() => environmentSchema("X=" + "x".repeat(65_536)));
    assert.throws(() => environmentSchema("X=\0secret"));
    assert.throws(() => environmentSchema(Array.from({ length: 257 }, (_, i) => `K${i}=x`).join("\n")));
});

test("assignment-looking secret text inside quoted multiline values never becomes a field name", () => {
    for (const quote of ["'", '"', "`"] ) {
        const input = `MULTILINE=${quote}first\n${syntheticValue}=private\n${quote}\nPUBLIC_FIELD=7`;
        assert.equal(environmentSchema(input).text, "MULTILINE=[MASKED]\nPUBLIC_FIELD=[MASKED]");
        assert.equal(environmentSchema(`MULTILINE=${quote}unfinished\n${syntheticValue}=private`).text,
            "MULTILINE=[MASKED]");
    }
    const escaped = 'MULTILINE="first\\"still open\n' + syntheticValue + '=private\nlast"\nPUBLIC_FIELD=7';
    assert.equal(environmentSchema(escaped).text, "MULTILINE=[MASKED]\nPUBLIC_FIELD=[MASKED]");
});

test("sensitive formats and marked ordinary files stay wholly masked; public controls remain useful", () => {
    for (const name of ["private.pem", ".npmrc", ".claude/settings.json", "config/secrets.yaml", "id_ed25519"]) {
        assert.equal(buildSafeFileView(name, syntheticValue).kind, "sensitive-summary");
        assert.ok(!buildSafeFileView(name, syntheticValue).text.includes(syntheticValue));
    }
    assert.equal(buildSafeFileView("memo.txt", syntheticValue, true).kind, "sensitive-summary");
    assert.equal(buildSafeFileView("public.txt", "Public documentation.").text, "Public documentation.");
    assert.ok(!buildSafeFileView("notes.txt", `API_KEY=${fakeKey}`).text.includes(fakeKey));
    assert.equal(terminalSafeText("public\x1b]52;abc\x07\nline\x9b"), "public]52;abc\nline");
});

function captured(overrides: Partial<CapturedFile> = {}): CapturedFile {
    return { workspace: "project-A", relativePath: ".env", policyRevision: "policy-1", fileIdentity: "file-1",
        content: `DATABASE_URL=${syntheticValue}`, regionView: `DATABASE_URL=${syntheticValue}`, sensitive: true, ...overrides };
}

test("access receipts contain metadata only; cancellation releases no text", async () => {
    let receipt!: AccessReceipt;
    const access = new ProjectFileAccess({ enabled: () => true, now: () => 0, capture: async () => captured(),
        confirm: async item => { receipt = item; return false; } });
    assert.deepEqual(await access.request(".env", "integration-command"), { status: "DENIED" });
    assert.ok(!JSON.stringify(receipt).includes(syntheticValue));
    assert.ok(!approvalMessage(receipt).includes(syntheticValue));
    assert.match(approvalMessage(receipt), /not agent-proof/);
    assert.match(approvalMessage(receipt), /identity is not OS-verified/);
});

test("each successful read requires a fresh approval and gives only the safe view", async () => {
    let prompts = 0;
    const access = new ProjectFileAccess({ enabled: () => true, now: () => 0, capture: async () => captured(),
        confirm: async () => { prompts++; return true; } });
    for (let i = 0; i < 2; i++) assert.deepEqual(await access.request(".env", "managed-read-terminal"),
        { status: "ALLOWED_ONCE", kind: "environment-schema", text: "DATABASE_URL=[MASKED]" });
    assert.equal(prompts, 2);
});

for (const field of ["workspace", "relativePath", "policyRevision", "fileIdentity", "content", "regionView", "sensitive"] as const) {
    test(`changed ${field} invalidates approval instead of releasing a new snapshot`, async () => {
        let approved = false;
        const after = { ...captured(), [field]: field === "sensitive" ? false : "different" };
        const access = new ProjectFileAccess({ enabled: () => true, now: () => 0,
            capture: async () => approved ? after : captured(), confirm: async () => { approved = true; return true; } });
        assert.deepEqual(await access.request(".env", "safe-preview"), { status: "CHANGED" });
    });
}

for (const withdrawal of ["flag", "revoke", "dispose", "expiry", "invalid-clock"] as const) {
    test(`${withdrawal} while a native approval is pending releases nothing`, async () => {
        let enabled = true; let now = 0;
        let finish!: (value: boolean) => void;
        const access = new ProjectFileAccess({ enabled: () => enabled, now: () => now, capture: async () => captured(),
            confirm: () => new Promise<boolean>(done => { finish = done; }) });
        const pending = access.request(".env", "safe-preview"); await tick();
        if (withdrawal === "flag") enabled = false;
        else if (withdrawal === "revoke") access.revoke();
        else if (withdrawal === "dispose") access.dispose();
        else now = withdrawal === "expiry" ? 60_000 : NaN;
        finish(true);
        assert.deepEqual(await pending, { status: "EXPIRED" });
    });
}

test("duplicate requests do not create a second modal and filesystem errors stay private", async () => {
    let finish!: (value: boolean) => void; let prompts = 0;
    const access = new ProjectFileAccess({ enabled: () => true, now: () => 0, capture: async () => captured(),
        confirm: () => { prompts++; return new Promise<boolean>(done => { finish = done; }); } });
    const pending = access.request(".env", "safe-preview"); await tick();
    assert.deepEqual(await access.request("other", "safe-preview"), { status: "BUSY" });
    assert.equal(prompts, 1); finish(false); await pending;
    const broken = new ProjectFileAccess({ enabled: () => true, now: () => 0,
        capture: async () => { throw new Error(syntheticValue); }, confirm: async () => true });
    assert.deepEqual(await broken.request(".env", "safe-preview"), { status: "UNAVAILABLE" });
});

test("actual command adapter masks environment values and retains an ordinary-file deny after approval", async () => {
    await write(".env", `DATABASE_URL=${syntheticValue}\nPORT=7`);
    await write("restricted.txt", `Public operation notes. API_KEY=${fakeKey}`);
    await saveRules(stub.state.folders[0].uri.toString(), { paths: [{ kind: "file", pattern: "restricted.txt" }], regions: [] });
    const prompts: string[] = [];
    mock.method(stub.window, "showWarningMessage", async (text: string) => { prompts.push(text); return "Allow safe read once"; });
    registerProjectPrivacyCommands(context as never);
    const env = await stub.commands.executeCommand("soterai.readProjectFileSafely", uri(".env")) as { status: string; text: string };
    assert.equal(env.status, "ALLOWED_ONCE"); assert.equal(env.text, "DATABASE_URL=[MASKED]\nPORT=[MASKED]");
    const ordinary = await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("restricted.txt")) as { status: string; text: string };
    assert.equal(ordinary.status, "ALLOWED_ONCE"); assert.match(ordinary.text, /Public operation notes/); assert.ok(!ordinary.text.includes(fakeKey));
    assert.equal(storedRules(stub.state.folders[0].uri.toString()).paths.length, 1);
    assert.equal((await BoundarySnapshot.load()).blocks(uri("restricted.txt") as never), true);
    assert.equal(prompts.length, 2);
    assert.ok(!stub.capturedText().includes(syntheticValue)); assert.ok(!stub.capturedText().includes(fakeKey));
});

test("actual command adapter refuses invalid policy, history, outside-project and fabricated approvals", async () => {
    await write("public.txt", "Public control.");
    await write(".git/config", syntheticValue);
    registerProjectPrivacyCommands(context as never);
    assert.deepEqual(await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("public.txt"), { approved: true, raw: true }), { status: "DENIED" });
    assert.deepEqual(await stub.commands.executeCommand("soterai.readProjectFileSafely", { uri: uri("public.txt"), approved: true }), { status: "DENIED" });
    assert.deepEqual(await stub.commands.executeCommand("soterai.readProjectFileSafely", uri(".git/config")), { status: "UNAVAILABLE" });
    assert.deepEqual(await stub.commands.executeCommand("soterai.readProjectFileSafely", stub.Uri.file(join(root, "../outside.txt"))), { status: "UNAVAILABLE" });
    await write(".aiignore", "!invalid");
    assert.deepEqual(await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("public.txt")), { status: "UNAVAILABLE" });
});

test("actual adapter rejects a file changed during approval and disables the route on rollback", async () => {
    await write("restricted.txt", "Before.");
    registerProjectPrivacyCommands(context as never);
    mock.method(stub.window, "showWarningMessage", async () => { await write("restricted.txt", "After."); return "Allow safe read once"; });
    assert.deepEqual(await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("restricted.txt")), { status: "CHANGED" });
    stub.state.config.set("soterai.projectPrivacy.enabled", false);
    assert.deepEqual(await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("restricted.txt")), { status: "UNAVAILABLE" });
});

test("actual adapter rejects a policy changed during approval and applies protected regions", async () => {
    const text = `Public ${syntheticValue} end.`;
    await write("ordinary.txt", text);
    const { documentDigest } = await import("../ai-boundary/policy");
    await saveRules(stub.state.folders[0].uri.toString(), { paths: [], regions: [{ path: "ordinary.txt",
        digest: documentDigest(text), start: 7, end: 7 + syntheticValue.length }] });
    registerProjectPrivacyCommands(context as never);
    const dialog = mock.method(stub.window, "showWarningMessage", async () => "Allow safe read once");
    const result = await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("ordinary.txt")) as { status: string; text: string };
    assert.equal(result.status, "ALLOWED_ONCE"); assert.ok(!result.text.includes(syntheticValue));
    dialog.mock.restore();
    mock.method(stub.window, "showWarningMessage", async () => { await write(".aiignore", "new-private/**"); return "Allow safe read once"; });
    // Accepted policy changes now revoke the pending request before its recapture can release content.
    const withheld = await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("ordinary.txt"));
    assert.deepEqual(withheld, { status: "EXPIRED" });
    assert.ok(!JSON.stringify(withheld).includes(syntheticValue));
});

test("marking an ordinary file sensitive saves metadata-only denies and keeps approved output masked", async () => {
    await write("ordinary.txt", syntheticValue);
    registerProjectPrivacyCommands(context as never);
    await stub.commands.executeCommand("soterai.restrictSensitiveFile", uri("ordinary.txt"));
    mock.method(stub.window, "showWarningMessage", async () => "Allow safe read once");
    const result = await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("ordinary.txt")) as { text: string };
    assert.match(result.text, /MASKED/); assert.ok(!result.text.includes(syntheticValue));
    assert.deepEqual(storedRules(stub.state.folders[0].uri.toString()).paths, [{ kind: "file", pattern: "ordinary.txt", sensitive: true }]);
    assert.equal(context.workspaceState.get(SENSITIVE_MARKS_KEY), undefined);
    assert.ok(!stub.capturedText().includes(syntheticValue));
    assert.throws(() => parseSensitiveMarks({ root: ["../outside"] }, "root"));
});

test("all shared credential-bearing paths are denied in default managed collection", async () => {
    const snapshot = await BoundarySnapshot.load();
    for (const name of [".env", "nested/.env.local", ".npmrc", ".mcp.json", ".claude/settings.json", ".cursor/mcp.json", ".kube/config"])
        assert.equal(snapshot.blocks(uri(name) as never), true, name);
    assert.equal(snapshot.blocks(uri("public.ts") as never), false);
});

test("managed read terminal executes only its read grammar and suppresses post-close output", async () => {
    let reads = 0; let revoked = 0; let finish!: (result: { status: "ALLOWED_ONCE"; kind: "environment-schema"; text: string }) => void;
    const pty = new ProjectReadTerminal(async () => { reads++; return new Promise(done => { finish = done; }); }, () => { revoked++; });
    const output: string[] = []; pty.onDidWrite(text => output.push(text)); pty.open();
    pty.handleInput("unsupported-command\r"); assert.equal(reads, 0);
    pty.handleInput("read .env\r"); await tick(); assert.equal(reads, 1);
    assert.ok(!output.join("").includes(syntheticValue));
    pty.close(); const before = output.join("");
    finish({ status: "ALLOWED_ONCE", kind: "environment-schema", text: "DATABASE_URL=[MASKED]" }); await tick();
    assert.equal(output.join(""), before); assert.equal(revoked, 1);
    assert.equal(parseReadCommand("read nested/.env"), "nested/.env");
    assert.equal(parseReadCommand("help"), undefined);
});

test("oversized terminal input cannot execute a trailing read after truncation", async () => {
    let reads = 0;
    const pty = new ProjectReadTerminal(async () => { reads++; return { status: "DENIED" }; }, () => {});
    pty.handleInput("x".repeat(4097) + "read .env\r"); await tick();
    assert.equal(reads, 0); pty.close();
});

test("privacy page escapes metadata, compiles its script and exposes honest, accessible actions", () => {
    const html = projectPrivacyHtml({ enabled: true, trusted: true, projects: ['<img src=x onerror="synthetic()">'],
        restrictions: [{ project: "Example", label: '<script>synthetic()</script>', sensitive: true }], unavailable: false }, "unitnonce");
    assert.match(html, /&lt;img/); assert.doesNotMatch(html, /<img src=x/); assert.doesNotMatch(html, /<script>synthetic/);
    assert.match(html, /Covers/); assert.match(html, /Does not cover/); assert.match(html, /not agent-proof/);
    assert.match(html, /focus-visible/); assert.match(html, /forced-colors/); assert.match(html, /aria-live="polite"/);
    assert.match(html, /default-src 'none'/);
    for (const action of Object.keys(PROJECT_PRIVACY_ACTIONS)) assert.ok(html.includes(`data-action="${action}"`));
    const script = html.match(/<script nonce="unitnonce">([\s\S]*?)<\/script>/)?.[1];
    assert.ok(script); assert.doesNotThrow(() => new Function(script));
    const disabled = projectPrivacyHtml({ enabled: false, trusted: true, projects: ["Example"], restrictions: [], unavailable: false }, "unitnonce");
    assert.match(disabled, /Safe reader unavailable/); assert.match(disabled, /disabled aria-disabled="true"/);
});

test("privacy page host accepts only fixed actions, rejects extra payload and serializes native reviews", async () => {
    let listener!: (value: unknown) => Promise<void>;
    let disposed!: () => void;
    let html = "";
    mock.method(stub.window, "createWebviewPanel", () => ({
        title: "Synthetic privacy page", webview: { get html() { return html; }, set html(value: string) { html = value; },
            onDidReceiveMessage: (receive: typeof listener) => { listener = receive; return new stub.Disposable(); } },
        onDidDispose: (close: () => void) => { disposed = close; return new stub.Disposable(); },
        reveal() {}, dispose() { disposed(); },
    }) as never);
    let calls = 0; let finish!: () => void;
    stub.commands.registerCommand("soterai.reviewSafeFileAccess", async () => { calls++; await new Promise<void>(done => { finish = done; }); });
    openProjectPrivacyPanel(context as never);
    await listener({ type: "reviewRead", approved: true });
    await listener({ type: "__proto__" });
    assert.equal(calls, 0);
    const first = listener({ type: "reviewRead" });
    await listener({ type: "reviewRead" }); assert.equal(calls, 1);
    finish(); await first;
    assert.match(html, /data-completed-action="reviewRead"/);
    assert.match(html, /No completion status was returned/);
    assert.match(html, /no success is confirmed/);
});
