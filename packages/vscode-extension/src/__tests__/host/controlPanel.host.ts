/**
 * Real VS Code host verification for the Control Panel.
 *
 * Everything else in src/__tests__ runs under `tsx --test` WITHOUT a VS Code
 * host, so those tests read source text and assert on it. That is exactly the
 * blind spot that let 0.3.0 ship four features which reported protection while
 * doing nothing: a string can be present and correct while the behaviour it
 * describes never happens.
 *
 * This suite runs INSIDE a real extension host. It activates the extension,
 * resolves the webview for real, and asserts on rendered HTML and on the
 * settings a message actually changes. It is the only place where a claim about
 * runtime behaviour is earned rather than inferred.
 *
 * Run: npm run test:host
 */

import * as assert from "assert";
import * as vscode from "vscode";

import { ControlPanelViewProvider } from "../../webview/ControlPanelViewProvider";
import { panelTasks, plainControls, primaryCta } from "../../webview/panelContent";

const EXTENSION_ID = "soterai.soterai-ide-guard";

/** Minimal stand-in for the WebviewView the window normally supplies. */
interface Rendered {
    html: string;
    post: (message: unknown) => Promise<void>;
}

/**
 * Resolve the provider against a fake WebviewView and capture what it renders.
 *
 * The provider is constructed directly with the same dependency shape
 * extension.ts uses, so the code path under test is the shipping one.
 */
