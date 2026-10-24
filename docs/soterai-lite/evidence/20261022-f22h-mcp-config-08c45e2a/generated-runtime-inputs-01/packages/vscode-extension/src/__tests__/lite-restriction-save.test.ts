// F01 acceptance tests: synthetic component fixtures, not actual IDE/tool evidence.
// Catalog frozen before authoring; root records the expected failing baseline.
import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { mkdtemp, mkdir, rm, unlink, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import * as stub from "./phase2/vscode-stub";
import {
    BoundarySnapshot, initializeBoundaryState, onDidChangeBoundaryRules,
    RULES_KEY, storedRules, updateRules,
} from "../ai-boundary/BoundarySnapshot";
import { registerAIBoundaryCommands } from "../ai-boundary/commands";
import { documentDigest, OMITTED, type ManualRules } from "../ai-boundary/policy";
import { registerProjectPrivacyCommands } from "../project-privacy/commands";
import { openProjectPrivacyPanel } from "../project-privacy/panel";

type RuleStatus = "SAVED" | "FAILED" | "CANCELLED" | "UNAVAILABLE";
const FLAG = "soterai.lite.restrictionSave";
const fakePrivate = "SYNTHETIC_ONLY_F01_PRIVATE_20261013";
const privateDiagnostic = "SYNTHETIC_ONLY_F01_STORAGE_DIAGNOSTIC";
const publicText = "Useful public control.";
let root: string;
let context: ReturnType<typeof stub.makeExtensionContext>;
let picked: stub.Uri | undefined;
let originalDialog: PropertyDescriptor | undefined;
let originalProviderRegistration: PropertyDescriptor | undefined;
const dialogTarget = stub.window as unknown as Record<string, unknown>;
const originalWindowMethods = Object.entries(Object.getOwnPropertyDescriptors(stub.window))
    .filter(([, descriptor]) => typeof descriptor.value === "function");
const workspaceTarget = stub.workspace as unknown as Record<string, unknown>;
const uri = (relative: string) => stub.Uri.file(join(root, relative));
const rootKey = () => stub.state.folders[0].uri.toString();
const tick = () => new Promise<void>(done => setImmediate(done));
const stored = () => structuredClone(context.workspaceState.get<Record<string, unknown>>(RULES_KEY, {}));

function expectStatus(result: unknown, expected: RuleStatus): void {
    assert.ok(result && typeof result === "object" && !Array.isArray(result), "Explicit restriction result required.");
    assert.equal((result as { status?: unknown }).status, expected);
    assert.equal("text" in result, false, "A restriction receipt must not carry file content.");
}

function noSavedNotification(): void {
    const notifications = stub.sinks.filter(sink => sink.sink === "notification").map(sink => sink.text).join("\n");
    assert.doesNotMatch(notifications, /AI rule saved|Sensitive restriction saved|Managed restriction saved/);
    assert.ok(!notifications.includes(privateDiagnostic));
    assert.ok(!notifications.includes(fakePrivate));
}

function changedRoots(): string[] {
    const roots: string[] = [];
    context.subscriptions.push(onDidChangeBoundaryRules(value => roots.push(value)));
    return roots;
}

async function write(relative: string, text: string): Promise<void> {
    await mkdir(dirname(join(root, relative)), { recursive: true });
    await writeFile(join(root, relative), text);
}

async function seed(rules: ManualRules): Promise<void> {
    await updateRules(rootKey(), () => rules);
    stub.resetSinks();
}

function rejectPolicySave() {
    const originalUpdate = context.workspaceState.update;
    return mock.method(context.workspaceState, "update", async (key: string, value: unknown) => {
        if (key === RULES_KEY) throw new Error(privateDiagnostic);
        await originalUpdate(key, value);
    });
}

beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "soterai-f01-"));
    stub.resetState(root);
    // F01 fault/queue tests isolate manual saves. F02 default enrollment has
    // its own combined-feature controls and exact-package host acceptance.
    stub.state.config.set("soterai.lite.versionedPolicy", false);
    context = stub.makeExtensionContext(root);
    initializeBoundaryState(context.workspaceState as never);
    await write("private.txt", fakePrivate);
    await write("public.txt", publicText);
    await write("selection.txt", "public\n" + fakePrivate + "\npublic");
    await write("reports/private.txt", fakePrivate);
    await write("reports-other/private.txt", fakePrivate);
    picked = uri("private.txt");
    originalDialog = Object.getOwnPropertyDescriptor(dialogTarget, "showOpenDialog");
    Object.defineProperty(dialogTarget, "showOpenDialog", {
        configurable: true, writable: true,
        value: async () => picked ? [picked] : undefined,
    });
    originalProviderRegistration = Object.getOwnPropertyDescriptor(workspaceTarget, "registerTextDocumentContentProvider");
    Object.defineProperty(workspaceTarget, "registerTextDocumentContentProvider", {
        configurable: true, writable: true, value: () => new stub.Disposable(),
    });
    registerAIBoundaryCommands(context as never);
    registerProjectPrivacyCommands(context as never);
});

