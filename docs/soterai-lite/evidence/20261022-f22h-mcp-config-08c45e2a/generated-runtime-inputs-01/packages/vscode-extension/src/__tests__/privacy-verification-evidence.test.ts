import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { mkdtemp, mkdir, writeFile, rm, truncate, link } from "node:fs/promises";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { captureLoadedBundleIdentity, evaluatePrivacyVerification, loadPrivacyVerification,
    parsePrivacyVerificationEvidence, type PrivacyVerificationEvidence } from "../project-privacy/VerificationEvidence";
import { privacyActionOutcome } from "../project-privacy/PrivacyActionOutcome";

const hash = "a".repeat(64);
const otherHash = "b".repeat(64);
function report(): PrivacyVerificationEvidence {
    return { schemaVersion: 1, generatedAt: "2026-10-12T00:00:00Z", artifact: { extensionSha256: hash },
        suites: [{ id: "managed-host", kind: "extension-host", scope: "Synthetic managed-reader controls only", passed: 2, failed: 0, skipped: 0 }],
        surfaces: [{ id: "managed-reader", status: "PASS", scope: "Synthetic approved-read controls only", suiteIds: ["managed-host"] }] };
}

test("bounded metadata parser preserves explicit scope and requires a complete passing referenced suite", () => {
    assert.deepEqual(parsePrivacyVerificationEvidence(JSON.stringify(report())), report());
    for (const mutate of [
        (item: PrivacyVerificationEvidence) => { item.suites[0].failed = 1; },
        (item: PrivacyVerificationEvidence) => { item.suites[0].skipped = 1; },
        (item: PrivacyVerificationEvidence) => { item.suites[0].passed = 0; },
        (item: PrivacyVerificationEvidence) => { item.surfaces[0].suiteIds = []; },
        (item: PrivacyVerificationEvidence) => { item.surfaces[0].suiteIds = ["missing-suite"]; },
    ]) {
        const invalid = report(); mutate(invalid);
        assert.throws(() => parsePrivacyVerificationEvidence(JSON.stringify(invalid)));
    }
});

test("parser rejects unexpected keys, controls, oversized collections and malformed hashes/counts", () => {
    const controls: unknown[] = [null, [], { ...report(), secrets: "not allowed" },
        { ...report(), artifact: { extensionSha256: otherHash, filename: "arbitrary-path" } },
        { ...report(), artifact: { extensionSha256: "not-a-hash" } },
        { ...report(), schemaVersion: 2 }, { ...report(), generatedAt: "yesterday" },
        { ...report(), suites: Array(33).fill(report().suites[0]) },
        { ...report(), suites: [{ ...report().suites[0], scope: "line\ncontrol" }] },
        { ...report(), suites: [{ ...report().suites[0], passed: -1 }] },
        { ...report(), suites: [{ ...report().suites[0], passed: 1.5 }] },
        { ...report(), suites: [{ ...report().suites[0], passed: 1_000_001 }] },
        { ...report(), suites: [{ ...report().suites[0], kind: "assert-everything-safe" }] },
        { ...report(), suites: [report().suites[0], report().suites[0]] },
        { ...report(), surfaces: [{ ...report().surfaces[0], status: "PROTECTED" }] },
        { ...report(), surfaces: [{ ...report().surfaces[0], id: "unknown-surface" }] },
        { ...report(), surfaces: [report().surfaces[0], report().surfaces[0]] },
    ];
    for (const invalid of controls) assert.throws(() => parsePrivacyVerificationEvidence(JSON.stringify(invalid)));
    assert.throws(() => parsePrivacyVerificationEvidence("x".repeat(65_537)), /Oversized/);
});

test("FAIL cannot be asserted without a referenced failure; partial evidence may explicitly report INCOMPLETE", () => {
    const item = report(); item.surfaces[0].status = "FAIL";
    assert.throws(() => parsePrivacyVerificationEvidence(JSON.stringify(item)), /failing check/);
    item.suites[0].failed = 1;
    assert.equal(parsePrivacyVerificationEvidence(JSON.stringify(item)).surfaces[0].status, "FAIL");
    item.surfaces[0].status = "INCOMPLETE"; item.surfaces[0].suiteIds = [];
    assert.equal(parsePrivacyVerificationEvidence(JSON.stringify(item)).surfaces[0].status, "INCOMPLETE");
});

test("matching hashes enable only the explicitly reported managed host scope and never the full claim", () => {
    const state = evaluatePrivacyVerification({ path: "synthetic", sha256: hash }, hash, report());
    assert.equal(state.state, "MATCHED"); assert.equal(state.fullClaim, "BLOCKED");
    assert.equal(state.surfaces.find(item => item.id === "managed-reader")?.status, "PASS");
    assert.equal(state.surfaces.find(item => item.id === "cline-tools")?.status, "UNMANAGED");
    assert.equal(state.surfaces.find(item => item.id === "os-isolation")?.status, "NOT_TESTED");
});

