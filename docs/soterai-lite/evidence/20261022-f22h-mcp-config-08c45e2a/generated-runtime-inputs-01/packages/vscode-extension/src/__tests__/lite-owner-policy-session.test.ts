import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import * as stub from "./phase2/vscode-stub";
import {
    BoundarySnapshot, initializeBoundaryState, reviewRuleRelaxation,
    RULES_KEY, storedRules, updateRules, updateVersionedPolicy,
} from "../ai-boundary/BoundarySnapshot";
import { registerAIBoundaryCommands } from "../ai-boundary/commands";
import { registerProjectPrivacyCommands } from "../project-privacy/commands";
import { documentDigest, OMITTED, parseManualRules, type ManualRules } from "../ai-boundary/policy";
import { parseStoredPolicy, parseVersionedPolicy, type VersionedPolicy } from "../ai-boundary/VersionedPolicy";
import { checkPolicyDrift } from "../ai-boundary/PolicyDrift";

// Synthetic temporary files and scripted native UI are the entire test surface.
// No real user workspace, credentials, vendor config, profile or service is read.
const FLAG = "soterai.lite.policyDrift";
const START = 1_000_000;
const PRIVATE = "SYNTHETIC_F03_ORDINARY_PRIVATE_TEXT";
const SENSITIVE = "SYNTHETIC_F03_SENSITIVE_VALUE_NEVER_RELEASED";
const REGION = "SYNTHETIC_F03_REGION_ALWAYS_WITHHELD";
const REGION_TEXT = `Useful beginning. ${REGION} Useful ending.`;
type Audit = { schemaVersion: 1; records: Array<{ id: string; at: number; mode: string; ruleDigest: string; revisionDigest: string; outcome: string }> };
type Envelope = { schemaVersion: number; manual: ManualRules; policy: VersionedPolicy; reviewAudit?: Audit };
type Choice = { label: string; [key: string]: unknown };
type Provider = { provideTextDocumentContent(uri: stub.Uri): Promise<string> | string };
let root: string, context: ReturnType<typeof stub.makeExtensionContext>, now: number;
let folderCancelled: boolean, choiceCancelled: boolean, cancelledWarning: number;
let typed: "exact" | "wrong" | "cancel", advance: number, selectedPattern: string;
let inputCalls: number, warningCalls: number, choices: Choice[], providers: Map<string, Provider>, diffViews: string[];
let duringWarning: (() => Promise<void>) | undefined;
const windowOriginals = Object.getOwnPropertyDescriptors(stub.window);
const providerOriginal = Object.getOwnPropertyDescriptor(stub.workspace, "registerTextDocumentContentProvider");
const uri = (relative: string) => stub.Uri.file(join(root, relative));
const key = () => stub.state.folders[0].uri.toString();
const status = (result: unknown, expected: string) => assert.deepEqual(result, { status: expected });
const envelope = () => context.workspaceState.get<Record<string, Envelope>>(RULES_KEY, {})![key()];
const auditRecords = () => envelope().reviewAudit?.records ?? [];
const policy = (paths: unknown[] = [], sensitiveGlobs: string[] = []) => parseVersionedPolicy({
    schemaVersion: 1, presets: [], rules: { paths, regions: [] }, sensitiveGlobs,
});
async function write(relative: string, text: string): Promise<void> {
    await mkdir(dirname(join(root, relative)), { recursive: true });
    await writeFile(join(root, relative), text);
}
async function deny(relative = "memo.txt", sensitive = false): Promise<void> {
    await updateRules(key(), rules => ({ ...rules, paths: [...rules.paths,
        { kind: "file", pattern: relative, ...(sensitive ? { sensitive: true as const } : {}) }] }));
}
async function assertMemoDenied(): Promise<void> {
    const snapshot = await BoundarySnapshot.load();
    assert.equal(snapshot.blocks(uri("memo.txt") as never), true);
    assert.equal(await snapshot.read(uri("memo.txt") as never), OMITTED);
    assert.equal(await snapshot.read(uri("public.txt") as never), "Useful public control.");
}
async function assertMemoReleased(): Promise<BoundarySnapshot> {
    const snapshot = await BoundarySnapshot.load();
    assert.equal(snapshot.blocks(uri("memo.txt") as never), false);
    assert.equal(await snapshot.read(uri("memo.txt") as never), PRIVATE);
    assert.equal(await snapshot.read(uri("public.txt") as never), "Useful public control.");
    return snapshot;
}

beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "soterai-f03-session-"));
    stub.resetState(root); context = stub.makeExtensionContext(root); now = START;
    folderCancelled = false; choiceCancelled = false; cancelledWarning = 0;
    typed = "exact"; advance = 10_000; selectedPattern = "memo.txt";
    inputCalls = 0; warningCalls = 0; choices = []; duringWarning = undefined; providers = new Map(); diffViews = [];
    mock.method(Date, "now", () => now);
    Object.assign(stub.window, {
        showWorkspaceFolderPick: async () => folderCancelled ? undefined : stub.state.folders[0],
        showQuickPick: async (items: Choice[]) => {
            choices = items;
            return choiceCancelled ? undefined : items.find(item => item.label.includes(selectedPattern));
        },
        showWarningMessage: async (message: string, ...actions: unknown[]) => {
            stub.recordSink("notification", "owner-review", message);
            warningCalls++;
            if (duringWarning) { const action = duringWarning; duringWarning = undefined; await action(); }
            if (warningCalls === cancelledWarning) return undefined;
            // Every confirmation is explicitly supplied by this owner-UI fixture.
            return actions.find(action => typeof action === "string");
        },
        showInputBox: async (options: { prompt?: string }) => {
            inputCalls++; now += advance;
            if (typed === "cancel") return undefined;
            if (typed === "wrong") return "SYNTHETIC_INCORRECT_CONFIRMATION";
            assert.ok(options.prompt, "Native typed confirmation must expose its exact challenge.");
            return options.prompt.replace(/^Type exactly:\s*/, "");
        },
    });
    Object.assign(stub.workspace, { registerTextDocumentContentProvider: (scheme: string, provider: Provider) => {
        providers.set(scheme, provider); return new stub.Disposable();
    } });
    const execute = stub.commands.executeCommand.bind(stub.commands);
    mock.method(stub.commands, "executeCommand", async (id: string, ...args: unknown[]) => {
        if (id === "vscode.diff") {
            for (const arg of args.slice(0, 2)) {
                assert.ok(arg instanceof stub.Uri, "Native diff inputs must be owned synthetic review URIs.");
                assert.equal(arg.scheme, "soterai-owner-review");
                const provider = providers.get(arg.scheme); assert.ok(provider);
                diffViews.push(await provider.provideTextDocumentContent(arg));
            }
        }
        return execute(id, ...args);
    });
    await write("memo.txt", PRIVATE); await write("public.txt", "Useful public control.");
    await write("sensitive.txt", SENSITIVE); await write("region.txt", REGION_TEXT);
    await write(".env.owner", `DATABASE_URL=${SENSITIVE}\nPUBLIC_PORT=8080\n`);
    registerAIBoundaryCommands(context as never); registerProjectPrivacyCommands(context as never);
    await BoundarySnapshot.load(); await deny(); stub.resetSinks();
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
    assert.ok(basename(target).startsWith("soterai-f03-session-"));
    await rm(target, { recursive: true, force: true });
});

test("F03-S01 legacy relax-modal acceptance cannot remove a permanent deny without typed owner review", async () => {
    typed = "cancel";
    const before = structuredClone(storedRules(key()));
    status(await reviewRuleRelaxation(), "CANCELLED");
    assert.equal(inputCalls, 1);
    assert.deepEqual(storedRules(key()), before);
    assert.equal(auditRecords().length, 0);
    await assertMemoDenied();
});