afterEach(async () => {
    context.subscriptions.forEach(item => item.dispose());
    mock.restoreAll();
    // Repeated mock.method calls can restore an earlier mock instead of the
    // original function. Keep each scenario independent of the prior UI driver.
    for (const [name, descriptor] of originalWindowMethods) Object.defineProperty(dialogTarget, name, descriptor);
    if (originalDialog) Object.defineProperty(dialogTarget, "showOpenDialog", originalDialog);
    else delete dialogTarget.showOpenDialog;
    if (originalProviderRegistration) Object.defineProperty(workspaceTarget, "registerTextDocumentContentProvider", originalProviderRegistration);
    else delete workspaceTarget.registerTextDocumentContentProvider;
    const target = resolve(root);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith("soterai-f01-"));
    await rm(target, { recursive: true, force: true });
});

test("F01-U01 ordinary restriction returns SAVED only for persisted deny", async () => {
    const events = changedRoots();
    expectStatus(await stub.commands.executeCommand("soterai.restrictProjectFile"), "SAVED");
    assert.deepEqual(storedRules(rootKey()).paths, [{ kind: "file", pattern: "private.txt" }]);
    assert.deepEqual(events, [rootKey()]);
    const boundary = await BoundarySnapshot.load();
    assert.equal(await boundary.read(uri("private.txt") as never), OMITTED);
    assert.equal(await boundary.read(uri("public.txt") as never), publicText);
    assert.ok(!stub.capturedText().includes(fakePrivate));
});

test("F01-U02 failed ordinary save cannot become REQUEST_HANDLED or success", async () => {
    const events = changedRoots();
    rejectPolicySave();
    const result = await stub.commands.executeCommand("soterai.restrictProjectFile");
    expectStatus(result, "FAILED");
    assert.equal(context.workspaceState.get(RULES_KEY), undefined);
    assert.deepEqual(events, []);
    noSavedNotification();
    assert.notEqual((result as { status: string }).status, "REQUEST_HANDLED");
});

test("F01-U03 direct manual command reports storage failure to its caller", async () => {
    rejectPolicySave();
    expectStatus(await stub.commands.executeCommand("soterai.blockFromAI", uri("private.txt")), "FAILED");
    assert.equal(context.workspaceState.get(RULES_KEY), undefined);
    noSavedNotification();
});

test("F01-U04 failed addition preserves ordinary folder glob region and sensitive denies", async () => {
    const selection = "public\n" + fakePrivate + "\npublic";
    await seed({
        paths: [
            { kind: "file", pattern: "prior.txt" },
            { kind: "file", pattern: "sensitive.txt", sensitive: true },
            { kind: "folder", pattern: "reports" },
            { kind: "glob", pattern: "*.private" },
        ],
        regions: [{ path: "selection.txt", digest: documentDigest(selection), start: 7, end: 7 + fakePrivate.length }],
    });
    const before = stored();
    const events = changedRoots();
    rejectPolicySave();
    expectStatus(await stub.commands.executeCommand("soterai.restrictProjectFile"), "FAILED");
    assert.deepEqual(stored(), before);
    assert.deepEqual(events, []);
    assert.equal(storedRules(rootKey()).paths.find(rule => rule.pattern === "sensitive.txt")?.sensitive, true);
    assert.equal((await BoundarySnapshot.load()).blocks(uri("reports/private.txt") as never), true);
    noSavedNotification();
});

