import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import * as stub from "./phase2/vscode-stub";
import { BoundarySnapshot, initializeBoundaryState, onDidChangeBoundaryRules, saveRules, storedRules } from "../ai-boundary/BoundarySnapshot";
import { openProjectPrivacyPanel, projectPrivacyHtml, type ProjectPrivacyFacts } from "../project-privacy/panel";
import { evaluatePrivacyVerification, type PrivacyVerificationEvidence } from "../project-privacy/VerificationEvidence";

let root: string;
let context: ReturnType<typeof stub.makeExtensionContext>;
let html: string;
let listener: (value: unknown) => Promise<void>;
beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "soterai-professional-ui-")); stub.resetState(root);
    context = stub.makeExtensionContext(root); initializeBoundaryState(context.workspaceState as never);
    // Complete automatic F02 enrollment before this suite's render event tests.
    await BoundarySnapshot.load();
    html = "";
    mock.method(stub.window, "createWebviewPanel", () => {
        let disposed = () => {};
        return { webview: { get html() { return html; }, set html(value: string) { html = value; },
            onDidReceiveMessage: (receive: typeof listener) => { listener = receive; return new stub.Disposable(); } },
            onDidDispose: (close: () => void) => { disposed = close; return new stub.Disposable(); },
            reveal() {}, dispose() { disposed(); } } as never;
    });
});
afterEach(async () => {
    context.subscriptions.forEach(item => item.dispose()); mock.restoreAll();
    const target = resolve(root); assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith("soterai-professional-ui-"));
    await rm(target, { recursive: true, force: true });
});
const facts = (overrides: Partial<ProjectPrivacyFacts> = {}): ProjectPrivacyFacts => ({ enabled: true, trusted: true,
    projects: ["Example"], restrictions: [], unavailable: false, ...overrides });
const open = async () => { openProjectPrivacyPanel(context as never); await listener({ type: "refresh" }); };
const reg = (command: string, handler: () => unknown) => context.subscriptions.push(stub.commands.registerCommand(command, handler));

test("all restrictions remain in searchable metadata with pagination beyond the former 100-row cutoff", () => {
    const page = projectPrivacyHtml(facts({ restrictions: Array.from({ length: 260 }, (_, index) => ({ project: "Example",
        label: `file: synthetic-${index}.txt`, sensitive: index % 2 === 0 })) }), "unitnonce");
    assert.equal((page.match(/<tr data-restriction /g) ?? []).length, 260);
    assert.ok(page.includes("synthetic-259.txt")); assert.doesNotMatch(page, /first 100 restrictions/);
    assert.equal((page.match(/data-treatment="(?:sensitive|review)" hidden/g) ?? []).length, 235);
    assert.match(page, /id="restriction-search"/); assert.match(page, /id="restriction-treatment"/);
    assert.match(page, /id="previous-page"/); assert.match(page, /id="next-page"/);
    assert.match(page, /All saved manual restrictions are searchable/);
    const script = page.match(/<script nonce="unitnonce">([\s\S]*?)<\/script>/)?.[1];
    assert.ok(script); assert.doesNotThrow(() => new Function(script));
});

test("coverage precedes configured state and every local success retains the independent-tool limit", () => {
    const page = projectPrivacyHtml(facts({ completedAction: "restrictSensitive", outcome: { state: "completed", message: "Managed restriction saved." } }), "unitnonce");
    assert.ok(page.indexOf("<h2>Covers</h2>") < page.indexOf("Managed safe reader configured"));
    assert.ok(page.indexOf("<h2>Does not cover</h2>") < page.indexOf("Managed restriction saved."));
    assert.match(page, /Direct reads by Claude Code, Cline/); assert.match(page, /Full claim: BLOCKED/);
    assert.match(page, /NOT_TESTED — no authenticated loaded-version receipt/);
    assert.match(page, /not independent attestation/); assert.doesNotMatch(page, /Request handled/);
});

test("metadata escapes untrusted project, pattern, version and scope strings", () => {
    const injection = '<img src=x onerror="privateScript()">';
    const page = projectPrivacyHtml(facts({ projects: [injection], restrictions: [{ project: injection, label: injection, sensitive: true }],
        cline: { declaredVersion: injection, active: true } }), "unitnonce");
    assert.match(page, /&lt;img/); assert.doesNotMatch(page, /<img src=x/);
    assert.match(page, /default-src 'none'/); assert.match(page, /focus-visible/);
    assert.match(page, /forced-colors/); assert.match(page, /prefers-reduced-motion/);
    assert.match(page, /for="restriction-search"/); assert.match(page, /aria-live="polite"/);
});

test("hash mismatch displays counts as nonactive evidence and no live PASS", () => {
    const report: PrivacyVerificationEvidence = { schemaVersion: 1, generatedAt: "2026-10-12T00:00:00Z",
        artifact: { extensionSha256: "a".repeat(64) }, suites: [{ id: "unit", kind: "unit", scope: "Synthetic safe-view tests", passed: 4, failed: 0, skipped: 1 }],
        surfaces: [{ id: "managed-reader", status: "INCOMPLETE", scope: "Host execution missing", suiteIds: ["unit"] }] };
    const state = evaluatePrivacyVerification({ path: "synthetic", sha256: "b".repeat(64) }, "b".repeat(64), report);
    const page = projectPrivacyHtml(facts({ verification: state }), "unitnonce");
    assert.match(page, /Evidence: MISMATCH/); assert.match(page, /not accepted as active coverage/);
    assert.match(page, /<td>4<\/td><td>0<\/td><td>1<\/td>/);
    assert.doesNotMatch(page, /Reported PASS/);
});

