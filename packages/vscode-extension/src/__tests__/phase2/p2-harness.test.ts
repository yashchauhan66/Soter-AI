/**
 * PHASE 2 — harness self-test. Runs FIRST.
 *
 * If any assertion here fails, every other result in this suite is worthless:
 *   - the leak oracle must find a canary it is handed, in 7 encodings
 *   - the oracle must NOT fire on clean prose
 *   - the fixture must actually plant all 15 canaries on disk
 *   - `vscode` must resolve to the stub, so modules under test load at all
 *   - `@soterai/guard-core` must resolve to a FRESH dist (a stale dist would
 *     test code that is not in the repo)
 */
// Test-only loader: keep this probe runnable under the ordinary package test command.
import "./register.mjs";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { CANARIES, NONCE } from "./canaries";
import { findLeaks, oracleSelfTest } from "./leakOracle";
import { assertFixturePlanted, buildFixture } from "./fixture";
import { record } from "./results";

test("H1 leak oracle finds a canary in every encoding it claims to cover", () => {
    oracleSelfTest();
    record({
        id: "H1", invariant: "harness", scenario: "leak oracle self-test",
        expected: "detects plain/base64/hex/url/split/zero-width/reversed; silent on clean prose",
        actual: "all 7 encodings detected, no false positive on clean prose",
        evidence: "leakOracle.ts:oracleSelfTest()", severity: "Info", status: "PASS",
    });
});

test("H2 fixture plants all canaries on disk", async () => {
    const fixture = await buildFixture();
    try {
        await assertFixturePlanted(fixture);
        assert.equal(findLeaks(fs.readFileSync(path.join(fixture.root, ".env"), "utf8")).length > 0, true);
        record({
            id: "H2", invariant: "harness", scenario: "fixture workspace built",
            expected: `all ${CANARIES.length} canaries present on disk`,
            actual: `${fixture.files.length} files written; git=${fixture.gitInitialized}; symlink=${fixture.symlinkCreated}; hardlink=${fixture.hardlinkCreated}; junction=${fixture.junctionCreated}; caseSensitiveFs=${fixture.caseSensitiveFs}`,
            evidence: `nonce=${NONCE} root=${path.basename(fixture.root)}`,
            severity: "Info", status: "PASS",
        });
        // Honest record of what this machine could NOT set up.
        for (const [id, ok, what, why] of [
            ["H2a", fixture.symlinkCreated, "symlink into .env", "OS refused symlink creation (Windows needs Developer Mode or admin)"],
            ["H2b", fixture.gitInitialized, "repo with a secret in history", "git init/commit failed"],
            ["H2c", fixture.hardlinkCreated, "hardlink alias of .env", "fs.linkSync refused (non-NTFS volume?)"],
            ["H2d", fixture.junctionCreated, "directory junction into .ssh", "fs.symlinkSync(…,'junction') refused"],
            ["H2e", fixture.caseSensitiveFs, "two files differing only by case", "filesystem is case-INSENSITIVE; the case attack is tested at the matcher instead"],
        ] as Array<[string, boolean, string, string]>) {
            if (!ok) {
                record({
                    id, invariant: "harness", scenario: `fixture: ${what}`,
                    expected: `${what} created`, actual: `NOT TESTED — ${why}`,
                    evidence: "fixture.ts", severity: "Info", status: "SKIP",
                });
            }
        }
    } finally {
        await fixture.dispose();
    }
});

test("H3 `vscode` resolves to the stub and modules under test load", async () => {
    const vscodeMod = await import("vscode");
    assert.equal(typeof (vscodeMod as { recordSink?: unknown }).recordSink, "function",
        "`vscode` did not resolve to vscode-stub.ts — the loader interception is broken");
    const gatherer = await import("../../firewall/ContextGatherer");
    assert.equal(typeof gatherer.gatherContext, "function");
    assert.equal(typeof gatherer.setProtectedFileChecker, "function");
    const guard = await import("../../workspace-guard/WorkspaceGuard");
    assert.equal(typeof guard.WorkspaceGuard, "function");
    record({
        id: "H3", invariant: "harness", scenario: "vscode stub interception",
        expected: "ContextGatherer + WorkspaceGuard import outside a VS Code host",
        actual: "both loaded; `vscode` is vscode-stub.ts",
        evidence: "register.mjs patches Module._load (CJS) + Module.register (ESM)",
        severity: "Info", status: "PASS",
    });
});

test("H4 @soterai/guard-core resolves to a dist newer than its sources", async () => {
    const core = await import("@soterai/guard-core");
    assert.equal(typeof core.classifyPath, "function");
    assert.equal(typeof core.redactForSharing, "function");

    const coreRoot = path.resolve(__dirname, "../../../../guard-core");
    const distEntry = path.join(coreRoot, "dist", "index.js");
    assert.equal(fs.existsSync(distEntry), true, "guard-core dist/index.js missing — run its build");
    const distMtime = fs.statSync(distEntry).mtimeMs;

    const stale: string[] = [];
    const walk = (dir: string): void => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const abs = path.join(dir, e.name);
            if (e.isDirectory()) walk(abs);
            else if (e.name.endsWith(".ts") && fs.statSync(abs).mtimeMs > distMtime) {
                stale.push(path.relative(coreRoot, abs));
            }
        }
    };
    walk(path.join(coreRoot, "src"));

    record({
        id: "H4", invariant: "harness", scenario: "guard-core dist freshness",
        expected: "no src/**/*.ts newer than dist/index.js",
        actual: stale.length === 0 ? "dist is fresh" : `STALE: ${stale.slice(0, 5).join(", ")}`,
        evidence: `${distEntry} mtime vs ${stale.length} newer sources`,
        severity: stale.length === 0 ? "Info" : "High",
        status: stale.length === 0 ? "PASS" : "FAIL",
    });
    assert.equal(stale.length, 0,
        `guard-core dist is stale; tests would measure old code. Newer sources: ${stale.join(", ")}`);
});

test("H5 git is available (several scenarios shell out to it)", () => {
    let version = "";
    try {
        version = execFileSync("git", ["--version"], { encoding: "utf8" }).trim();
    } catch { /* recorded below */ }
    record({
        id: "H5", invariant: "harness", scenario: "git availability",
        expected: "git on PATH", actual: version || "git NOT available",
        evidence: version || "execFileSync('git') threw",
        severity: "Info", status: version ? "PASS" : "SKIP",
    });
});