test("F03-S02 completed review pauses only its selector and atomically audits without changing permanent policy", async () => {
    const manual = structuredClone(storedRules(key())), beforePolicy = structuredClone(envelope().policy);
    status(await stub.commands.executeCommand("soterai.manageAIRules"), "RELAXED_SESSION");
    assert.equal(inputCalls, 1);
    assert.ok(warningCalls >= 2, "Initial diff review and final session action need separate native confirmations.");
    await assertMemoReleased();
    assert.deepEqual(storedRules(key()), manual);
    assert.deepEqual(envelope().manual, manual);
    assert.deepEqual(envelope().policy, beforePolicy);
    assert.equal(envelope().schemaVersion, 3);
    assert.equal(auditRecords().length, 1);
    const record = auditRecords()[0];
    assert.equal(record.mode, "ordinary"); assert.equal(record.outcome, "REVIEWED_SESSION");
    assert.match(record.ruleDigest, /^[0-9a-f]{64}$/); assert.match(record.revisionDigest, /^[0-9a-f]{64}$/);
    assert.ok(!JSON.stringify(envelope()).includes(PRIVATE));
    assert.ok(stub.capturedText().includes("not agent-proof"));
});

test("F03-S03 owner review opens a real metadata diff without placing source contents in the diff", async () => {
    status(await reviewRuleRelaxation(), "RELAXED_SESSION");
    const diff = stub.sinks.find(record => record.sink === "executeCommand" && record.detail === "vscode.diff");
    assert.ok(diff, "Review must invoke the native diff command.");
    assert.equal(diffViews.length, 2);
    assert.notEqual(diffViews[0], diffViews[1]);
    assert.ok(diffViews.some(text => text.includes("memo.txt")));
    for (const text of diffViews) for (const marker of [PRIVATE, SENSITIVE, REGION]) assert.ok(!text.includes(marker));
});

test("F03-S04 a restart loses session permission even when its successful audit remains persisted", async () => {
    const permanent = structuredClone(storedRules(key()));
    status(await reviewRuleRelaxation(), "RELAXED_SESSION"); await assertMemoReleased();
    const reviewed = structuredClone(envelope());
    initializeBoundaryState(context.workspaceState as never);
    await assertMemoDenied();
    assert.deepEqual(storedRules(key()), permanent); assert.deepEqual(envelope(), reviewed);
});

test("F03-S05 flag withdrawal invalidates captured snapshots and re-enabling cannot resurrect a grant", async () => {
    status(await reviewRuleRelaxation(), "RELAXED_SESSION"); const captured = await assertMemoReleased();
    stub.state.config.set(FLAG, false);
    assert.equal(captured.blocks(uri("memo.txt") as never), true);
    assert.equal(await captured.read(uri("memo.txt") as never), OMITTED);
    status(await reviewRuleRelaxation(), "UNAVAILABLE");
    stub.state.config.set(FLAG, true); await assertMemoDenied();
    assert.equal(auditRecords().length, 1);
});

test("F03-S06 machine flag inspection overrides conflicting repository values", async () => {
    stub.state.config.set(FLAG, true);
    stub.state.configInspect.set(FLAG, { defaultValue: true, globalValue: false, workspaceValue: true });
    status(await reviewRuleRelaxation(), "UNAVAILABLE"); await assertMemoDenied();
    stub.state.config.set(FLAG, false);
    stub.state.configInspect.set(FLAG, { defaultValue: true, globalValue: true, workspaceValue: false });
    status(await reviewRuleRelaxation(), "RELAXED_SESSION"); await assertMemoReleased();
});

test("F03-S07 trust and safety-config withdrawal revoke session permission permanently", async () => {
    status(await reviewRuleRelaxation(), "RELAXED_SESSION"); const captured = await assertMemoReleased();
    stub.state.isTrusted = false;
    assert.equal(captured.blocks(uri("memo.txt") as never), true);
    stub.state.isTrusted = true; await assertMemoDenied();
    status(await reviewRuleRelaxation(), "RELAXED_SESSION"); const second = await assertMemoReleased();
    stub.state.config.set("soterai.hardening.addOnlyPolicy", false);
    assert.equal(second.blocks(uri("memo.txt") as never), true);
    stub.state.config.set("soterai.hardening.addOnlyPolicy", true); await assertMemoDenied();
});

test("F03-S08 source drift after a grant is independently detected by a fresh managed read", async () => {
    status(await reviewRuleRelaxation(), "RELAXED_SESSION"); await assertMemoReleased();
    await write(".aiignore", "another-denied.txt\n");
    await assertMemoDenied();
    assert.ok(storedRules(key()).paths.some(rule => rule.pattern === "memo.txt"));
});

