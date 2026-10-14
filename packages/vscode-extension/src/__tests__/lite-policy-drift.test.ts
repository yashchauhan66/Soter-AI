import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import * as stub from "./phase2/vscode-stub";
import { BoundarySnapshot, initializeBoundaryState, RULES_KEY, updateRules } from "../ai-boundary/BoundarySnapshot";
import { OMITTED } from "../ai-boundary/policy";
import { checkPolicyDrift, compareDrift, parseDriftBaseline } from "../ai-boundary/PolicyDrift";

// Synthetic metadata and temporary files only. No host, timers or normal user profile.
// The filesystem and Memento stub supply plumbing; the real boundary owns decisions.
const BASELINE_KEY = "soterai.lite.policyDrift.v1";
const FLAG = "soterai.lite.policyDrift";
const A = "a".repeat(64), B = "b".repeat(64), C = "c".repeat(64);
const baseline = (roots: Record<string, string> = {}) => ({ schemaVersion: 1, roots });

test("F03-D01 the strict baseline parser accepts only versioned root digests", () => {
    const source = baseline({ "file:///synthetic/a": A, "file:///synthetic/b": B });
    const parsed = parseDriftBaseline(source);
    assert.equal(parsed.schemaVersion, 1);
    assert.deepEqual(Object.entries(parsed.roots), Object.entries(source.roots));
    assert.deepEqual(Object.entries(parseDriftBaseline(baseline()).roots), []);
    for (const raw of [undefined, null, [], "{}", {}, { roots: {} }, { schemaVersion: 2, roots: {} },
        { schemaVersion: 1, roots: [] }, { schemaVersion: 1, roots: null }, { schemaVersion: 1, roots: {}, extra: true },
        Object.assign(new Date(0), source)]) {
        assert.throws(() => parseDriftBaseline(raw));
    }
});

test("F03-D02 baseline digests reject source text, wrong lengths and non-hex values", () => {
    for (const digest of ["SYNTHETIC_SOURCE_VALUE", "a".repeat(63), "a".repeat(65), "g".repeat(64), 12, null, {}, []]) {
        assert.throws(() => parseDriftBaseline({ schemaVersion: 1, roots: { "file:///synthetic": digest } }));
    }
    const roots = Object.assign(new Date(0), { "file:///synthetic": A });
    assert.throws(() => parseDriftBaseline({ schemaVersion: 1, roots }));
});

test("F03-D03 the baseline has a 64-root limit", () => {
    const roots = Object.fromEntries(Array.from({ length: 64 }, (_, index) => [`file:///synthetic/${index}`, A]));
    assert.equal(Object.keys(parseDriftBaseline(baseline(roots)).roots).length, 64);
    assert.throws(() => parseDriftBaseline(baseline({ ...roots, "file:///synthetic/overflow": A })));
});

test("F03-D04 the baseline byte limit measures UTF-8 serialization", () => {
    const overhead = Buffer.byteLength(JSON.stringify(baseline({ "": A })), "utf8");
    const root = "r".repeat(32768 - overhead);
    assert.equal(Buffer.byteLength(JSON.stringify(baseline({ [root]: A })), "utf8"), 32768);
    assert.equal(Object.keys(parseDriftBaseline(baseline({ [root]: A })).roots).length, 1);
    assert.throws(() => parseDriftBaseline(baseline({ [root + "r"]: A })));
    const multibyte = baseline({ ["\u00e9".repeat(17000)]: A });
    assert.ok(JSON.stringify(multibyte).length < 32768);
    assert.throws(() => parseDriftBaseline(multibyte));
});

test("F03-D05 comparison sorts each root category and keeps changed separate from additions and removals", () => {
    const previous = parseDriftBaseline(baseline({ z: A, b: A, same: C, goneZ: A, goneA: B }));
    const current = parseDriftBaseline(baseline({ same: C, b: B, z: C, newZ: A, newA: B }));
    assert.deepEqual(compareDrift(previous, current), {
        changed: ["b", "z"], added: ["newA", "newZ"], removed: ["goneA", "goneZ"],
    });
    assert.deepEqual(compareDrift(current, current), { changed: [], added: [], removed: [] });
    assert.deepEqual(compareDrift(parseDriftBaseline(baseline()), current), {
        changed: [], added: ["b", "newA", "newZ", "same", "z"], removed: [],
    });
});

test("F03-D06 parsed baselines and comparisons do not mutate caller metadata", () => {
    const source = baseline({ one: A });
    const parsed = parseDriftBaseline(source);
    source.roots.one = B;
    assert.equal(parsed.roots.one, A);
    const before = JSON.stringify(parsed), next = parseDriftBaseline(baseline({ one: B, two: C }));
    const nextBefore = JSON.stringify(next);
    compareDrift(parsed, next);
    assert.equal(JSON.stringify(parsed), before);
    assert.equal(JSON.stringify(next), nextBefore);
});