test("F01-U05 file folder glob and region paths share explicit awaited save outcomes", async () => {
    const cases = [
        { command: "soterai.blockFromAI", argument: uri("private.txt"), failureArgument: uri("public.txt"), setup: async () => undefined, setupFailure: async () => undefined },
        { command: "soterai.blockFromAI", argument: uri("reports"), failureArgument: uri("reports-other"), setup: async () => undefined, setupFailure: async () => undefined },
        { command: "soterai.blockGlobFromAI", argument: uri("public.txt"), setup: async () => {
            mock.method(stub.window, "showInputBox", async () => "*.private" as never);
        }, failureArgument: uri("public.txt"), setupFailure: async () => {
            mock.method(stub.window, "showInputBox", async () => "*.another-private" as never);
        } },
        { command: "soterai.blockSelectionFromAI", argument: undefined, setup: async () => {
            await stub.openEditor(uri("selection.txt").fsPath, { from: 1, to: 1 });
        }, failureArgument: undefined, setupFailure: async () => {
            await stub.openEditor(uri("selection.txt").fsPath, { from: 0, to: 0 });
        } },
    ];
    for (const sample of cases) {
        await sample.setup();
        expectStatus(await stub.commands.executeCommand(sample.command, sample.argument), "SAVED");
        const before = stored();
        await sample.setupFailure();
        stub.resetSinks();
        const failing = rejectPolicySave();
        try {
            expectStatus(await stub.commands.executeCommand(sample.command, sample.failureArgument), "FAILED");
            assert.deepEqual(stored(), before);
            noSavedNotification();
        } finally { failing.mock.restore(); }
    }
    const rules = storedRules(rootKey());
    assert.ok(rules.paths.some(rule => rule.kind === "folder" && rule.pattern === "reports"));
    assert.ok(rules.paths.some(rule => rule.kind === "glob" && rule.pattern === "*.private"));
    assert.equal(rules.regions.length, 1);
});

test("F01-U06 picker glob folder and empty-selection cancellation make no writes", async () => {
    const updates: string[] = [];
    const originalUpdate = context.workspaceState.update;
    mock.method(context.workspaceState, "update", async (key: string, value: unknown) => {
        updates.push(key); await originalUpdate(key, value);
    });
    picked = undefined;
    expectStatus(await stub.commands.executeCommand("soterai.restrictProjectFile"), "CANCELLED");
    expectStatus(await stub.commands.executeCommand("soterai.blockGlobFromAI", uri("public.txt")), "CANCELLED");
    stub.state.activeEditor = undefined;
    mock.method(stub.window, "showWorkspaceFolderPick", async () => undefined);
    expectStatus(await stub.commands.executeCommand("soterai.blockGlobFromAI"), "CANCELLED");
    expectStatus(await stub.commands.executeCommand("soterai.blockSelectionFromAI"), "CANCELLED");
    await stub.openEditor(uri("selection.txt").fsPath);
    expectStatus(await stub.commands.executeCommand("soterai.blockSelectionFromAI"), "CANCELLED");
    assert.deepEqual(updates, []);
    noSavedNotification();
});