test("F03-S09 additive manual and imported policy revisions revoke a session grant", async () => {
    status(await reviewRuleRelaxation(), "RELAXED_SESSION"); const captured = await assertMemoReleased();
    await deny("additional.txt");
    assert.equal(captured.blocks(uri("memo.txt") as never), true); await assertMemoDenied();
    status(await reviewRuleRelaxation(), "RELAXED_SESSION"); await assertMemoReleased();
    await updateVersionedPolicy(key(), policy([{ kind: "file", pattern: "imported.txt" }]));
    await assertMemoDenied(); assert.equal((await BoundarySnapshot.load()).blocks(uri("imported.txt") as never), true);
});

test("F03-S10 workspace disappearance revokes captured permission and returning root does not restore it", async () => {
    status(await reviewRuleRelaxation(), "RELAXED_SESSION"); const captured = await assertMemoReleased();
    const folders = stub.state.folders; stub.state.folders = [];
    assert.equal(captured.blocks(uri("memo.txt") as never), true);
    stub.state.folders = folders; await assertMemoDenied();
});

test("F03-S11 ordinary review offers neither sensitive file selectors nor removable protected regions", async () => {
    await deny("sensitive.txt", true);
    await updateRules(key(), rules => ({ ...rules, regions: [{ path: "region.txt", digest: documentDigest(REGION_TEXT),
        start: REGION_TEXT.indexOf(REGION), end: REGION_TEXT.indexOf(REGION) + REGION.length }] }));
    choiceCancelled = true;
    status(await reviewRuleRelaxation(), "CANCELLED");
    assert.ok(choices.some(choice => choice.label.includes("memo.txt")));
    assert.ok(!choices.some(choice => choice.label.includes("sensitive.txt") || choice.label.includes("region.txt")));
    assert.equal(storedRules(key()).regions.length, 1);
});

test("F03-S12 pausing an ordinary whole-file selector preserves every protected text region", async () => {
    await deny("region.txt"); selectedPattern = "region.txt";
    await updateRules(key(), rules => ({ ...rules, regions: [{ path: "region.txt", digest: documentDigest(REGION_TEXT),
        start: REGION_TEXT.indexOf(REGION), end: REGION_TEXT.indexOf(REGION) + REGION.length }] }));
    const before = structuredClone(storedRules(key()));
    status(await reviewRuleRelaxation(), "RELAXED_SESSION");
    const snapshot = await BoundarySnapshot.load(), safe = await snapshot.read(uri("region.txt") as never);
    assert.equal(snapshot.blocks(uri("region.txt") as never), false);
    assert.ok(safe.includes("Useful beginning.") && safe.includes("Useful ending."));
    assert.ok(safe.includes(OMITTED)); assert.ok(!safe.includes(REGION));
    assert.ok(!snapshot.approvedRegionView(uri("region.txt") as never, REGION_TEXT).includes(REGION));
    assert.deepEqual(storedRules(key()), before);
});

test("F03-S13 separate sensitive review retains sensitivity and permits only existing masked safe views", async () => {
    await deny("sensitive.txt", true); selectedPattern = "sensitive.txt";
    const before = structuredClone(storedRules(key()));
    status(await stub.commands.executeCommand("soterai.reviewSensitiveAIRules"), "RELAXED_SESSION");
    const snapshot = await BoundarySnapshot.load();
    assert.equal(snapshot.isSensitive(uri("sensitive.txt") as never), true);
    assert.equal(snapshot.blocks(uri("sensitive.txt") as never), true);
    assert.equal(await snapshot.read(uri("sensitive.txt") as never), OMITTED);
    assert.deepEqual(storedRules(key()), before); assert.equal(auditRecords().at(-1)!.mode, "sensitive");
    Object.assign(stub.window, { showWarningMessage: async () => "Allow safe read once" });
    const result = await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("sensitive.txt")) as { status: string; text?: string };
    assert.equal(result.status, "ALLOWED_ONCE"); assert.ok(result.text?.includes("MASKED"));
    assert.ok(!result.text?.includes(SENSITIVE)); assert.ok(!stub.capturedText().includes(SENSITIVE));
});