test("report mismatch or modified current bundle withdraws all passing coverage without erasing reported counts", () => {
    for (const [loaded, installed] of [[hash, otherHash], [otherHash, otherHash], [otherHash, hash]]) {
        const state = evaluatePrivacyVerification({ path: "synthetic", sha256: loaded }, installed, report());
        assert.equal(state.state, "MISMATCH"); assert.ok(!state.surfaces.some(item => item.status === "PASS"));
        assert.equal(state.suites[0].passed, 2); assert.equal(state.fullClaim, "BLOCKED");
    }
});

test("missing loaded identity and local unit PASS cannot turn into live managed coverage", () => {
    const missing = evaluatePrivacyVerification(undefined, hash, report());
    assert.equal(missing.state, "UNAVAILABLE"); assert.ok(!missing.surfaces.some(item => item.status === "PASS"));
    const unit = report(); unit.suites[0].kind = "unit";
    const state = evaluatePrivacyVerification({ path: "synthetic", sha256: hash }, hash, unit);
    assert.equal(state.state, "MATCHED");
    assert.equal(state.surfaces.find(item => item.id === "managed-reader")?.status, "NOT_TESTED");
});

test("external CLI compatibility is labelled separately and cannot establish managed-reader or OS coverage", () => {
    const item = report(); item.suites[0].kind = "agent-cli";
    item.suites[0].scope = "Public synthetic context compatibility only; no tool routing or isolation tested";
    assert.equal(parsePrivacyVerificationEvidence(JSON.stringify(item)).suites[0].kind, "agent-cli");
    const state = evaluatePrivacyVerification({ path: "synthetic", sha256: hash }, hash, item);
    assert.equal(state.surfaces.find(surface => surface.id === "managed-reader")?.status, "NOT_TESTED");
    assert.equal(state.surfaces.find(surface => surface.id === "os-isolation")?.status, "NOT_TESTED");
    assert.equal(state.fullClaim, "BLOCKED");
});

test("PASS promotion independently requires every referenced control to be complete and positive", () => {
    for (const incomplete of ["failed", "skipped", "zero", "missing-reference"] as const) {
        const item = report();
        item.suites.push({ id: "additional-control", kind: "unit", scope: "Additional synthetic positive control", passed: 1, failed: 0, skipped: 0 });
        item.surfaces[0].suiteIds.push("additional-control");
        if (incomplete === "failed") item.suites[1].failed = 1;
        else if (incomplete === "skipped") item.suites[1].skipped = 1;
        else if (incomplete === "zero") item.suites[1].passed = 0;
        else item.surfaces[0].suiteIds.push("unreported-control");
        const state = evaluatePrivacyVerification({ path: "synthetic", sha256: hash }, hash, item);
        assert.equal(state.state, "MATCHED");
        assert.equal(state.surfaces.find(surface => surface.id === "managed-reader")?.status, "NOT_TESTED");
    }
});

test("local reports cannot upgrade independent Cline, terminal, network, UI or OS surfaces to PASS", () => {
    const item = report();
    for (const id of ["cline-tools", "ordinary-terminal", "buffers-clipboard", "independent-network", "os-isolation", "trusted-runtime"] as const)
        item.surfaces.push({ id, status: "PASS", scope: "Incorrectly claimed local control", suiteIds: ["managed-host"] });
    const parsed = parsePrivacyVerificationEvidence(JSON.stringify(item));
    const state = evaluatePrivacyVerification({ path: "synthetic", sha256: hash }, hash, parsed);
    assert.deepEqual(state.surfaces.filter(surface => surface.status === "PASS").map(surface => surface.id), ["managed-reader"]);
});

test("bundle receipt captures actual bytes only from dist/extension.js and report absence stays explicit", async () => {
    const root = await mkdtemp(join(tmpdir(), "soterai-evidence-ui-"));
    try {
        await mkdir(join(root, "dist")); const file = join(root, "dist", "extension.js");
        const text = "// synthetic bundle fixture; never executed\n";
        await writeFile(file, text);
        assert.deepEqual(captureLoadedBundleIdentity(file), { path: resolve(file), sha256: createHash("sha256").update(text).digest("hex") });
        assert.equal(captureLoadedBundleIdentity(join(root, "uncompiled.ts")), undefined);
        assert.equal(loadPrivacyVerification(root).state, "MISSING");
        assert.equal(loadPrivacyVerification(root, false).state, "DISABLED");
        await mkdir(join(root, "verification"));
        await writeFile(join(root, "verification", "project-privacy-verification.json"), "invalid");
        assert.equal(loadPrivacyVerification(root).state, "INVALID");
        await writeFile(join(root, "verification", "project-privacy-verification.json"), JSON.stringify(report()));
        assert.equal(loadPrivacyVerification(root).state, "UNAVAILABLE"); // TS source imports are not a production loaded bundle.
    } finally {
        const target = resolve(root); assert.equal(dirname(target), resolve(tmpdir()));
        assert.ok(basename(target).startsWith("soterai-evidence-ui-"));
        await rm(target, { recursive: true, force: true });
    }
});