test("F01-U07 invalid paths syntax and corrupt storage fail without successful mutation", async () => {
    for (const target of [
        uri("missing.txt"),
        stub.Uri.file(join(dirname(root), "soterai-f01-outside-does-not-exist.txt")),
        stub.Uri.parse("soterai-approved:/not-a-project-file"),
    ]) {
        expectStatus(await stub.commands.executeCommand("soterai.blockFromAI", target), "FAILED");
        assert.equal(context.workspaceState.get(RULES_KEY), undefined);
    }
    mock.method(stub.window, "showInputBox", async () => "!relax-deny" as never);
    expectStatus(await stub.commands.executeCommand("soterai.blockGlobFromAI", uri("public.txt")), "FAILED");
    context._inspect.workspaceStore.set(RULES_KEY, { [rootKey()]: { paths: null, regions: [] } });
    const before = stored();
    expectStatus(await stub.commands.executeCommand("soterai.blockFromAI", uri("private.txt")), "FAILED");
    assert.deepEqual(stored(), before);
    assert.equal((await BoundarySnapshot.load()).blocks(uri("public.txt") as never), true);
    noSavedNotification();
});

test("F01-U08 save result notification and change event wait for storage completion", { timeout: 10_000 }, async () => {
    let release!: () => void;
    let began!: () => void;
    const holding = new Promise<void>(done => { release = done; });
    const started = new Promise<void>(done => { began = done; });
    const originalUpdate = context.workspaceState.update;
    mock.method(context.workspaceState, "update", async (key: string, value: unknown) => {
        if (key === RULES_KEY) { began(); await holding; }
        await originalUpdate(key, value);
    });
    const events = changedRoots();
    let settled = false;
    const pending = stub.commands.executeCommand("soterai.restrictProjectFile").then(result => { settled = true; return result; });
    await started;
    try {
        await tick();
        assert.equal(settled, false);
        assert.equal(context.workspaceState.get(RULES_KEY), undefined);
        assert.deepEqual(events, []);
        noSavedNotification();
    } finally { release(); }
    expectStatus(await pending, "SAVED");
    assert.deepEqual(events, [rootKey()]);
});

test("F01-U09 manual save revokes pending reads before failure and holds new reads while pending", { timeout: 10_000 }, async () => {
    let approve!: (choice: string) => void;
    let reviewed!: () => void;
    const reviewStarted = new Promise<void>(done => { reviewed = done; });
    mock.method(stub.window, "showWarningMessage", () => new Promise<string>(done => { approve = done; reviewed(); }));
    const read = stub.commands.executeCommand("soterai.readProjectFileSafely", uri("private.txt"));
    await reviewStarted;
    let rejectSave!: (reason: Error) => void;
    let saving!: () => void;
    const saveStarted = new Promise<void>(done => { saving = done; });
    const originalUpdate = context.workspaceState.update;
    mock.method(context.workspaceState, "update", async (key: string, value: unknown) => {
        if (key === RULES_KEY) {
            saving();
            await new Promise<void>((_resolve, reject) => { rejectSave = reject; });
        }
        await originalUpdate(key, value);
    });
    const events = changedRoots();
    const restricting = stub.commands.executeCommand("soterai.blockFromAI", uri("private.txt"));
    await saveStarted;
    let writeResult: unknown;
    try {
        approve("Allow safe read once");
        assert.deepEqual(await read, { status: "EXPIRED" }, "Manual intent must revoke before storage finishes.");
        assert.deepEqual(await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("private.txt")), { status: "UNAVAILABLE" });
    } finally {
        rejectSave(new Error(privateDiagnostic));
        writeResult = await restricting;
    }
    expectStatus(writeResult, "FAILED");
    assert.equal(context.workspaceState.get(RULES_KEY), undefined);
    assert.deepEqual(events, []);
    noSavedNotification();
    mock.method(stub.window, "showWarningMessage", async () => "Allow safe read once");
    const control = await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("public.txt")) as { status: string; text: string };
    assert.equal(control.status, "ALLOWED_ONCE");
    assert.equal(control.text, publicText, "Failed manual save must release its pending marker.");
});

