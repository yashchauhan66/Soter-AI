/**
 * PHASE 2 — I1/I2: does protected content reach an AI context bundle?
 *
 * This file drives the REAL `gatherContext()` and the REAL `buildSafeContext()`
 * over the fixture workspace, then runs the leak oracle over the bundle that
 * would be handed to a model. The only PASS is an empty oracle result.
 *
 * Every scenario names the file:line it attacks.
 */
// Test-only loader: keep this probe runnable under the ordinary package test command.
import "./register.mjs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { buildSafeContext, DEFAULT_PROJECT_POLICY, parseProjectPolicy, type ContextItem } from "@soterai/guard-core";
import { CUSTOM_CANARIES, canaryById } from "./canaries";
import { describeLeaks, findLeaks } from "./leakOracle";
import { buildFixture, type Fixture } from "./fixture";
import { record, recordFinding } from "./results";
import * as stub from "./vscode-stub";
import { gatherContext, setProtectedFileChecker } from "../../firewall/ContextGatherer";
import { WorkspaceGuard } from "../../workspace-guard/WorkspaceGuard";

let fixture: Fixture;

test.before(async () => {
    fixture = await buildFixture();
});
test.after(async () => {
    await fixture?.dispose();
});

/** Fresh per-scenario VS Code state pointed at the fixture. */
function reset(): void {
    stub.resetState(fixture.root);
    setProtectedFileChecker(() => false); // default wiring: nothing protected
}