let root: string;
let context: ReturnType<typeof stub.makeExtensionContext>;
let originalExtensions: unknown[];
const key = () => stub.state.folders[0].uri.toString();
const uri = (relative: string) => stub.Uri.file(join(root, relative));
async function write(relative: string, text: string) {
    await mkdir(dirname(join(root, relative)), { recursive: true });
    await writeFile(join(root, relative), text);
}
async function establishBaseline() {
    await BoundarySnapshot.load();
    assert.deepEqual(await checkPolicyDrift(context as never), { status: "BASELINE_SAVED" });
    return structuredClone(context.workspaceState.get(BASELINE_KEY));
}
function assertMetadataOnly(...forbidden: string[]) {
    const text = JSON.stringify(context.workspaceState.get(BASELINE_KEY)) + stub.capturedText();
    for (const value of forbidden) assert.ok(!text.includes(value), "Source/config values must never enter baseline or alert sinks.");
    const stored = parseDriftBaseline(context.workspaceState.get(BASELINE_KEY));
    for (const digest of Object.values(stored.roots)) assert.match(digest, /^[0-9a-f]{64}$/i);
}

beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "soterai-f03-drift-"));
    stub.resetState(root);
    context = stub.makeExtensionContext(root);
    initializeBoundaryState(context.workspaceState as never);
    originalExtensions = stub.extensions.all;
    stub.extensions.all = [];
    await write("public.txt", "Useful public control.");
    await write("private.txt", "SYNTHETIC_F03_PRIVATE_FILE_BYTES");
});

afterEach(async () => {
    mock.restoreAll();
    stub.extensions.all = originalExtensions;
    context.subscriptions.forEach(item => item.dispose());
    const target = resolve(root);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith("soterai-f03-drift-"));
    await rm(target, { recursive: true, force: true });
});

test("F03-D07 first check saves one bounded baseline and an unchanged check performs no redundant write", async () => {
    await BoundarySnapshot.load();
    const update = context.workspaceState.update;
    let writes = 0;
    mock.method(context.workspaceState, "update", async (name: string, value: unknown) => {
        if (name === BASELINE_KEY) writes++;
        await update(name, value);
    });
    assert.deepEqual(await checkPolicyDrift(context as never), { status: "BASELINE_SAVED" });
    const saved = structuredClone(context.workspaceState.get(BASELINE_KEY));
    assert.equal(writes, 1);
    assert.deepEqual(await checkPolicyDrift(context as never), { status: "UNCHANGED" });
    assert.equal(writes, 1);
    assert.deepEqual(context.workspaceState.get(BASELINE_KEY), saved);
    assert.deepEqual(Object.keys(parseDriftBaseline(saved).roots), [key()]);
});

test("F03-D08 manual rule metadata causes drift while retained denies and public reads remain enforced", async () => {
    await establishBaseline();
    await updateRules(key(), current => ({ ...current, paths: [{ kind: "file", pattern: "private.txt" }] }));
    const rules = structuredClone(context.workspaceState.get(RULES_KEY));
    assert.deepEqual(await checkPolicyDrift(context as never), { status: "DRIFT", changedRoots: [key()] });
    assert.deepEqual(context.workspaceState.get(RULES_KEY), rules);
    const snapshot = await BoundarySnapshot.load();
    assert.equal(await snapshot.read(uri("private.txt") as never), OMITTED);
    assert.equal(await snapshot.read(uri("public.txt") as never), "Useful public control.");
    assert.deepEqual(await checkPolicyDrift(context as never), { status: "UNCHANGED" });
});

test("F03-D09 a selected safety setting change causes drift and public provider values never enter alerts", async () => {
    await establishBaseline();
    stub.state.config.set("soterai.projectPrivacy.safeViewComposition", false);
    const privateSetting = "SYNTHETIC_F03_PROVIDER_VALUE_NEVER_AUDIT";
    stub.state.config.set("soterai.broker.openAIProviderUrl", privateSetting);
    assert.deepEqual(await checkPolicyDrift(context as never), { status: "DRIFT", changedRoots: [key()] });
    assertMetadataOnly(privateSetting);
    assert.deepEqual(await checkPolicyDrift(context as never), { status: "UNCHANGED" });
});

test("F03-D10 public extension version changes cause drift while extension ordering does not", async () => {
    stub.extensions.all = [
        { id: "synthetic.ai-z", packageJSON: { version: "1.0.0" } },
        { id: "synthetic.ai-a", packageJSON: { version: "2.0.0" } },
    ];
    await establishBaseline();
    stub.extensions.all.reverse();
    assert.deepEqual(await checkPolicyDrift(context as never), { status: "UNCHANGED" });
    stub.extensions.all = [
        { id: "synthetic.ai-a", packageJSON: { version: "2.1.0" } },
        { id: "synthetic.ai-z", packageJSON: { version: "1.0.0" } },
    ];
    assert.deepEqual(await checkPolicyDrift(context as never), { status: "DRIFT", changedRoots: [key()] });
    assert.deepEqual(await checkPolicyDrift(context as never), { status: "UNCHANGED" });
});