test("F01-U10 failed queued save does not poison later successful roots", async () => {
    await write("one/private.txt", fakePrivate);
    await write("two/private.txt", fakePrivate);
    stub.state.folders = ["one", "two"].map((name, index) => ({ uri: uri(name), name, index }));
    const keys = stub.state.folders.map(folder => folder.uri.toString());
    const originalUpdate = context.workspaceState.update;
    let started!: () => void;
    let rejectFirst!: () => void;
    const firstStarted = new Promise<void>(done => { started = done; });
    const firstGate = new Promise<void>(done => { rejectFirst = done; });
    let attempts = 0;
    mock.method(context.workspaceState, "update", async (key: string, value: unknown) => {
        if (key === RULES_KEY && attempts++ === 0) {
            started(); await firstGate; throw new Error(privateDiagnostic);
        }
        await originalUpdate(key, value);
    });
    const events = changedRoots();
    const first = stub.commands.executeCommand("soterai.blockFromAI", uri("one/private.txt"));
    await firstStarted;
    const second = stub.commands.executeCommand("soterai.blockFromAI", uri("two/private.txt"));
    rejectFirst();
    const results = await Promise.all([first, second]);
    expectStatus(results[0], "FAILED");
    expectStatus(results[1], "SAVED");
    assert.deepEqual(storedRules(keys[0]).paths, []);
    assert.deepEqual(storedRules(keys[1]).paths, [{ kind: "file", pattern: "private.txt" }]);
    assert.deepEqual(events, [keys[1]]);
    assert.ok(!stub.capturedText().includes(privateDiagnostic));
});

test("F01-U11 repeated ordinary marking cannot duplicate or weaken sensitive deny", async () => {
    expectStatus(await stub.commands.executeCommand("soterai.restrictSensitiveFile", uri("private.txt")), "SAVED");
    const before = stored();
    const events = changedRoots();
    expectStatus(await stub.commands.executeCommand("soterai.blockFromAI", uri("private.txt")), "SAVED");
    expectStatus(await stub.commands.executeCommand("soterai.restrictProjectFile"), "SAVED");
    assert.deepEqual(stored(), before);
    assert.equal(storedRules(rootKey()).paths.length, 1);
    assert.equal(storedRules(rootKey()).paths[0].sensitive, true);
    assert.deepEqual(events, []);
});

test("F01-U12 full policy upgrades strongest treatment but rejects overflowing new deny", async () => {
    await seed({
        paths: Array.from({ length: 256 }, (_, index) => ({ kind: "file" as const, pattern: index === 0 ? "private.txt" : "fixture-" + index + ".txt" })),
        regions: [],
    });
    expectStatus(await stub.commands.executeCommand("soterai.restrictSensitiveFile", uri("private.txt")), "SAVED");
    const before = stored();
    stub.resetSinks();
    expectStatus(await stub.commands.executeCommand("soterai.blockFromAI", uri("public.txt")), "FAILED");
    assert.deepEqual(stored(), before);
    assert.equal(storedRules(rootKey()).paths.length, 256);
    assert.equal(storedRules(rootKey()).paths[0].sensitive, true);
    noSavedNotification();
});

test("F01-U13 saved restrictions survive component reload and repository deny removal", async () => {
    expectStatus(await stub.commands.executeCommand("soterai.blockFromAI", uri("private.txt")), "SAVED");
    expectStatus(await stub.commands.executeCommand("soterai.blockFromAI", uri("reports")), "SAVED");
    mock.method(stub.window, "showInputBox", async () => "*.private" as never);
    expectStatus(await stub.commands.executeCommand("soterai.blockGlobFromAI", uri("public.txt")), "SAVED");
    await stub.openEditor(uri("selection.txt").fsPath, { from: 1, to: 1 });
    expectStatus(await stub.commands.executeCommand("soterai.blockSelectionFromAI"), "SAVED");
    await write("accepted.txt", fakePrivate);
    await write(".aiignore", "accepted.txt\n");
    assert.equal((await BoundarySnapshot.load()).blocks(uri("accepted.txt") as never), true);
    await unlink(uri(".aiignore").fsPath);
    initializeBoundaryState(context.workspaceState as never);
    const snapshot = await BoundarySnapshot.load();
    assert.equal(snapshot.blocks(uri("private.txt") as never), true);
    assert.equal(snapshot.blocks(uri("reports/private.txt") as never), true);
    assert.equal(snapshot.blocks(uri("example.private") as never), true);
    assert.equal(snapshot.blocks(uri("accepted.txt") as never), true);
    assert.equal(await snapshot.read(uri("public.txt") as never), publicText);
    assert.ok(!snapshot.sanitize(uri("selection.txt") as never, "public\n" + fakePrivate + "\npublic").includes(fakePrivate));
    await write("selection.txt", "changed " + fakePrivate);
    assert.equal((await BoundarySnapshot.load()).sanitize(uri("selection.txt") as never, "changed " + fakePrivate), OMITTED);
});