test("F03-S14 an ordinary session grant never relaxes credential defaults or an imported team deny", async () => {
    await updateVersionedPolicy(key(), policy([{ kind: "file", pattern: "memo.txt" }, { kind: "file", pattern: "imported.txt" }]));
    const before = structuredClone(envelope().policy);
    // A manual selector may coexist with a separately retained imported deny;
    // reviewing that selector must never weaken the imported denial itself.
    await reviewRuleRelaxation();
    await assertMemoDenied(); assert.deepEqual(envelope().policy, before);
    const snapshot = await BoundarySnapshot.load();
    assert.equal(snapshot.blocks(uri("imported.txt") as never), true);
    assert.equal(snapshot.blocks(uri(".env.owner") as never), true);
    assert.equal(await snapshot.read(uri(".env.owner") as never), OMITTED);
    Object.assign(stub.window, { showWarningMessage: async () => "Allow safe read once" });
    const safe = await stub.commands.executeCommand("soterai.readProjectFileSafely", uri(".env.owner")) as { status: string; text?: string };
    assert.equal(safe.status, "ALLOWED_ONCE");
    assert.equal(safe.text, "DATABASE_URL=[MASKED]\nPUBLIC_PORT=[MASKED]");
    assert.ok(!stub.capturedText().includes(SENSITIVE));
});

test("F03-S15 each owner-UI cancellation stage leaves no grant and no audit record", async () => {
    const permanent = structuredClone(storedRules(key()));
    folderCancelled = true; status(await reviewRuleRelaxation(), "CANCELLED"); folderCancelled = false;
    choiceCancelled = true; status(await reviewRuleRelaxation(), "CANCELLED"); choiceCancelled = false;
    warningCalls = 0; cancelledWarning = 1; status(await reviewRuleRelaxation(), "CANCELLED");
    warningCalls = 0; cancelledWarning = 0; typed = "cancel"; status(await reviewRuleRelaxation(), "CANCELLED");
    warningCalls = 0; typed = "exact"; cancelledWarning = 2; status(await reviewRuleRelaxation(), "CANCELLED");
    assert.equal(auditRecords().length, 0); assert.deepEqual(storedRules(key()), permanent); await assertMemoDenied();
});

test("F03-S16 incorrect typing, expired review and backward clock cannot create session permission", async () => {
    typed = "wrong"; status(await reviewRuleRelaxation(), "FAILED"); await assertMemoDenied();
    typed = "exact"; advance = 60_000; status(await reviewRuleRelaxation(), "FAILED"); await assertMemoDenied();
    advance = -1; status(await reviewRuleRelaxation(), "FAILED"); await assertMemoDenied();
    assert.equal(auditRecords().length, 0);
});

test("F03-S17 cancel during the cooldown withdraws the review before its final session action", async () => {
    advance = 0;
    mock.method(stub.window, "withProgress", async (_options: unknown, task: (progress: unknown, token: unknown) => Promise<unknown>) => task(
        { report: () => undefined },
        { isCancellationRequested: true, onCancellationRequested: () => new stub.Disposable() },
    ));
    status(await reviewRuleRelaxation(), "CANCELLED");
    assert.equal(auditRecords().length, 0); await assertMemoDenied();
});

test("F03-S18 source or policy drift during the owner modal invalidates its exact typed response", async () => {
    duringWarning = () => write(".aiignore", "concurrent.txt\n");
    status(await reviewRuleRelaxation(), "FAILED"); await assertMemoDenied();
    duringWarning = () => deny("concurrent.txt");
    status(await reviewRuleRelaxation(), "FAILED"); await assertMemoDenied();
    assert.ok(storedRules(key()).paths.some(rule => rule.pattern === "concurrent.txt"));
    assert.equal(auditRecords().length, 0);
});

test("F03-S19 audit persistence failure never acknowledges a grant or changes permanent policy", async () => {
    const before = structuredClone(context.workspaceState.get(RULES_KEY));
    mock.method(context.workspaceState, "update", async () => { throw new Error(SENSITIVE); });
    status(await reviewRuleRelaxation(), "FAILED");
    assert.deepEqual(context.workspaceState.get(RULES_KEY), before); await assertMemoDenied();
    assert.equal(auditRecords().length, 0); assert.ok(!stub.capturedText().includes(SENSITIVE));
});