/** Turn gathered items into the text a model would actually receive. */
function bundleText(items: ContextItem[], policy = DEFAULT_PROJECT_POLICY): string {
    const safe = buildSafeContext(items, policy);
    // Everything the user-facing surfaces expose: the bundle AND the per-item
    // decisions (reason/preview strings are shown in the webview and copied).
    return [safe.safeText, JSON.stringify(safe.decisions)].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// S1 — git diff of a modified .env  (F-1)
// ─────────────────────────────────────────────────────────────────────────────

test("S1 a modified .env enters the bundle through the synthetic `git diff` item", async () => {
    reset();
    // WorkspaceGuard is ON and `.env` IS on the protected list — the strongest
    // configuration the product offers.
    const ctx = stub.makeExtensionContext(path.join(fixture.root, ".ext"));
    const guard = new WorkspaceGuard(ctx as never);
    await guard.addFile(".env");
    await guard.enable();
    setProtectedFileChecker((rel) => guard.isEnabled && guard.isProtected(rel));

    const items = await gatherContext();
    const diffItem = items.find((i) => i.kind === "git_diff");

    const rawLeaks = findLeaks(diffItem?.content ?? "");
    const bundleLeaks = findLeaks(bundleText(items));

    record({
        id: "S1a", invariant: "I1/I2",
        scenario: "gatherContext() with .env protected + modified; does the git_diff item carry .env content?",
        expected: "no .env content in any gathered item",
        actual: diffItem
            ? `git_diff item present, path="${diffItem.path}", canaries in raw content: ${describeLeaks(rawLeaks)}`
            : "no git_diff item produced",
        evidence: "ContextGatherer.ts:122 pushes path=\"git diff\"; the protected check at :65 keys on item.path, which matches no pattern",
        severity: "Critical",
        status: rawLeaks.length === 0 ? "PASS" : "FAIL",
    });

    const held = recordFinding({
        id: "S1b", invariant: "I1",
        scenario: "…and does it survive into the SAFE bundle a model receives?",
        expected: "buildSafeContext output contains no canary in any encoding",
        actual: bundleLeaks.length === 0
            ? "bundle clean — the redaction denylist removed everything the diff carried"
            : `LEAKED: ${describeLeaks(bundleLeaks)}`,
        evidence: "SafeContextBuilder.ts:159 classifyPath(\"git diff\") → normal; :189 redactForSharing is the only barrier",
        severity: "Critical",
    }, bundleLeaks.length === 0);

    // The raw-item finding is recorded either way; the assertion is on the bundle,
    // which is what actually leaves for the model.
    assert.equal(held, true, `S1b: ${describeLeaks(bundleLeaks)}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// S2 — custom (non-vendor) data in the diff. Denylist cannot see it.
// ─────────────────────────────────────────────────────────────────────────────

test("S2 custom data in a protected file survives the diff path", async () => {
    reset();
    const ctx = stub.makeExtensionContext(path.join(fixture.root, ".ext"));
    const guard = new WorkspaceGuard(ctx as never);
    await guard.addFile(".env");
    await guard.enable();
    setProtectedFileChecker((rel) => guard.isEnabled && guard.isProtected(rel));

    const items = await gatherContext();
    const text = bundleText(items);
    // Only the CUSTOM family: values with no vendor prefix and no keyword.
    const customLeaks = findLeaks(text).filter((l) => CUSTOM_CANARIES.some((k) => k.id === l.canaryId));

    const held = recordFinding({
        id: "S2", invariant: "I1",
        scenario: "a non-vendor-shaped value (EXTRA_CANARY=CANARYCUSTOM…) inside the protected .env diff",
        expected: "no custom canary in the bundle",
        actual: customLeaks.length === 0 ? "no custom canary in bundle" : `LEAKED: ${describeLeaks(customLeaks)}`,
        evidence: "Redactor.ts:45 REDACTION_RULES is a vendor denylist; a value with no recognised shape matches nothing",
        severity: "Critical",
    }, customLeaks.length === 0);
    assert.equal(held, true, `S2: ${describeLeaks(customLeaks)}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// S3 — protected file as the ACTIVE EDITOR. The gate that is supposed to work.
// ─────────────────────────────────────────────────────────────────────────────

test("S3 a protected file open in the active editor is excluded", async () => {
    reset();
    const ctx = stub.makeExtensionContext(path.join(fixture.root, ".ext"));
    const guard = new WorkspaceGuard(ctx as never);
    await guard.addFile(".env");
    await guard.enable();
    setProtectedFileChecker((rel) => guard.isEnabled && guard.isProtected(rel));
    await stub.openEditor(path.join(fixture.root, ".env"), { from: 0, to: 6 });

    const items = await gatherContext();
    const leaks = findLeaks(bundleText(items));

    const held = recordFinding({
        id: "S3", invariant: "I1/I3",
        scenario: ".env is the active editor with a selection, protected + guard enabled",
        expected: "no .env content in the bundle",
        actual: leaks.length === 0 ? "excluded" : `LEAKED: ${describeLeaks(leaks)}`,
        evidence: "ContextGatherer.ts:65 protected check on asRelativePath(editor.document.uri)",
        severity: "Critical",
    }, leaks.length === 0);
    assert.equal(held, true, `S3: ${describeLeaks(leaks)}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// S4 — default configuration. protectedWorkspace ships DISABLED.
// ─────────────────────────────────────────────────────────────────────────────

test("S4 out-of-the-box (guard never enabled) a .env tab reaches the bundle", async () => {
    reset();
    // No WorkspaceGuard at all: `isProtectedPath` stays undefined, exactly as it
    // is until extension.ts:141 runs AND the user enables the feature.
    stub.openTab(path.join(fixture.root, ".env"));
    stub.openTab(path.join(fixture.root, "secrets.json"));
    stub.openTab(path.join(fixture.root, ".ssh", "id_rsa"));

    const items = await gatherContext();
    const policy = DEFAULT_PROJECT_POLICY;
    const safe = buildSafeContext(items, policy);
    const leaks = findLeaks([safe.safeText, JSON.stringify(safe.decisions)].join("\n"));

    // The DEFAULT PROJECT POLICY is the only barrier here. Record what it caught.
    const classified = safe.decisions.map((d) => `${d.path}=${d.level}`).join(" ");
    const held = recordFinding({
        id: "S4", invariant: "I1/I6",
        scenario: "default install: WorkspaceGuard off; .env, secrets.json, .ssh/id_rsa open as tabs",
        expected: "DEFAULT_PROJECT_POLICY blocks all three; no canary in bundle",
        actual: leaks.length === 0 ? `blocked by policy (${classified})` : `LEAKED: ${describeLeaks(leaks)} (${classified})`,
        evidence: "package.json soterai.protectedWorkspace.enabled default=false; ProjectPolicy.ts:60 protectedFiles defaults",
        severity: "Critical",
    }, leaks.length === 0);
    assert.equal(held, true, `S4: ${describeLeaks(leaks)}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// S5 — a secret inside an ALLOWED file (I4: redact before leaving)
// ─────────────────────────────────────────────────────────────────────────────

test("S5 an inline key inside an allowed source file is redacted", async () => {
    reset();
    stub.openTab(path.join(fixture.root, "src", "app.ts"));
    const items = await gatherContext();
    const text = bundleText(items);

    const vendorLeak = findLeaks(text).filter((l) => l.canaryId === "V-OPENAI");
    const customLeak = findLeaks(text).filter((l) => l.canaryId === "C-PLAIN");

    recordFinding({
        id: "S5a", invariant: "I4",
        scenario: "vendor-shaped key (sk-…) hardcoded in src/app.ts, an allowed path",
        expected: "redacted before the bundle is assembled",
        actual: vendorLeak.length === 0 ? "redacted" : `LEAKED: ${describeLeaks(vendorLeak)}`,
        evidence: "SafeContextBuilder.ts:189 redactForSharing; Redactor.ts:83 broad sk- rule",
        severity: "Critical",
    }, vendorLeak.length === 0);

    const customHeld = recordFinding({
        id: "S5b", invariant: "I4",
        scenario: "non-vendor value (partnerId) hardcoded in the same allowed file",
        expected: "redacted or blocked before leaving",
        actual: customLeak.length === 0 ? "removed" : `LEAKED: ${describeLeaks(customLeak)}`,
        evidence: "Redactor.ts:45 no rule matches a bare custom value; assignment rule at :95 requires a keyword key",
        severity: "High",
    }, customLeak.length === 0);

    assert.equal(vendorLeak.length, 0, `S5a: ${describeLeaks(vendorLeak)}`);
    assert.equal(customHeld, true, `S5b: ${describeLeaks(customLeak)}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// S6 — I2: do protected NAMES and env-var KEYS leak?
// ─────────────────────────────────────────────────────────────────────────────

test("S6 summarizeFile emits the env var KEY names of a sensitive file", async () => {
    reset();
    const envText = await fs.readFile(path.join(fixture.root, ".env"), "utf8");
    // Force the "sensitive" branch: a policy where .env is sensitive, not protected.
    const policy = parseProjectPolicy({
        protectedFiles: ["**/*.pem"],
        sensitivePaths: [".env"],
        aiContext: { sensitivePathAction: "approval_required" },
    });
    const safe = buildSafeContext([{ path: ".env", kind: "other", content: envText }], policy);

    const namesLeaked = /ANTHROPIC_API_KEY|GITHUB_TOKEN|DATABASE_URL|INTERNAL_PARTNER_ID/.test(safe.safeText);
    const valueLeaks = findLeaks([safe.safeText, JSON.stringify(safe.decisions)].join("\n"));

    record({
        id: "S6a", invariant: "I2",
        scenario: "a `sensitive` .env is summarized; are the KEY names included?",
        expected: "I2 says names/metadata must not leak unless the user allows it",
        actual: namesLeaked
            ? "KEY NAMES INCLUDED: summarizeFile lists every assignment key verbatim"
            : "no key names in the summary",
        evidence: "SafeContextBuilder.ts:113-119 summarizeFile → `Keys present (values omitted): …`",
        severity: "Medium",
        status: namesLeaked ? "FAIL" : "PASS",
    });

    const held = recordFinding({
        id: "S6b", invariant: "I1",
        scenario: "…do the VALUES survive the summary?",
        expected: "no canary value in the summary",
        actual: valueLeaks.length === 0 ? "values omitted" : `LEAKED: ${describeLeaks(valueLeaks)}`,
        evidence: "SafeContextBuilder.ts:115 captures only the key of `KEY=` lines",
        severity: "Critical",
    }, valueLeaks.length === 0);
    assert.equal(held, true, `S6b: ${describeLeaks(valueLeaks)}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// S7 — encoded secrets in an allowed file
// ─────────────────────────────────────────────────────────────────────────────

test("S7 encoded copies of a key in allowed files", async () => {
    const cases: Array<[string, string, string]> = [
        ["S7a", "encoded/base64.txt", "base64 of a vendor key"],
        ["S7b", "encoded/hex.txt", "hex of a vendor key"],
        ["S7c", "encoded/url.txt", "url-encoded vendor key"],
        ["S7d", "encoded/split.txt", "vendor key split across lines"],
        ["S7e", "encoded/zerowidth.txt", "vendor key with zero-width separators"],
        ["S7f", "encoded/concat.js", "vendor key as a JS array .join(\"\")"],
        ["S7g", "encoded/homoglyph.txt", "custom canary spelled with Cyrillic homoglyphs"],
    ];
    const failures: string[] = [];
    for (const [id, rel, what] of cases) {
        reset();
        stub.openTab(path.join(fixture.root, ...rel.split("/")));
        const items = await gatherContext();
        const leaks = findLeaks(bundleText(items));
        const ok = leaks.length === 0;
        record({
            id, invariant: "I1/I4",
            scenario: `${what} in an allowed file, opened as a tab`,
            expected: "the secret does not reach the bundle in any form",
            actual: ok ? "not recoverable from the bundle" : `LEAKED: ${describeLeaks(leaks)}`,
            evidence: "Redactor.ts REDACTION_RULES operate on literal text only; no decode-then-rescan on this path",
            severity: "High",
            status: ok ? "PASS" : "FAIL",
        });
        if (!ok) failures.push(`${id} ${rel}: ${describeLeaks(leaks)}`);
    }
    assert.equal(failures.length, 0, `encoded secrets reached the bundle:\n  ${failures.join("\n  ")}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// S8 — prompt injection in README / .cursorrules (attacker (b) and (c))
// ─────────────────────────────────────────────────────────────────────────────

test("S8 hostile README/.cursorrules are quarantined, not merged as instructions", async () => {
    reset();
    const items = await gatherContext();
    const readme = items.find((i) => i.path === "README.md");
    assert.ok(readme, "fixture README.md was not gathered");

    const safe = buildSafeContext(items, DEFAULT_PROJECT_POLICY);
    const readmeDecision = safe.decisions.find((d) => d.path === "README.md");
    const quarantined = readmeDecision?.injectionQuarantined === true;
    const payloadInBundle = /ignore all previous instructions/i.test(safe.safeText);

    record({
        id: "S8a", invariant: "I3",
        scenario: "README.md carries an HTML-comment injection telling the agent to read .env",
        expected: "quarantined; the payload text is not merged into the bundle",
        actual: `quarantined=${quarantined}; payload text present in safeText=${payloadInBundle}`,
        evidence: "SafeContextBuilder.ts:192-210 UNTRUSTED_KINDS + scanUntrusted → quarantine",
        severity: "High",
        status: quarantined && !payloadInBundle ? "PASS" : "FAIL",
    });

    // The injection names a canary; make sure quarantining did not copy it through.
    const leaks = findLeaks([safe.safeText, JSON.stringify(safe.decisions)].join("\n"));
    const held = recordFinding({
        id: "S8b", invariant: "I1",
        scenario: "…the injection text itself contains a canary value",
        expected: "no canary in bundle or causal chain",
        actual: leaks.length === 0 ? "clean" : `LEAKED: ${describeLeaks(leaks)}`,
        evidence: "SafeContextBuilder.ts:204 causalChain is built from detector labels, not content",
        severity: "High",
    }, leaks.length === 0);

    assert.equal(quarantined, true, "README injection was NOT quarantined");
    assert.equal(payloadInBundle, false, "injection payload text reached safeText");
    assert.equal(held, true, `S8b: ${describeLeaks(leaks)}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// S9 — hardlink and junction aliases of protected files (I3)
// ─────────────────────────────────────────────────────────────────────────────

test("S9 alias paths into the denied set", async () => {
    const failures: string[] = [];

    // S9a — hardlink: src/notes.txt IS .env (same inode, no symlink to detect).
    if (fixture.hardlinkCreated) {
        reset();
        const ctx = stub.makeExtensionContext(path.join(fixture.root, ".ext"));
        const guard = new WorkspaceGuard(ctx as never);
        await guard.addFile(".env");
        await guard.enable();
        setProtectedFileChecker((rel) => guard.isEnabled && guard.isProtected(rel));
        stub.openTab(path.join(fixture.root, "src", "notes.txt"));

        const items = await gatherContext();
        const leaks = findLeaks(bundleText(items));
        const ok = leaks.length === 0;
        record({
            id: "S9a", invariant: "I3",
            scenario: "src/notes.txt is a HARDLINK to the protected .env; opened as a tab",
            expected: "recognised as the protected file and excluded",
            actual: ok ? "no canary reached the bundle" : `LEAKED: ${describeLeaks(leaks)}`,
            evidence: "FileSystemPathPolicy.ts:12 rejectSymlinkComponents tests lstat().isSymbolicLink(); a hardlink is an ordinary file and realpath() returns its own path",
            severity: "High",
            status: ok ? "PASS" : "FAIL",
        });
        if (!ok) failures.push(`S9a hardlink: ${describeLeaks(leaks)}`);
    } else {
        record({
            id: "S9a", invariant: "I3", scenario: "hardlink alias of .env",
            expected: "excluded", actual: "NOT TESTED — hardlink could not be created",
            evidence: "fixture.hardlinkCreated=false", severity: "High", status: "SKIP",
        });
    }

    // S9b — junction: src/keys/ IS .ssh/.
    if (fixture.junctionCreated) {
        reset();
        const ctx = stub.makeExtensionContext(path.join(fixture.root, ".ext"));
        const guard = new WorkspaceGuard(ctx as never);
        await guard.addFile(".ssh/id_rsa");
        await guard.enable();
        setProtectedFileChecker((rel) => guard.isEnabled && guard.isProtected(rel));
        stub.openTab(path.join(fixture.root, "src", "keys", "id_rsa"));

        const items = await gatherContext();
        const leaks = findLeaks(bundleText(items));
        const ok = leaks.length === 0;
        record({
            id: "S9b", invariant: "I3",
            scenario: "src/keys/ is a DIRECTORY JUNCTION to .ssh/; src/keys/id_rsa opened as a tab",
            expected: "excluded (junction component rejected, or path canonicalized before matching)",
            actual: ok ? "no canary reached the bundle" : `LEAKED: ${describeLeaks(leaks)}`,
            evidence: "FileSystemPathPolicy.ts:63-66 rejectSymlinkComponents + isDirectoryAlias(dirname)",
            severity: "High",
            status: ok ? "PASS" : "FAIL",
        });
        if (!ok) failures.push(`S9b junction: ${describeLeaks(leaks)}`);
    } else {
        record({
            id: "S9b", invariant: "I3", scenario: "directory junction into .ssh",
            expected: "excluded", actual: "NOT TESTED — junction could not be created",
            evidence: "fixture.junctionCreated=false", severity: "High", status: "SKIP",
        });
    }

    assert.equal(failures.length, 0, `alias bypass:\n  ${failures.join("\n  ")}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// S10 — copy/rename to an unprotected name (the simplest bypass of all)
// ─────────────────────────────────────────────────────────────────────────────

test("S10 a copy of .env under an unprotected name", async () => {
    reset();
    const ctx = stub.makeExtensionContext(path.join(fixture.root, ".ext"));
    const guard = new WorkspaceGuard(ctx as never);
    await guard.addFile(".env");
    await guard.enable();
    setProtectedFileChecker((rel) => guard.isEnabled && guard.isProtected(rel));
    stub.openTab(path.join(fixture.root, "env-copy.txt"));

    const items = await gatherContext();
    const leaks = findLeaks(bundleText(items));
    const ok = leaks.length === 0;
    record({
        id: "S10", invariant: "I1/I3",
        scenario: "env-copy.txt holds the same key as .env under a name no pattern matches",
        expected: "content-based protection stops it even though the path is allowed",
        actual: ok ? "redaction removed it" : `LEAKED: ${describeLeaks(leaks)}`,
        evidence: "protection here is content-only: Redactor.ts REDACTION_RULES. Path matching cannot help.",
        severity: "High",
        status: ok ? "PASS" : "FAIL",
    });
    assert.equal(ok, true, `S10: ${describeLeaks(leaks)}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// S11 — nothing in this suite wrote a canary to a sink
// ─────────────────────────────────────────────────────────────────────────────

test("S11 no canary reached a recorded VS Code sink", () => {
    // Everything the stub captured across this file's scenarios: globalState,
    // workspaceState, webview html/postMessage, notifications, clipboard,
    // executeCommand args, output channels, untitled documents.
    const captured = stub.capturedText();
    const leaks = findLeaks(captured);
    const sinkNames = [...new Set(stub.sinks.map((s) => s.sink))].join(", ") || "none";
    const held = recordFinding({
        id: "S11", invariant: "I1/I7",
        scenario: "sweep every sink the stub recorded during S1–S10 for canaries",
        expected: "no canary in globalState, webview messages, notifications, clipboard or commands",
        actual: leaks.length === 0 ? `clean across sinks: ${sinkNames}` : `LEAKED: ${describeLeaks(leaks)}`,
        evidence: `vscode-stub.ts recordSink(); ${stub.sinks.length} sink writes observed`,
        severity: "Critical",
    }, leaks.length === 0);
    assert.equal(held, true, `S11: ${describeLeaks(leaks)}`);
});

// Keep an explicit reference so the import is not elided by a future refactor.
void canaryById;