test("F01-U14 flag off withdraws only new restrictions and retains masked existing reads", async () => {
    const manifest = JSON.parse(readFileSync(join(__dirname, "../../../soterai-lite/package.json"), "utf8"));
    const declaration = manifest.contributes.configuration.properties[FLAG];
    assert.ok(declaration, "The shipped Lite manifest declares the F01 flag.");
    assert.equal(declaration.default, true);
    assert.equal(declaration.scope, "machine");
    assert.ok(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes(FLAG));
    await seed({ paths: [{ kind: "file", pattern: "private.txt", sensitive: true }], regions: [] });
    const before = stored();
    const events = changedRoots();
    stub.state.config.set(FLAG, false);
    const updates: string[] = [];
    const originalUpdate = context.workspaceState.update;
    mock.method(context.workspaceState, "update", async (key: string, value: unknown) => {
        updates.push(key); await originalUpdate(key, value);
    });
    for (const [command, argument] of [
        ["soterai.blockFromAI", uri("public.txt")],
        ["soterai.blockGlobFromAI", uri("public.txt")],
        ["soterai.blockSelectionFromAI", undefined],
        ["soterai.restrictProjectFile", undefined],
        ["soterai.restrictSensitiveFile", uri("public.txt")],
    ] as const) expectStatus(await stub.commands.executeCommand(command, argument), "UNAVAILABLE");
    assert.deepEqual(stored(), before);
    assert.deepEqual(updates, []);
    assert.deepEqual(events, []);
    noSavedNotification();
    const snapshot = await BoundarySnapshot.load();
    assert.equal(snapshot.blocks(uri("private.txt") as never), true);
    assert.equal(snapshot.isSensitive(uri("private.txt") as never), true);
    mock.method(stub.window, "showWarningMessage", async () => "Allow safe read once");
    const masked = await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("private.txt")) as { status: string; text: string };
    assert.equal(masked.status, "ALLOWED_ONCE");
    assert.match(masked.text, /MASKED/);
    assert.ok(!masked.text.includes(fakePrivate));
    const control = await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("public.txt")) as { status: string; text: string };
    assert.equal(control.status, "ALLOWED_ONCE");
    assert.equal(control.text, publicText);
    assert.equal(stub.workspace.getConfiguration("soterai").get("projectPrivacy.enabled", true), true);
});

test("F01-U15 actual panel controller shows real saved failed and cancelled command outcomes", async () => {
    let html = "";
    let receive: (message: unknown) => Promise<void> = async () => { throw new Error("Panel handler not registered."); };
    mock.method(stub.window, "createWebviewPanel", () => {
        let disposed = () => {};
        return {
            webview: {
                get html() { return html; }, set html(value: string) { html = value; },
                onDidReceiveMessage: (handler: typeof receive) => { receive = handler; return new stub.Disposable(); },
            },
            onDidDispose: (handler: () => void) => { disposed = handler; return new stub.Disposable(); },
            reveal() {}, dispose() { disposed(); },
        } as never;
    });
    openProjectPrivacyPanel(context as never);
    await receive({ type: "refresh" });
    await receive({ type: "restrictFile" });
    assert.match(html, /data-outcome="completed"/);
    assert.match(html, /Managed restriction saved/);
    picked = uri("public.txt");
    rejectPolicySave();
    await receive({ type: "restrictFile" });
    assert.match(html, /data-outcome="failed"/);
    assert.doesNotMatch(html, /Managed restriction saved/);
    assert.ok(!html.includes(privateDiagnostic));
    assert.ok(!html.includes(fakePrivate));
    assert.equal(storedRules(rootKey()).paths.some(rule => rule.pattern === "public.txt"), false);
    picked = undefined;
    await receive({ type: "restrictFile" });
    assert.match(html, /data-outcome="withheld"/);
    assert.match(html, /cancelled or denied/);
});