test("F03-S20 a successful audit write followed by root drift cannot issue a session grant", async () => {
    const rootKey = key(), folders = stub.state.folders, originalUpdate = context.workspaceState.update.bind(context.workspaceState);
    mock.method(context.workspaceState, "update", async (storageKey: string, value: unknown) => {
        await originalUpdate(storageKey, value);
        if (storageKey === RULES_KEY) stub.state.folders = [];
    });
    assert.notDeepEqual(await reviewRuleRelaxation(), { status: "RELAXED_SESSION" });
    stub.state.folders = folders;
    assert.ok(storedRules(rootKey).paths.some(rule => rule.pattern === "memo.txt"));
    await assertMemoDenied();
});

test("F03-S21 a strict v3 envelope preserves review history across additive manual and policy writes", async () => {
    status(await reviewRuleRelaxation(), "RELAXED_SESSION");
    const history = structuredClone(envelope().reviewAudit);
    const decoded = parseStoredPolicy(envelope()) as unknown as { manual: ManualRules; policy?: VersionedPolicy; reviewAudit?: Audit };
    assert.deepEqual(decoded.reviewAudit, history); assert.deepEqual(decoded.manual, storedRules(key()));
    assert.throws(() => parseManualRules(envelope()), "An older schema-aware manual reader must fail closed.");
    await deny("later.txt"); assert.deepEqual(envelope().reviewAudit, history);
    await updateVersionedPolicy(key(), policy([{ kind: "file", pattern: "later-imported.txt" }]));
    assert.deepEqual(envelope().reviewAudit, history); assert.equal(envelope().schemaVersion, 3);
    const corrupt = { ...envelope(), reviewAudit: { schemaVersion: 1, records: [{ outcome: "RAW_APPROVED" }] } };
    await context.workspaceState.update(RULES_KEY, { [key()]: corrupt });
    const failed = await BoundarySnapshot.load();
    assert.equal(failed.blocks(uri("memo.txt") as never), true);
    assert.equal(await failed.read(uri("public.txt") as never), OMITTED);
});

test("F03-S22 command arguments cannot substitute for owner UI or submit a programmatic grant", async () => {
    folderCancelled = true;
    status(await stub.commands.executeCommand("soterai.manageAIRules", { root: key(), approved: true, rule: "memo.txt", challenge: "forged" }), "CANCELLED");
    status(await stub.commands.executeCommand("soterai.reviewSensitiveAIRules", true, "sensitive.txt"), "CANCELLED");
    assert.equal(inputCalls, 0); assert.equal(auditRecords().length, 0); await assertMemoDenied();
});

test("F03-S23 a concurrent owner review is unavailable while the first dialog is still open", async () => {
    let entered!: () => void, finish!: () => void;
    const showing = new Promise<void>(resolve => { entered = resolve; });
    duringWarning = () => new Promise<void>(resolve => { finish = resolve; entered(); });
    const first = reviewRuleRelaxation(); await showing;
    status(await reviewRuleRelaxation(), "UNAVAILABLE");
    finish(); status(await first, "RELAXED_SESSION");
    assert.equal(auditRecords().length, 1); await assertMemoReleased();
});

test("F03-S24 unknown root or audit schemas and extra audit fields fail closed without discarding stored denies", async () => {
    status(await reviewRuleRelaxation(), "RELAXED_SESSION");
    const valid = structuredClone(envelope()), rootKey = key();
    initializeBoundaryState(context.workspaceState as never);
    const bad = [
        { ...valid, schemaVersion: 4 },
        { ...valid, reviewAudit: { ...valid.reviewAudit, schemaVersion: 2 } },
        { ...valid, reviewAudit: { ...valid.reviewAudit, allowOriginalSecrets: true } },
    ];
    for (const corrupt of bad) {
        await context.workspaceState.update(RULES_KEY, { [rootKey]: corrupt });
        const snapshot = await BoundarySnapshot.load();
        assert.equal(snapshot.blocks(uri("memo.txt") as never), true);
        assert.equal(await snapshot.read(uri("public.txt") as never), OMITTED);
        assert.deepEqual(envelope().manual, valid.manual);
        assert.deepEqual(envelope().policy, valid.policy);
    }
});