async function renderPanel(context: vscode.ExtensionContext): Promise<Rendered> {
    let html = "";
    let onMessage: ((message: unknown) => unknown) | undefined;

    const webview = {
        options: {},
        set html(value: string) {
            html = value;
        },
        get html(): string {
            return html;
        },
        onDidReceiveMessage(listener: (message: unknown) => unknown) {
            onMessage = listener;
            return { dispose() { /* no-op */ } };
        },
        asWebviewUri: (uri: vscode.Uri) => uri,
        cspSource: "vscode-webview:",
        postMessage: async () => true,
    };

    const view = {
        webview,
        visible: true,
        onDidDispose: () => ({ dispose() { /* no-op */ } }),
        onDidChangeVisibility: () => ({ dispose() { /* no-op */ } }),
        show: () => { /* no-op */ },
        title: "",
        description: "",
        viewType: ControlPanelViewProvider.viewType,
    };

    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(extension, `${EXTENSION_ID} must be installed in the test host`);
    await extension!.activate();

    const provider = new ControlPanelViewProvider(context, {
        workspaceGuard: { isEnabled: false } as never,
        sentinel: { isEnabled: false } as never,
        brokerManager: { status: async () => ({ running: false }) } as never,
        protectionState: {
            refresh: async () => ({
                descriptor: {
                    state: "MONITORING_ONLY",
                    title: "Monitoring only",
                    explanation: "Risks can be observed, but supported AI traffic is not currently being technically controlled.",
                    severity: "warning",
                    activeControls: [],
                    inactiveControls: [],
                    coverage: "AI integration coverage unknown until an integration is detected",
                    recommendedAction: "Enable Full Protection and route AI traffic through the local broker.",
                    allowedTransitions: [],
                },
            }),
        } as never,
        refreshViews: () => { /* no-op */ },
    });

    provider.resolveWebviewView(view as never);

    // resolveWebviewView kicks off an async render; wait for the html to land.
    for (let i = 0; i < 100 && !html; i++) {
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.ok(html, "the panel rendered no HTML at all");

    return {
        html,
        post: async (message: unknown) => {
            assert.ok(onMessage, "the panel registered no message listener");
            await onMessage!(message);
        },
    };
}

export function run(): Promise<void> {
    return new Promise((resolve, reject) => {
        const failures: string[] = [];
        const passes: string[] = [];

        const check = (name: string, fn: () => void | Promise<void>) =>
            Promise.resolve()
                .then(fn)
                .then(() => {
                    passes.push(name);
                    console.log("  ok   " + name);
                })
                .catch((error: unknown) => {
                    const detail = error instanceof Error ? error.message : String(error);
                    failures.push(`${name}: ${detail}`);
                    console.log("  FAIL " + name + " -> " + detail);
                });

        void (async () => {
            const extension = vscode.extensions.getExtension(EXTENSION_ID);
            if (!extension) {
                reject(new Error(`${EXTENSION_ID} is not installed in the test host`));
                return;
            }
            const context = (await extension.activate()) as unknown as { context?: vscode.ExtensionContext };

            // The activate() return value is the extension's public API, not the
            // context, so build a context-shaped object for the provider. Only
            // globalState is read by gatherState().
            const fakeContext = {
                globalState: {
                    get: () => undefined,
                    update: async () => undefined,
                },
                subscriptions: [],
            } as unknown as vscode.ExtensionContext;
            void context;

            const panel = await renderPanel(fakeContext);

            await check("the extension activates in a real host", () => {
                assert.strictEqual(extension.isActive, true);
            });

            await check("the panel renders real HTML with a CSP and a nonce", () => {
                assert.match(panel.html, /<!DOCTYPE html>/);
                assert.match(panel.html, /Content-Security-Policy/);
                assert.match(panel.html, /script-src 'nonce-[A-Za-z0-9]+'/);
                assert.ok(
                    !/script-src[^;]*'unsafe-inline'/.test(panel.html),
                    "scripts must never be unsafe-inline",
                );
            });

            await check("every rendered control comes from the content model", () => {
                for (const control of plainControls({
                    safeMode: false,
                    protectedWorkspace: false,
                    liveScan: vscode.workspace.getConfiguration("soterai").get("liveScan.enabled", true),
                    sentinel: false,
                    mcpFirewall: false,
                    brokerRunning: false,
                    trusted: vscode.workspace.isTrusted,
                })) {
                    assert.ok(
                        panel.html.includes(control.label),
                        `control "${control.label}" is missing from the rendered panel`,
                    );
                }
            });

            await check("every task button is actually rendered", () => {
                for (const task of panelTasks()) {
                    assert.ok(
                        panel.html.includes(task.label),
                        `task "${task.label}" is missing from the rendered panel`,
                    );
                    const id = task.action.replace("action:", "");
                    assert.ok(
                        panel.html.includes(`data-action="${id}"`),
                        `task "${task.label}" has no clickable button`,
                    );
                }
            });

            await check("the focus-restoration code is present in the rendered document", () => {
                // The a11y fix: the panel replaces its whole document on every
                // render, so focus must be saved and restored across that.
                assert.match(panel.html, /acquireVsCodeApi\(\)/);
                assert.match(panel.html, /getState\(\)/);
                assert.match(panel.html, /setState\(/);
                assert.match(panel.html, /data-focus=/);
            });

            await check("toggling Live Scan from the panel really changes the setting", async () => {
                // This is the assertion the source-level tests cannot make: it
                // proves the message actually reaches VS Code and mutates state.
                const config = () => vscode.workspace.getConfiguration("soterai");
                const original = config().get<boolean>("liveScan.enabled", true);
                try {
                    await panel.post({ type: "toggle:liveScan", value: !original });
                    for (let i = 0; i < 50 && config().get<boolean>("liveScan.enabled", true) === original; i++) {
                        await new Promise((r) => setTimeout(r, 20));
                    }
                    assert.strictEqual(
                        config().get<boolean>("liveScan.enabled", true),
                        !original,
                        "the panel toggle did not change the real setting",
                    );
                } finally {
                    await config().update("liveScan.enabled", original, vscode.ConfigurationTarget.Global);
                }
            });

            await check("a message outside the allowlist changes nothing", async () => {
                const config = () => vscode.workspace.getConfiguration("soterai");
                const before = config().get<boolean>("liveScan.enabled", true);
                await panel.post({ type: "toggle:../../etc/passwd", value: true });
                await panel.post({ type: "action:executeArbitrary" });
                await panel.post({ value: true });
                assert.strictEqual(
                    config().get<boolean>("liveScan.enabled", true),
                    before,
                    "a rejected message still changed state",
                );
            });

            await check("every command the panel can invoke exists in this host", async () => {
                const registered = new Set(await vscode.commands.getCommands(true));
                const invoked = [
                    "soterai.enableAISafeMode", "soterai.disableAISafeMode",
                    "soterai.enableProtectedWorkspace", "soterai.disableProtectedWorkspace",
                    "soterai.enableAISentinel", "soterai.disableAISentinel",
                    "soterai.emergencyLockdown", "soterai.showCoverageMatrix",
                    "soterai.setupBrokerIntegration", "soterai.runControlledTerminalCommand",
                    "soterai.scanClipboard", "soterai.preflightMCPTool",
                    "soterai.checkDependencyInstall", "soterai.enableFullProtection",
                    "soterai.unlockProtection",
                ];
                for (const command of invoked) {
                    assert.ok(registered.has(command), `${command} is not registered in the host`);
                }
            });

            await check("the lockdown CTA maps to a command that exists", async () => {
                const registered = new Set(await vscode.commands.getCommands(true));
                const cta = primaryCta("LOCKDOWN", {
                    safeMode: true, protectedWorkspace: true, liveScan: true,
                    sentinel: true, mcpFirewall: true, brokerRunning: true, trusted: true,
                });
                assert.strictEqual(cta.action, "action:unlock");
                assert.ok(registered.has("soterai.unlockProtection"));
            });

            console.log(`\n${passes.length} passed, ${failures.length} failed`);
            if (failures.length > 0) {
                reject(new Error(`${failures.length} host test(s) failed:\n  ` + failures.join("\n  ")));
            } else {
                resolve();
            }
        })().catch(reject);
    });
}