test("F01-U16 post-commit rejection is reported conservatively without undoing stronger deny", async () => {
    const originalUpdate = context.workspaceState.update;
    mock.method(context.workspaceState, "update", async (key: string, value: unknown) => {
        await originalUpdate(key, value);
        if (key === RULES_KEY) throw new Error(privateDiagnostic);
    });
    const events = changedRoots();
    expectStatus(await stub.commands.executeCommand("soterai.restrictProjectFile"), "FAILED");
    assert.deepEqual(storedRules(rootKey()).paths, [{ kind: "file", pattern: "private.txt" }]);
    assert.deepEqual(events, []);
    assert.equal((await BoundarySnapshot.load()).blocks(uri("private.txt") as never), true);
    noSavedNotification();
});

test("F01-U17 overlapping manual saves keep reads withheld until both finish", { timeout: 10_000 }, async () => {
    const releases: Array<() => void> = [];
    const starts: Array<() => void> = [];
    const gates = [0, 1].map(index => new Promise<void>(done => { releases[index] = done; }));
    const began = [0, 1].map(index => new Promise<void>(done => { starts[index] = done; }));
    const originalUpdate = context.workspaceState.update;
    let writes = 0;
    mock.method(context.workspaceState, "update", async (key: string, value: unknown) => {
        if (key === RULES_KEY) { const index = writes++; starts[index](); await gates[index]; }
        await originalUpdate(key, value);
    });
    mock.method(stub.window, "showWarningMessage", async () => "Allow safe read once");
    const first = stub.commands.executeCommand("soterai.blockFromAI", uri("private.txt"));
    await began[0];
    const second = stub.commands.executeCommand("soterai.blockFromAI", uri("reports/private.txt"));
    try {
        releases[0]();
        expectStatus(await first, "SAVED");
        await began[1];
        assert.deepEqual(await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("reports/private.txt")), { status: "UNAVAILABLE" });
        const publicControl = await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("public.txt")) as { status: string; text: string };
        assert.equal(publicControl.status, "ALLOWED_ONCE");
        assert.equal(publicControl.text, publicText, "Unrelated public work must remain available during a save.");
    } finally { releases[0](); releases[1](); }
    expectStatus(await second, "SAVED");
    const control = await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("public.txt")) as { status: string; text: string };
    assert.equal(control.status, "ALLOWED_ONCE");
    assert.equal(control.text, publicText);
});

test("F01-U18 flag disabled during a glob dialog withholds the new save", async () => {
    let choose!: (value: string) => void;
    let began!: () => void;
    const started = new Promise<void>(done => { began = done; });
    mock.method(stub.window, "showInputBox", () => new Promise<string>(done => { choose = done; began(); }));
    const saving = stub.commands.executeCommand("soterai.blockGlobFromAI", uri("public.txt"));
    await started;
    stub.state.config.set(FLAG, false);
    choose("*.private");
    expectStatus(await saving, "UNAVAILABLE");
    assert.equal(context.workspaceState.get(RULES_KEY), undefined);
    noSavedNotification();
});

test("F01-U19 repository flag values cannot override the machine owner setting", async () => {
    stub.state.config.set(FLAG, true);
    stub.state.configInspect.set(FLAG, { defaultValue: true, globalValue: false, workspaceValue: true });
    expectStatus(await stub.commands.executeCommand("soterai.blockFromAI", uri("private.txt")), "UNAVAILABLE");
    assert.equal(context.workspaceState.get(RULES_KEY), undefined);
    stub.state.config.set(FLAG, false);
    stub.state.configInspect.set(FLAG, { defaultValue: true, globalValue: true, workspaceValue: false });
    expectStatus(await stub.commands.executeCommand("soterai.blockFromAI", uri("private.txt")), "SAVED");
    assert.equal((await BoundarySnapshot.load()).blocks(uri("private.txt") as never), true);
});