test("file-backed evidence rejects oversized bytes, malformed UTF-8 and oversized bundle metadata", async () => {
    const root = await mkdtemp(join(tmpdir(), "soterai-evidence-file-bound-"));
    try {
        await mkdir(join(root, "verification")); await mkdir(join(root, "dist"));
        const evidenceFile = join(root, "verification", "project-privacy-verification.json");
        const bundle = join(root, "dist", "extension.js");
        await writeFile(bundle, "// synthetic bounded bundle\n");
        await link(bundle, join(root, "bundle-hardlink.js"));
        assert.equal(captureLoadedBundleIdentity(bundle), undefined);
        await rm(join(root, "bundle-hardlink.js"));
        await writeFile(evidenceFile, Buffer.alloc(65_537, 32));
        assert.equal(loadPrivacyVerification(root).state, "INVALID");
        const malformed = Buffer.concat([Buffer.from(JSON.stringify(report()).replace("Synthetic managed-reader controls only", "PLACEHOLDER")), Buffer.from([0xff])]);
        await writeFile(evidenceFile, malformed); assert.equal(loadPrivacyVerification(root).state, "INVALID");
        await truncate(bundle, 32 * 1024 * 1024 + 1);
        assert.equal(captureLoadedBundleIdentity(bundle), undefined);
    } finally {
        const target = resolve(root); assert.equal(dirname(target), resolve(tmpdir()));
        assert.ok(basename(target).startsWith("soterai-evidence-file-bound-"));
        await rm(target, { recursive: true, force: true });
    }
});

test("descriptor reads are bounded and changed descriptor metadata withholds identity while closing the handle", async () => {
    const root = await mkdtemp(join(tmpdir(), "soterai-evidence-read-bound-"));
    const nativeFs = createRequire(__filename)("node:fs") as typeof import("node:fs");
    try {
        await mkdir(join(root, "dist")); const bundle = join(root, "dist", "extension.js");
        await writeFile(bundle, "// synthetic descriptor control\n");
        const originalRead = nativeFs.readSync; const originalStat = nativeFs.fstatSync; const originalClose = nativeFs.closeSync;
        let readBound = 0; let closes = 0; let stats = 0;
        mock.method(nativeFs, "readSync", (...args: unknown[]) => {
            const length = typeof args[3] === "number" ? args[3] : 0;
            readBound += length;
            return (originalRead as (...values: unknown[]) => number)(...args);
        });
        mock.method(nativeFs, "fstatSync", (...args: Parameters<typeof originalStat>) => {
            const value = (originalStat as (...values: unknown[]) => import("node:fs").Stats)(...args);
            stats++;
            if (stats === 2) value.size++;
            return value;
        });
        mock.method(nativeFs, "closeSync", (descriptor: number) => { closes++; originalClose(descriptor); });
        assert.equal(captureLoadedBundleIdentity(bundle), undefined);
        assert.ok(readBound <= 2 * Buffer.byteLength("// synthetic descriptor control\n") + 2);
        assert.equal(closes, 1);
    } finally {
        mock.restoreAll();
        const target = resolve(root); assert.equal(dirname(target), resolve(tmpdir()));
        assert.ok(basename(target).startsWith("soterai-evidence-read-bound-"));
        await rm(target, { recursive: true, force: true });
    }
});

test("known action statuses distinguish completion, withholding, failure and an unreported result", () => {
    for (const status of ["SAVED", "REVOKED", "OPENED", "PREPARED", "PREVIEWED", "ALLOWED_ONCE"])
        assert.equal(privacyActionOutcome({ status }).state, "completed");
    for (const status of ["CANCELLED", "DENIED", "CHANGED", "EXPIRED", "BUSY", "UNAVAILABLE"])
        assert.equal(privacyActionOutcome({ status }).state, "withheld");
    assert.equal(privacyActionOutcome({ status: "FAILED" }).state, "failed");
    assert.equal(privacyActionOutcome(undefined, true).state, "failed");
    for (const value of [undefined, null, true, "success", { status: "REQUEST_HANDLED" }, { text: "private-tool-text" }]) {
        const result = privacyActionOutcome(value);
        assert.equal(result.state, "unknown"); assert.match(result.message, /no success is confirmed/);
        assert.ok(!result.message.includes("private-tool-text"));
    }
});