test("professional presentation rollback leaves an honest read-only dashboard without action script", () => {
    const page = projectPrivacyHtml(facts({ presentationEnabled: false }), "unitnonce");
    assert.match(page, /dashboard disabled/); assert.match(page, /Backend managed restrictions are retained/);
    assert.match(page, /Covers/); assert.match(page, /Does not cover/); assert.match(page, /BLOCKED/);
    assert.doesNotMatch(page, /data-action=|<script/);
});

test("panel controller reports cancellation and command exceptions without a generic success or private error text", async () => {
    let result: unknown = { status: "CANCELLED" };
    reg("soterai.reviewSafeFileAccess", () => result);
    await open(); await listener({ type: "reviewRead" });
    assert.match(html, /data-outcome="withheld"/); assert.match(html, /cancelled or denied/);
    result = undefined; await listener({ type: "reviewRead" });
    assert.match(html, /No completion status was returned/); assert.match(html, /no success is confirmed/);
    reg("soterai.reviewSafeFileAccess", () => { throw new Error("SYNTHETIC_PRIVATE_TOOL_ERROR"); });
    await listener({ type: "reviewRead" });
    assert.match(html, /data-outcome="failed"/); assert.match(html, /Action failed/);
    assert.ok(!html.includes("SYNTHETIC_PRIVATE_TOOL_ERROR"));
});

test("panel controller serializes reviews, rejects expanded payloads and holds publication commands while the flag is off", async () => {
    let calls = 0; let finish!: (result: unknown) => void;
    reg("soterai.reviewSafeFileAccess", () => { calls++; return new Promise(done => { finish = done; }); });
    reg("soterai.preparePublicWorkspace", () => { calls++; return { status: "PREPARED" }; });
    await open();
    await listener({ type: "reviewRead", raw: true }); await listener({ type: "__proto__" });
    assert.equal(calls, 0);
    const pending = listener({ type: "reviewRead" }); await listener({ type: "reviewRead" });
    assert.equal(calls, 1); finish({ status: "DENIED" }); await pending;
    await listener({ type: "prepareWorkspace" }); assert.equal(calls, 1);
    assert.match(html, /route is unavailable/);
    stub.state.config.set("soterai.projectPrivacy.safePublication", true);
    await listener({ type: "prepareWorkspace" }); assert.equal(calls, 2);
    assert.match(html, /public workspace prepared/); assert.match(html, /OS isolation is not configured or verified/);
});

test("configuration flags withdraw reader UI without removing persistent sensitive rules", async () => {
    await saveRules(stub.state.folders[0].uri.toString(), { paths: [{ kind: "file", pattern: "private.txt", sensitive: true }], regions: [] });
    await open(); assert.match(html, /Managed safe reader configured/);
    stub.state.config.set("soterai.projectPrivacy.safeViewComposition", false);
    await listener({ type: "refresh" }); assert.match(html, /Safe reader unavailable/);
    assert.equal(storedRules(stub.state.folders[0].uri.toString()).paths[0].sensitive, true);
    stub.state.config.set("soterai.projectPrivacy.professionalUi", false);
    // An already-created page cannot call a privileged action after its presentation is disabled.
    let called = false; reg("soterai.reviewSafeFileAccess", () => { called = true; });
    await listener({ type: "reviewRead" }); assert.equal(called, false);
});

test("malformed repository policy withdraws configured status rather than showing a working reader", async () => {
    await writeFile(join(root, ".aiignore"), "!not-accepted\n");
    await open(); assert.match(html, /Safe reader unavailable/);
    assert.match(html, /Restriction metadata is unavailable/);
});

test("persistent rule-change event fires only after successful changed writes and carries root metadata", async () => {
    const rootUri = stub.state.folders[0].uri.toString(); const events: string[] = [];
    context.subscriptions.push(onDidChangeBoundaryRules(value => events.push(value)));
    await saveRules(rootUri, { paths: [{ kind: "file", pattern: "private.txt", sensitive: true }], regions: [] });
    assert.deepEqual(events, [rootUri]);
    await saveRules(rootUri, { paths: [{ kind: "file", pattern: "private.txt", sensitive: true }], regions: [] });
    assert.deepEqual(events, [rootUri]);
    mock.method(context.workspaceState, "update", async () => { throw new Error("synthetic failed save"); });
    await assert.rejects(saveRules(rootUri, { paths: [{ kind: "file", pattern: "second.txt" }], regions: [] }));
    assert.deepEqual(events, [rootUri]);
});

test("explicit refresh re-reads current roots, restrictions and Cline registry while keeping loaded receipt unknown", async () => {
    mock.method(stub.extensions, "getExtension", () => ({ packageJSON: { version: "4.1.23" }, isActive: true }) as never);
    await open(); assert.match(html, /4\.1\.23/); assert.match(html, /Active; interception is not established/);
    await saveRules(stub.state.folders[0].uri.toString(), { paths: [{ kind: "file", pattern: "new-public-policy.txt" }], regions: [] });
    await listener({ type: "refresh" }); assert.match(html, /new-public-policy.txt/);
    stub.state.folders = []; await listener({ type: "refresh" });
    assert.match(html, /Open a local project to begin/); assert.match(html, /Safe reader unavailable/);
    assert.match(html, /NOT_TESTED — no authenticated loaded-version receipt/);
});