test("F01-U20 repeated accepted policy enrollment does not expire public safe reads", async () => {
    await write(".aiignore", "private.txt\n");
    mock.method(stub.window, "showWarningMessage", async () => "Allow safe read once");
    for (let attempt = 0; attempt < 2; attempt++) {
        const result = await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("public.txt")) as { status: string; text: string };
        assert.equal(result.status, "ALLOWED_ONCE");
        assert.equal(result.text, publicText);
    }
    assert.equal((await BoundarySnapshot.load()).blocks(uri("private.txt") as never), true);
});

test("F01-U21 workspace replacement during queued file saves cannot report SAVED", { timeout: 10_000 }, async () => {
    const chosenRoot = rootKey();
    let began!: () => void;
    let release!: () => void;
    const started = new Promise<void>(done => { began = done; });
    const gate = new Promise<void>(done => { release = done; });
    const originalUpdate = context.workspaceState.update;
    let writes = 0;
    mock.method(context.workspaceState, "update", async (key: string, value: unknown) => {
        if (key === RULES_KEY && writes++ === 0) { began(); await gate; }
        await originalUpdate(key, value);
    });
    const first = stub.commands.executeCommand("soterai.blockFromAI", uri("private.txt"));
    await started;
    const second = stub.commands.executeCommand("soterai.blockFromAI", uri("reports/private.txt"));
    stub.state.folders = [{ uri: uri("reports"), name: "replacement", index: 0 }];
    release();
    const results = await Promise.all([first, second]);
    expectStatus(results[0], "FAILED");
    expectStatus(results[1], "FAILED");
    assert.ok(storedRules(chosenRoot).paths.some(rule => rule.pattern === "private.txt"), "Already committed stronger record must remain.");
    assert.deepEqual(storedRules(rootKey()).paths, [], "No silent migration to another root.");
    noSavedNotification();
});

test("F01-U22 root removed during a glob dialog makes no successful save", async () => {
    let choose!: (value: string) => void;
    let began!: () => void;
    const started = new Promise<void>(done => { began = done; });
    mock.method(stub.window, "showInputBox", () => new Promise<string>(done => { choose = done; began(); }));
    const saving = stub.commands.executeCommand("soterai.blockGlobFromAI", uri("public.txt"));
    await started;
    stub.state.folders = [];
    choose("*.private");
    expectStatus(await saving, "FAILED");
    assert.equal(context.workspaceState.get(RULES_KEY), undefined);
    noSavedNotification();
});

test("F01-U23 queued sensitive save stays bound to its chosen workspace", { timeout: 10_000 }, async () => {
    const chosenRoot = rootKey();
    let began!: () => void;
    let release!: () => void;
    const started = new Promise<void>(done => { began = done; });
    const gate = new Promise<void>(done => { release = done; });
    const originalUpdate = context.workspaceState.update;
    let writes = 0;
    mock.method(context.workspaceState, "update", async (key: string, value: unknown) => {
        if (key === RULES_KEY && writes++ === 0) { began(); await gate; }
        await originalUpdate(key, value);
    });
    const first = stub.commands.executeCommand("soterai.restrictSensitiveFile", uri("private.txt"));
    await started;
    const second = stub.commands.executeCommand("soterai.restrictSensitiveFile", uri("reports/private.txt"));
    stub.state.folders = [{ uri: uri("reports"), name: "replacement", index: 0 }];
    release();
    const results = await Promise.all([first, second]);
    expectStatus(results[0], "FAILED");
    expectStatus(results[1], "FAILED");
    assert.equal(storedRules(chosenRoot).paths.find(rule => rule.pattern === "private.txt")?.sensitive, true);
    assert.deepEqual(storedRules(rootKey()).paths, []);
    noSavedNotification();
});

