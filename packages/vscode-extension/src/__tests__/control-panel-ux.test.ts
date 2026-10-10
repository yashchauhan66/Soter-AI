import "./phase2/register.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import * as stub from "./phase2/vscode-stub";
import { ControlPanelViewProvider } from "../webview/ControlPanelViewProvider";

const descriptor = (title = "Monitoring only") => ({ state: "MONITORING_ONLY", title,
    explanation: "Only managed paths are checked.", severity: "warning", activeControls: [], inactiveControls: [],
    coverage: "Unknown", recommendedAction: "Review coverage", allowedTransitions: [] });

function fixture(refresh = async () => ({ descriptor: descriptor() })) {
    stub.resetState();
    const context = { ...stub.makeExtensionContext("synthetic-ui"), extension: { packageJSON: { version: "0.6.3" } } };
    const provider = new ControlPanelViewProvider(context as never, {
        workspaceGuard: { isEnabled: false } as never, sentinel: { isEnabled: false } as never,
        brokerManager: { status: async () => ({ running: false }) } as never,
        protectionState: { refresh } as never, refreshViews: () => {},
    });
    const access = provider as unknown as {
        handleMessage(message: unknown): Promise<void>;
        buildHtml(webview: unknown, facts: unknown, descriptor: unknown, logo: unknown): string;
        feedback?: { tone: string; message: string };
    };
    return { provider, access, context };
}

function view() {
    let html = "";
    let dispose = () => {};
    return { webview: { options: {}, cspSource: "file:", get html() { return html; }, set html(value: string) { html = value; },
        asWebviewUri: (uri: unknown) => uri, onDidReceiveMessage: () => new stub.Disposable() },
        onDidChangeVisibility: () => new stub.Disposable(),
        onDidDispose: (handler: () => void) => { dispose = handler; return new stub.Disposable(); },
        visible: true, dispose: () => dispose() };
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

test("all-on panel retains unmanaged scope, real action routes and safe metadata rendering", () => {
    const { access } = fixture();
    const html = access.buildHtml({ cspSource: "file:" }, {
        safeMode: true, protectedWorkspace: true, liveScan: true, sentinel: true, mcpFirewall: true,
        brokerRunning: true, trusted: true,
    }, descriptor('<img src=x onerror="syntheticAttack()">'), "file:///synthetic-logo.png");
    assert.match(html, /Managed paths only/);
    assert.match(html, /Other tools can still read original files/);
    assert.doesNotMatch(html, /Known gaps|Stop all AI access|Data stays on this device/);
    assert.match(html, /&lt;img/);
    assert.doesNotMatch(html, /<img src=x/);
    for (const action of ["protectFile", "protectSelection", "redactedPreview", "manageRules"]) assert.ok(html.includes('data-action="' + action + '"'));
    const script = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)?.[1];
    assert.ok(script);
    assert.doesNotThrow(() => new Function(script));
    const enforced = access.buildHtml({ cspSource: "file:" }, {
        safeMode: true, protectedWorkspace: true, liveScan: true, sentinel: true, mcpFirewall: true,
        brokerRunning: true, trusted: true,
    }, { ...descriptor("Fully enforced"), state: "FULLY_ENFORCED" }, "file:///synthetic-logo.png");
    assert.match(enforced, /Managed controls active/);
    assert.match(enforced, /do not verify agent routing or G1-G6 guarantees/);
    assert.doesNotMatch(enforced, /Fully enforced|every AI tool on this machine/);
    const lockdown = access.buildHtml({ cspSource: "file:" }, {
        safeMode: true, protectedWorkspace: true, liveScan: true, sentinel: true, mcpFirewall: true,
        brokerRunning: false, trusted: true,
    }, { ...descriptor("Lockdown"), state: "LOCKDOWN" }, "file:///synthetic-logo.png");
    assert.match(lockdown, /Routed requests<\/dt><dd[^>]*>Paused<\/dd>/);
});

test("host rejects duplicate actions while an earlier command is awaiting completion", async () => {
    const { access } = fixture();
    let calls = 0;
    let release!: () => void;
    stub.commands.registerCommand("soterai.checkBeforeSendingToAI", async () => { calls++; await new Promise<void>(resolve => { release = resolve; }); });
    const first = access.handleMessage({ type: "action:checkBeforeAI" });
    await access.handleMessage({ type: "action:checkBeforeAI" });
    assert.equal(calls, 1);
    release(); await first;
    stub.commands.registerCommand("soterai.checkBeforeSendingToAI", () => { calls++; });
    await access.handleMessage({ type: "action:checkBeforeAI" });
    assert.equal(calls, 2);
});

test("cancelled toggle does not report a confirmed setting change", async () => {
    const { access } = fixture();
    stub.commands.registerCommand("soterai.enableAISafeMode", () => undefined);
    await access.handleMessage({ type: "toggle:safeMode", value: true });
    assert.equal(access.feedback?.tone, "info");
    assert.match(access.feedback!.message, /unchanged/);
});

test("one-click panel action uses the automatic pipeline and preserves partial results", async () => {
    const { access } = fixture();
    let calls = 0;
    stub.commands.registerCommand("soterai.enableAutomaticIDEProtection", (listener: unknown) => {
        calls++;
        (listener as (update: unknown) => void)({ stage: "controls", status: "complete" });
        (listener as (update: unknown) => void)({ stage: "routing", status: "attention" });
        return { status: "attention", summary: "Local controls enabled; routing review cancelled.", changedConfigs: 0 };
    });
    await access.handleMessage({ type: "action:automaticProtection", command: "synthetic-untrusted-command" });
    assert.equal(calls, 1);
    assert.equal(access.feedback?.tone, "info");
    assert.match(access.feedback!.message, /cancelled/);
    const html = access.buildHtml({ cspSource: "file:" }, { safeMode: true, protectedWorkspace: true, liveScan: true, sentinel: true, mcpFirewall: true, brokerRunning: true, trusted: true }, descriptor(), "file:///synthetic-logo.png");
    assert.match(html, /data-setup-stage="controls" data-status="complete"/);
    assert.match(html, /data-setup-stage="routing" data-status="attention"/);
    assert.match(html, /Run setup checks again/);
    assert.doesNotMatch(html, /Run setup &amp; verify again|Run setup & verify again/);
});

test("an old render cannot replace newer status or update a disposed view", async () => {
    let release!: (value: { descriptor: ReturnType<typeof descriptor> }) => void;
    let reads = 0;
    const { provider } = fixture(async () => ++reads === 1
        ? new Promise(resolve => { release = resolve; }) : { descriptor: descriptor("Latest verified status") });
    const target = view();
    provider.resolveWebviewView(target as never);
    provider.refresh();
    await tick();
    assert.match(target.webview.html, /Latest verified status/);
    const current = target.webview.html;
    release({ descriptor: descriptor("Old status") });
    await tick();
    assert.equal(target.webview.html, current);
    target.dispose(); provider.refresh(); await tick();
    assert.equal(target.webview.html, current);
});

test("status errors present a retry without assuming protection", async () => {
    const { provider } = fixture(async () => { throw new Error("synthetic private diagnostics"); });
    const target = view(); provider.resolveWebviewView(target as never); await tick();
    assert.match(target.webview.html, /Status unavailable/);
    assert.match(target.webview.html, /Retry status check/);
    assert.doesNotMatch(target.webview.html, /synthetic private diagnostics|role="switch"/);
});