test("F03-D11 changed policy source bytes cause drift without copying ignored text into metadata or alerts", async () => {
    const sourceValue = "SYNTHETIC_F03_SOURCE_COMMENT_NEVER_AUDIT";
    await write(".aiignore", "private.txt\n");
    await establishBaseline();
    await write(".aiignore", "private.txt\n# " + sourceValue + "\n");
    stub.resetSinks();
    assert.deepEqual(await checkPolicyDrift(context as never), { status: "DRIFT", changedRoots: [key()] });
    assertMetadataOnly(sourceValue, "SYNTHETIC_F03_PRIVATE_FILE_BYTES");
    assert.equal(await (await BoundarySnapshot.load()).read(uri("private.txt") as never), OMITTED);
});

test("F03-D12 a failed initial baseline save reports failure and leaves permanent restrictions intact", async () => {
    await updateRules(key(), current => ({ ...current, paths: [{ kind: "file", pattern: "private.txt" }] }));
    await BoundarySnapshot.load();
    const rules = structuredClone(context.workspaceState.get(RULES_KEY));
    const update = context.workspaceState.update;
    mock.method(context.workspaceState, "update", async (name: string, value: unknown) => {
        if (name === BASELINE_KEY) throw new Error("SYNTHETIC_BASELINE_STORAGE_FAILURE");
        await update(name, value);
    });
    assert.deepEqual(await checkPolicyDrift(context as never), { status: "FAILED" });
    assert.equal(context.workspaceState.get(BASELINE_KEY), undefined);
    assert.deepEqual(context.workspaceState.get(RULES_KEY), rules);
    assert.equal(await (await BoundarySnapshot.load()).read(uri("private.txt") as never), OMITTED);
});

test("F03-D13 failed drift persistence does not advance the baseline or acknowledge a saved change", async () => {
    const saved = await establishBaseline();
    stub.state.config.set("soterai.broker.autoStart", false);
    const update = context.workspaceState.update;
    mock.method(context.workspaceState, "update", async (name: string, value: unknown) => {
        if (name === BASELINE_KEY) throw new Error("SYNTHETIC_BASELINE_STORAGE_FAILURE");
        await update(name, value);
    });
    assert.deepEqual(await checkPolicyDrift(context as never), { status: "FAILED" });
    assert.deepEqual(context.workspaceState.get(BASELINE_KEY), saved);
});

test("F03-D14 malformed persisted metadata fails closed without silently replacing the baseline", async () => {
    await BoundarySnapshot.load();
    const corrupt = { schemaVersion: 99, roots: { [key()]: A } };
    await context.workspaceState.update(BASELINE_KEY, corrupt);
    const update = context.workspaceState.update;
    let baselineWrites = 0;
    mock.method(context.workspaceState, "update", async (name: string, value: unknown) => {
        if (name === BASELINE_KEY) baselineWrites++;
        await update(name, value);
    });
    assert.deepEqual(await checkPolicyDrift(context as never), { status: "FAILED" });
    assert.equal(baselineWrites, 0);
    assert.deepEqual(context.workspaceState.get(BASELINE_KEY), corrupt);
});

test("F03-D15 machine flag withdrawal stops monitoring while preserving baseline and accepted denies", async () => {
    await updateRules(key(), current => ({ ...current, paths: [{ kind: "file", pattern: "private.txt" }] }));
    const saved = await establishBaseline();
    const rules = structuredClone(context.workspaceState.get(RULES_KEY));
    stub.state.configInspect.set(FLAG, { defaultValue: true, globalValue: false, workspaceValue: true });
    assert.deepEqual(await checkPolicyDrift(context as never), { status: "UNAVAILABLE" });
    assert.deepEqual(context.workspaceState.get(BASELINE_KEY), saved);
    assert.deepEqual(context.workspaceState.get(RULES_KEY), rules);
    assert.equal(await (await BoundarySnapshot.load()).read(uri("private.txt") as never), OMITTED);
    assert.equal(await (await BoundarySnapshot.load()).read(uri("public.txt") as never), "Useful public control.");
});

test("F03-D16 workspace flag values cannot enable monitoring against a withdrawn machine flag", async () => {
    await BoundarySnapshot.load();
    stub.state.configInspect.set(FLAG, { defaultValue: false, workspaceValue: true, workspaceFolderValue: true });
    assert.deepEqual(await checkPolicyDrift(context as never), { status: "UNAVAILABLE" });
    assert.equal(context.workspaceState.get(BASELINE_KEY), undefined);
});

test("F03-D17 untrusted or absent workspace cannot create a monitoring baseline", async () => {
    await BoundarySnapshot.load();
    stub.state.isTrusted = false;
    assert.deepEqual(await checkPolicyDrift(context as never), { status: "UNAVAILABLE" });
    assert.equal(context.workspaceState.get(BASELINE_KEY), undefined);
    stub.state.isTrusted = true;
    stub.state.folders = [];
    assert.deepEqual(await checkPolicyDrift(context as never), { status: "UNAVAILABLE" });
    assert.equal(context.workspaceState.get(BASELINE_KEY), undefined);
});