test("F03-S25 a full review audit refuses a new grant without truncating retained owner history", async () => {
    status(await reviewRuleRelaxation(), "RELAXED_SESSION");
    const valid = structuredClone(envelope()), first = valid.reviewAudit!.records[0];
    const full = { ...valid, reviewAudit: { schemaVersion: 1 as const, records: Array.from({ length: 64 }, (_, index) => ({
        ...first, id: `00000000-0000-4000-8000-${(index + 1).toString().padStart(12, "0")}`,
    })) } };
    await context.workspaceState.update(RULES_KEY, { [key()]: full });
    initializeBoundaryState(context.workspaceState as never);
    status(await reviewRuleRelaxation(), "FAILED");
    assert.deepEqual(envelope(), full); assert.equal(auditRecords().length, 64); await assertMemoDenied();
});

test("F03-S26 sensitive protected-region review audits metadata while preserving the actual masking rule", async () => {
    await updateRules(key(), rules => ({ ...rules, regions: [{ path: "region.txt", digest: documentDigest(REGION_TEXT),
        start: REGION_TEXT.indexOf(REGION), end: REGION_TEXT.indexOf(REGION) + REGION.length }] }));
    const permanent = structuredClone(storedRules(key())); selectedPattern = "region.txt";
    status(await stub.commands.executeCommand("soterai.reviewSensitiveAIRules"), "RELAXED_SESSION");
    assert.deepEqual(storedRules(key()), permanent); assert.equal(auditRecords().at(-1)!.mode, "sensitive");
    const snapshot = await BoundarySnapshot.load(), safe = await snapshot.read(uri("region.txt") as never);
    assert.ok(safe.includes("Useful beginning.") && safe.includes("Useful ending."));
    assert.ok(safe.includes(OMITTED)); assert.ok(!safe.includes(REGION));
    assert.ok(!snapshot.approvedRegionView(uri("region.txt") as never, REGION_TEXT).includes(REGION));
});

test("F03-S27 re-blocking an already stored deny immediately ends its reviewed session permission", async () => {
    status(await reviewRuleRelaxation(), "RELAXED_SESSION"); const captured = await assertMemoReleased();
    status(await stub.commands.executeCommand("soterai.blockFromAI", uri("memo.txt")), "SAVED");
    assert.equal(captured.blocks(uri("memo.txt") as never), true);
    await assertMemoDenied(); assert.equal(auditRecords().length, 1);
});

test("F03-S28 a queued check of older drift metadata does not cancel a review of the already current revision", async () => {
    status(await checkPolicyDrift(context as never), "BASELINE_SAVED");
    stub.state.config.set("soterai.lite.restrictionSave", false);
    duringWarning = async () => {
        assert.deepEqual(await checkPolicyDrift(context as never), { status: "DRIFT", changedRoots: [key()] });
    };
    status(await reviewRuleRelaxation(), "RELAXED_SESSION");
    await assertMemoReleased(); assert.equal(auditRecords().length, 1);
});

test("F03-S29 legacy Unicode and case aliases use the same selector identity after a v3 audit upgrade", async () => {
    const rootKey = key(), name = "cafe\u0301.txt";
    await write(name, PRIVATE);
    stub.state.config.set("soterai.lite.versionedPolicy", false);
    const manual = { paths: [{ pattern: "CAFE\u0301.TXT", kind: "file" }], regions: [] };
    await context.workspaceState.update(RULES_KEY, { [rootKey]: manual });
    initializeBoundaryState(context.workspaceState as never); selectedPattern = "CAFE\u0301.TXT";
    assert.equal((await BoundarySnapshot.load()).blocks(uri(name) as never), true);
    status(await reviewRuleRelaxation(), "RELAXED_SESSION");
    const current = await BoundarySnapshot.load();
    assert.equal(current.blocks(uri(name) as never), false);
    assert.equal(await current.read(uri(name) as never), PRIVATE);
    assert.deepEqual(envelope().manual, manual);
    initializeBoundaryState(context.workspaceState as never);
    assert.equal((await BoundarySnapshot.load()).blocks(uri(name) as never), true);
});
