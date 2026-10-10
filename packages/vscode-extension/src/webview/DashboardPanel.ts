import * as vscode from "vscode";
import { ExtensionState } from "../state";
import { PolicyStore } from "../firewall/PolicyStore";
import { LedgerStore } from "../firewall/LedgerStore";
import { getBrokerManager } from "../broker/BrokerManager";
import { escapeHtml, getNonce } from "../firewall/util";

interface DashboardData {
    cloudEnabled: boolean;
    policyMode: string;
    liveScanEnabled: boolean;
    latestDecision?: unknown;
    trusted: boolean;
    firewall: { available: boolean; policyExists: boolean; protectedCount: number; ledgerCount: number; lastContext: string };
    broker: { available: boolean; running: boolean; url: string; safeMode: string; memory: string; recentEvents: number };
}

export class DashboardPanel {
    public static currentPanel: DashboardPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _updateVersion = 0;
    private _disposed = false;
    private _actionPending = false;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                // Only accept messages whose command is in the allowlist.
                // This prevents unexpected or malicious payloads from the webview.
                const knownCommands: ReadonlySet<string> = new Set([
                    "scanCurrentFile",
                    "scanClipboard",
                    "openWalkthrough",
                    "openPrivacyGuarantee",
                    "openLocalPrivacyStatus",
                    "buildSafePromptForAI",
                    "runSecretBrokerDemo",
                    "showCoverageMatrix",
                    "showRuntimeCapabilitySummary",
                    "showExtensionIsolationSummary",
                    "startLocalAIBroker",
                    "testBrokerProtection",
                    "scanMCPConfigs",
                    "generateMCPSafePolicy",
                    "exportEnterprisePolicy",
                    "connectCloud",
                    "disconnectCloud",
                ]);
                const cmd = typeof message?.command === "string" ? message.command : undefined;
                if (!cmd || !knownCommands.has(cmd)) {
                    console.warn(`[SoterAI Dashboard] Rejected unknown webview message command: ${String(message?.command)}`);
                    return;
                }
                if (this._actionPending) return;
                this._actionPending = true;
                let succeeded = true;
                try {
                    switch (cmd) {
                        case "scanCurrentFile":
                            await vscode.commands.executeCommand("soterai.scanCurrentFile");
                            this.refresh();
                            break;
                        case "scanClipboard":
                            await vscode.commands.executeCommand("soterai.scanClipboard");
                            this.refresh();
                            break;
                        case "openWalkthrough":
                            await vscode.commands.executeCommand("soterai.openWalkthrough");
                            break;
                        case "openPrivacyGuarantee":
                            await vscode.commands.executeCommand("soterai.openPrivacyGuarantee");
                            break;
                        case "openLocalPrivacyStatus":
                            await vscode.commands.executeCommand("soterai.openLocalPrivacyStatus");
                            break;
                        case "buildSafePromptForAI":
                            await vscode.commands.executeCommand("soterai.buildSafePromptForAI");
                            break;
                        case "runSecretBrokerDemo":
                            await vscode.commands.executeCommand("soterai.runSecretBrokerDemo");
                            break;
                        case "showCoverageMatrix":
                            await vscode.commands.executeCommand("soterai.showCoverageMatrix");
                            break;
                        case "showRuntimeCapabilitySummary":
                            await vscode.commands.executeCommand("soterai.showRuntimeCapabilitySummary");
                            this.refresh();
                            break;
                        case "showExtensionIsolationSummary":
                            await vscode.commands.executeCommand("soterai.showExtensionIsolationSummary");
                            this.refresh();
                            break;
                        case "startLocalAIBroker":
                            await vscode.commands.executeCommand("soterai.startLocalAIBroker");
                            this.refresh();
                            break;
                        case "testBrokerProtection":
                            await vscode.commands.executeCommand("soterai.testBrokerProtection");
                            this.refresh();
                            break;
                        case "scanMCPConfigs":
                            await vscode.commands.executeCommand("soterai.scanMCPConfigs");
                            break;
                        case "generateMCPSafePolicy":
                            await vscode.commands.executeCommand("soterai.generateMCPSafePolicy");
                            break;
                        case "exportEnterprisePolicy":
                            await vscode.commands.executeCommand("soterai.exportPolicy");
                            break;
                        case "connectCloud":
                            await vscode.commands.executeCommand("soterai.connectToCloud");
                            this.refresh();
                            break;
                        case "disconnectCloud":
                            await vscode.commands.executeCommand("soterai.disconnectCloud");
                            this.refresh();
                            break;
                    }
                } catch {
                    succeeded = false;
                    void vscode.window.showErrorMessage("SoterAI could not complete this action. Review the command or try again.");
                } finally {
                    this._actionPending = false;
                    if (!this._disposed) {
                        void this._panel.webview.postMessage({ type: "actionComplete", command: cmd, succeeded });
                    }
                }
            },
            null,
            this._disposables
        );
    }

    public static createOrShow(extensionUri: vscode.Uri): DashboardPanel {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (DashboardPanel.currentPanel) {
            DashboardPanel.currentPanel._panel.reveal(column);
            DashboardPanel.currentPanel.refresh();
            return DashboardPanel.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            "soteraiDashboard",
            "SoterAI Security Dashboard",
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
                retainContextWhenHidden: true,
            }
        );

        DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri);
        return DashboardPanel.currentPanel;
    }

    public refresh(): void {
        void this._update();
    }

    private async _update(): Promise<void> {
        const updateVersion = ++this._updateVersion;
        const webview = this._panel.webview;
        const state = ExtensionState.getInstance();
        const config = vscode.workspace.getConfiguration("soterai");
        const cloudEnabled = config.get("cloud.enabled", false);
        const policyMode = config.get("policy.mode", "local");
        const liveScanEnabled = config.get("liveScan.enabled", true);
        const decision = state.latestDecision;

        // AI Context Firewall summary (no context/secrets needed here).
        let firewall = { available: false, policyExists: false, protectedCount: 0, ledgerCount: 0, lastContext: "No recorded context" };
        try {
            const policyExists = await PolicyStore.exists();
            const policy = await PolicyStore.load();
            const entries = await LedgerStore.readAll();
            const last = entries.filter((e) => e.eventType === "context_built").pop();
            firewall = {
                available: true,
                policyExists,
                protectedCount: policy.protectedFiles.length,
                ledgerCount: entries.length,
                // The dashboard needs a verdict, not any context or evidence text.
                lastContext: last ? String(last.decision).toUpperCase() : "No recorded context",
            };
        } catch {
            /* A read error is not proof that no policy exists. */
        }

        let broker = { available: false, running: false, url: "http://127.0.0.1:47321", safeMode: "Off", memory: "Idle", recentEvents: 0 };
        try {
            const manager = getBrokerManager();
            if (manager) {
                const status = await manager.status();
                const recent = status.running
                    ? await manager.request<{ events: unknown[] }>("/v1/events/recent", { method: "GET" })
                    : { events: [] };
                broker = {
                    available: true,
                    running: status.running,
                    url: status.url,
                    safeMode: status.safeMode?.enabled ? `On (${status.safeMode.level})` : "Off",
                    memory: status.memorySessionId ? "Active" : "Idle",
                    recentEvents: recent.events.length,
                };
            }
        } catch { /* broker is optional and may be stopped */ }

        // A slower earlier refresh must not replace a more recent snapshot.
        if (this._disposed || updateVersion !== this._updateVersion) return;
        webview.html = this._getHtmlForWebview(webview, {
            cloudEnabled,
            policyMode,
            liveScanEnabled,
            latestDecision: decision,
            trusted: state.isWorkspaceTrusted(),
            firewall,
            broker,
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview, data: DashboardData): string {
        const nonce = getNonce();
        const latest = data.latestDecision && typeof data.latestDecision === "object"
            ? data.latestDecision as Record<string, unknown>
            : undefined;
        const findings = Array.isArray(latest?.findings)
            ? latest.findings.filter((finding): finding is Record<string, unknown> => Boolean(finding) && typeof finding === "object")
            : [];
        const score = typeof latest?.riskScore === "number" && Number.isFinite(latest.riskScore)
            ? Math.max(0, Math.min(100, Math.round(latest.riskScore))) : undefined;
        const riskTone = score === undefined ? "neutral" : score >= 70 ? "danger" : score >= 35 ? "warning" : "neutral";
        const verdict = typeof latest?.decision === "string" ? latest.decision.toUpperCase() : "Not scanned";
        const count = (value: number): string => Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString("en-US") : "Unavailable";
        const brokerState = !data.broker.available ? "Unavailable" : data.broker.running ? "Running" : "Stopped";
        const policyState = !data.firewall.available ? "Unavailable" : data.firewall.policyExists ? "Configured" : "Not configured";
        const nextAction = !data.trusted
            ? { title: "Review workspace trust", body: "Restricted mode limits workspace-sensitive actions. Review the project before enabling them.", command: "openWalkthrough", label: "Open setup guide" }
            : !data.broker.running
                ? { title: "Enable the managed AI route", body: "Start the local broker, then configure supported AI tools to route requests through it.", command: "startLocalAIBroker", label: "Start local broker" }
                : !latest
                    ? { title: "Establish your first scan", body: "Scan the active file to see a decision and review recognized risks before sharing content.", command: "scanCurrentFile", label: "Scan current file" }
                    : findings.length > 0
                        ? { title: "Review the latest findings", body: "Review the reasons below and build a redacted prompt before sharing the scanned content.", command: "buildSafePromptForAI", label: "Build safe prompt" }
                        : { title: "Review what is covered", body: "Your latest scan has no findings. Check route coverage before relying on another tool's access.", command: "showCoverageMatrix", label: "Review coverage" };
        const routeHeading = data.broker.available && data.broker.running
            ? "Broker available for routed requests"
            : data.broker.available ? "Managed AI route is stopped" : "Broker status could not be verified";
        const routeDescription = data.broker.available && data.broker.running
            ? "Protection applies to supported traffic routed through the local broker."
            : data.broker.available
                ? "Start the broker to inspect and gate supported AI requests before they are sent."
                : "Open local privacy status to review the broker connection. Availability is not proof of protection.";
        const findingMarkup = findings.slice(0, 50).map((finding) => {
            const severity = typeof finding.severity === "string" && ["critical", "high", "medium", "low", "info"].includes(finding.severity)
                ? finding.severity : "unknown";
            const tone = severity === "critical" || severity === "high" ? "danger" : severity === "medium" ? "warning" : "neutral";
            return `<li class="finding">
                <div class="finding-heading"><span class="pill ${tone}">${escapeHtml(severity.toUpperCase())}</span><h3>${escapeHtml(String(finding.title ?? "Security finding"))}</h3></div>
                <p>${escapeHtml(String(finding.reason ?? "Review this finding before sharing the scanned content."))}</p>
                <div class="finding-meta">${escapeHtml(String(finding.category ?? "Uncategorized"))}</div>
                <details><summary>View redacted evidence</summary><pre><code>${escapeHtml(String(finding.redactedEvidence ?? "No evidence preview available."))}</code></pre></details>
            </li>`;
        }).join("");
        const shield = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m12 3 8 3v5c0 5-8 10-8 10S4 16 4 11V6l8-3Z"/><path d="m8 12 2.5 2.5L16 9"/></svg>';

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SoterAI Security Dashboard</title>
  <style>
    :root {
      color-scheme: light dark;
      --accent: #f96403;
      --surface: var(--vscode-sideBar-background, var(--vscode-editor-background));
      --border: var(--vscode-panel-border, var(--vscode-widget-border, #767676));
      --muted: var(--vscode-descriptionForeground, var(--vscode-foreground));
      --radius: 12px;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; scroll-padding-top: 24px; }
    body { margin: 0; font-family: var(--vscode-font-family, 'Segoe UI', sans-serif); font-size: var(--vscode-font-size, 13px); line-height: 1.55; color: var(--vscode-foreground); background: var(--vscode-editor-background); }
    button, a, summary { -webkit-tap-highlight-color: transparent; }
    button { font: inherit; }
    button, summary { cursor: pointer; }
    button:focus-visible, a:focus-visible, summary:focus-visible { outline: 2px solid var(--vscode-focusBorder, #007fd4); outline-offset: 4px; }
    a { color: var(--vscode-textLink-foreground); text-underline-offset: 3px; }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: clamp(24px, 3vw, 34px); line-height: 1.18; letter-spacing: -.7px; font-weight: 650; margin: 10px 0 12px; }
    h2 { font-size: 16px; font-weight: 650; line-height: 1.35; }
    h3 { font-size: 13px; font-weight: 650; }
    p { color: var(--muted); }
    .shell { max-width: 1240px; padding: 30px clamp(16px, 3.5vw, 48px) 48px; margin: 0 auto; }
    .skip-link { position: fixed; top: -80px; left: 12px; z-index: 10; padding: 10px 16px; background: var(--vscode-editor-background); border: 1px solid var(--vscode-focusBorder); border-radius: 6px; }
    .skip-link:focus { top: 12px; }
    .topbar { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding-bottom: 22px; border-bottom: 1px solid var(--border); }
    .brand { display: flex; align-items: center; gap: 11px; }
    .brand-mark { width: 40px; height: 40px; border: 1px solid var(--border); border-radius: 10px; display: grid; place-items: center; color: var(--accent); flex: none; }
    .brand-name { font-weight: 700; font-size: 17px; letter-spacing: -.3px; }
    .brand-caption { color: var(--muted); font-size: 11px; }
    .top-actions, .pills, .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .nav { display: flex; flex-wrap: wrap; gap: 6px; padding: 18px 0 4px; }
    .nav a { color: var(--muted); text-decoration: none; border-radius: 6px; padding: 6px 10px; }
    .nav a:hover { color: var(--vscode-foreground); background: var(--vscode-list-hoverBackground); }
    .eyebrow { color: var(--muted); text-transform: uppercase; letter-spacing: 1.2px; font-size: 10px; font-weight: 700; }
    .hero { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(240px, 1fr); gap: 36px; align-items: center; padding: 30px 0; }
    .hero-copy p { max-width: 610px; font-size: 13px; }
    .next-action { padding: 20px; background: var(--surface); border: 1px solid var(--border); border-top: 2px solid var(--accent); border-radius: var(--radius); }
    .next-action h2 { margin: 7px 0 7px; }
    .next-action p { font-size: 12px; margin-bottom: 16px; }
    .btn { min-height: 34px; padding: 7px 12px; border: 1px solid var(--vscode-contrastBorder, transparent); border-radius: 6px; display: inline-flex; justify-content: center; align-items: center; gap: 7px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); font-size: 12px; font-weight: 600; line-height: 1.4; }
    .btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .btn.primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .btn.primary:hover { background: var(--vscode-button-hoverBackground); }
    .btn.quiet { color: var(--vscode-foreground); background: transparent; border-color: var(--border); }
    .btn.quiet:hover { background: var(--vscode-list-hoverBackground); }
    .btn:disabled { opacity: .65; cursor: progress; }
    .pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; border: 1px solid var(--border); border-radius: 5px; font-size: 10px; font-weight: 600; line-height: 1.5; color: var(--muted); }
    .pill .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .positive { color: var(--vscode-testing-iconPassed, var(--vscode-foreground)); }
    .warning { color: var(--vscode-editorWarning-foreground, var(--vscode-foreground)); }
    .danger { color: var(--vscode-editorError-foreground, var(--vscode-foreground)); }
    .boundary { border: 1px solid var(--border); border-left: 3px solid var(--vscode-editorWarning-foreground, var(--accent)); border-radius: 8px; padding: 15px 18px; display: flex; gap: 18px; align-items: center; justify-content: space-between; margin-bottom: 24px; background: var(--surface); }
    .boundary strong { display: block; font-size: 12px; margin-bottom: 3px; }
    .boundary p { font-size: 12px; max-width: 770px; }
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 30px; }
    .metric { border: 1px solid var(--border); border-radius: 9px; padding: 16px; min-width: 0; }
    .metric-label { display: block; color: var(--muted); font-size: 11px; margin-bottom: 7px; }
    .metric-value { font-size: 24px; font-weight: 650; letter-spacing: -.5px; line-height: 1.3; overflow-wrap: anywhere; }
    .metric-value small { color: var(--muted); font-size: 12px; letter-spacing: 0; font-weight: 400; }
    .metric-note { display: block; color: var(--muted); font-size: 11px; margin-top: 7px; }
    .content-grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 18px; margin-bottom: 30px; align-items: start; }
    .card { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; min-width: 0; }
    .card-heading { padding: 20px 20px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .card-heading p { margin-top: 5px; font-size: 12px; }
    .card-content { padding: 20px; }
    .card-content > p { font-size: 12px; }
    .card .actions { margin-top: 17px; }
    .section-heading { display: flex; gap: 16px; justify-content: space-between; align-items: end; margin: 0 0 15px; }
    .section-heading p { font-size: 12px; margin-top: 5px; }
    .details-list { margin: 0; display: grid; gap: 13px; }
    .details-list > div { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 16px; align-items: baseline; }
    .details-list dt { font-size: 12px; color: var(--muted); }
    .details-list dd { margin: 0; font-size: 12px; font-weight: 600; text-align: right; overflow-wrap: anywhere; }
    .endpoint { font-family: var(--vscode-editor-font-family, monospace); font-size: 11px !important; }
    .scope-note { padding: 13px; background: var(--surface); border-radius: 6px; margin-top: 18px; }
    .scope-note strong { display: block; font-size: 12px; margin-bottom: 4px; }
    .scope-note p { font-size: 11px; }
    .tools { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 30px; }
    .tool { border: 1px solid var(--border); border-radius: 9px; padding: 18px; display: flex; flex-direction: column; align-items: flex-start; min-width: 0; }
    .tool-index { font-family: var(--vscode-editor-font-family, monospace); color: var(--muted); font-size: 10px; margin-bottom: 12px; }
    .tool h3 { margin-bottom: 7px; }
    .tool p { font-size: 12px; flex: 1; margin-bottom: 17px; }
    .findings { padding: 0; margin: 0; list-style: none; }
    .finding { padding: 18px 20px; }
    .finding + .finding { border-top: 1px solid var(--border); }
    .finding-heading { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; margin-bottom: 7px; }
    .finding p { font-size: 12px; overflow-wrap: anywhere; }
    .finding-meta { color: var(--muted); font-size: 11px; margin-top: 7px; }
    details { margin-top: 12px; }
    summary { font-size: 11px; color: var(--vscode-textLink-foreground); width: fit-content; }
    pre { margin: 10px 0 0; padding: 12px; border-radius: 5px; background: var(--vscode-textCodeBlock-background, var(--surface)); white-space: pre-wrap; overflow-wrap: anywhere; font-family: var(--vscode-editor-font-family, monospace); font-size: 11px; }
    .empty { padding: 32px 20px; text-align: center; }
    .empty strong { display: block; font-size: 14px; margin-bottom: 7px; }
    .empty p { max-width: 480px; margin: 0 auto; font-size: 12px; }
    .empty .actions { justify-content: center; }
    .footer { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 11px; color: var(--muted); }
    .action-status { min-height: 18px; }
    @media (max-width: 800px) { .hero { gap: 20px; } .tools { grid-template-columns: repeat(2, minmax(0, 1fr)); } .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); } .content-grid { grid-template-columns: minmax(0, 1fr); } }
    @media (max-width: 540px) { .shell { padding-top: 18px; } .topbar, .hero, .boundary { align-items: stretch; } .topbar, .boundary { flex-direction: column; gap: 12px; } .hero { grid-template-columns: minmax(0, 1fr); padding: 24px 0; } .tools { grid-template-columns: minmax(0, 1fr); } .metric { padding: 13px; } .metric-value { font-size: 20px; } .card-heading, .card-content, .finding { padding: 16px; } .boundary .btn { align-self: flex-start; } .details-list > div { grid-template-columns: minmax(0, 1fr); gap: 3px; } .details-list dd { text-align: left; } }
    @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } *, *::before, *::after { animation: none !important; transition: none !important; } }
    @media (forced-colors: active) { .btn, .card, .tool, .metric, .pill, .next-action, .boundary { border-color: CanvasText; } .brand-mark { color: CanvasText; } }
  </style>
</head>
<body>
  <a class="skip-link" href="#overview">Skip to overview</a>
  <div class="shell">
    <header class="topbar">
      <div class="brand"><div class="brand-mark">${shield}</div><div><div class="brand-name">SoterAI</div><div class="brand-caption">Security operations</div></div></div>
      <div class="top-actions"><span class="pill ${data.trusted ? "neutral" : "warning"}"><span class="dot" aria-hidden="true"></span>${data.trusted ? "Trusted workspace" : "Restricted workspace"}</span><button class="btn quiet" data-command="openWalkthrough">Setup guide</button></div>
    </header>
    <nav class="nav" aria-label="Dashboard sections"><a href="#overview">Overview</a><a href="#controls">Controls</a><a href="#findings">Findings${latest ? ` (${count(findings.length)})` : ""}</a><a href="#trust">Trust center</a></nav>
    <main>
      <section class="hero" id="overview" tabindex="-1" aria-labelledby="overview-heading">
        <div class="hero-copy"><div class="eyebrow">Workspace overview</div><h1 id="overview-heading">Security you can inspect.</h1><p>Review the latest scan, manage the local AI route, and understand where protection applies before sharing project data.</p><div class="pills" style="margin-top:17px;"><span class="pill">Live scanning ${data.liveScanEnabled ? "on" : "off"}</span><span class="pill">Policy: ${escapeHtml(String(data.policyMode))}</span><span class="pill">${data.cloudEnabled ? "Cloud sync configured" : "Cloud sync disabled"}</span></div></div>
        <aside class="next-action" aria-labelledby="next-action-heading"><div class="eyebrow">Recommended next step</div><h2 id="next-action-heading">${nextAction.title}</h2><p>${nextAction.body}</p><button class="btn primary" data-command="${nextAction.command}">${nextAction.label}<span aria-hidden="true"> →</span></button></aside>
      </section>

      <aside class="boundary" aria-label="Protection boundary"><div><strong>Protection has a defined boundary</strong><p>Controls apply to managed SoterAI paths. Other extensions, direct file reads, raw terminals and independent network traffic can bypass them. A scan result is not a percentage of your data protected.</p></div><button class="btn quiet" data-command="showCoverageMatrix">View coverage</button></aside>

      <div class="metrics" aria-label="Current security indicators">
        <div class="metric"><span class="metric-label">Latest scan risk</span><div class="metric-value ${riskTone}">${score === undefined ? "—" : score}<small>${score === undefined ? "" : " / 100"}</small></div><span class="metric-note">${latest ? "Scanned content only; not coverage" : "Run a scan to establish a result"}</span></div>
        <div class="metric"><span class="metric-label">Latest scan findings</span><div class="metric-value">${latest ? count(findings.length) : "—"}</div><span class="metric-note">${escapeHtml(verdict)}</span></div>
        <div class="metric"><span class="metric-label">Protected file patterns</span><div class="metric-value">${data.firewall.available ? count(data.firewall.protectedCount) : "—"}</div><span class="metric-note">Project policy: ${policyState.toLowerCase()}</span></div>
        <div class="metric"><span class="metric-label">Local broker</span><div class="metric-value" style="font-size:20px;">${brokerState}</div><span class="metric-note">${data.broker.running && data.broker.available ? "Connect AI tools to this route" : "Routed protection not verified"}</span></div>
      </div>

      <div class="section-heading" id="controls"><div><h2>Protection controls</h2><p>Inspect content and configure the path your AI tools use.</p></div></div>
      <div class="content-grid">
        <section class="card" aria-labelledby="scan-heading">
          <div class="card-heading"><div><h2 id="scan-heading">Scan &amp; share</h2><p>Review recognized risks before copying content into an AI tool.</p></div><span class="pill">${latest ? "Result available" : "Not scanned"}</span></div>
          <div class="card-content"><p>File and clipboard checks inspect selected content. Safe prompts use redaction and references; review unmarked private information yourself.</p><div class="actions"><button class="btn primary" data-command="scanCurrentFile">Scan current file</button><button class="btn" data-command="scanClipboard">Scan clipboard</button><button class="btn quiet" data-command="buildSafePromptForAI">Build safe prompt</button></div><div class="scope-note"><strong>Local privacy, with clear limits</strong><p>Secrets are handled through references, redaction and brokered local actions. Direct access outside those paths remains possible.</p><div class="actions"><button class="btn quiet" data-command="openPrivacyGuarantee">What stays local</button><button class="btn quiet" data-command="openLocalPrivacyStatus">Privacy status</button><button class="btn quiet" data-command="runSecretBrokerDemo">Try a synthetic demo</button></div></div></div>
        </section>
        <section class="card" aria-labelledby="broker-heading">
          <div class="card-heading"><div><h2 id="broker-heading">Local AI broker</h2><p>Inspect and gate supported requests routed through loopback.</p></div><span class="pill ${data.broker.running && data.broker.available ? "positive" : "warning"}">${brokerState}</span></div>
          <div class="card-content"><dl class="details-list"><div><dt>Endpoint</dt><dd class="endpoint">${escapeHtml(data.broker.url)}</dd></div><div><dt>Safe mode</dt><dd>${data.broker.available ? escapeHtml(data.broker.safeMode) : "Unavailable"}</dd></div><div><dt>Memory session</dt><dd>${data.broker.available ? escapeHtml(data.broker.memory) : "Unavailable"}</dd></div><div><dt>Recent broker events</dt><dd>${data.broker.available ? count(data.broker.recentEvents) : "Unavailable"}</dd></div></dl><div class="scope-note"><strong>${routeHeading}</strong><p>${routeDescription}</p></div><div class="actions"><button class="btn ${data.broker.running ? "" : "primary"}" data-command="startLocalAIBroker">${data.broker.running ? "Refresh broker status" : "Start local broker"}</button><button class="btn quiet" data-command="testBrokerProtection">Run self-test</button></div><p style="font-size:11px;margin-top:14px;">Local auth tokens and provider keys are never sent to this webview.</p></div>
        </section>
        <section class="card" aria-labelledby="policy-heading">
          <div class="card-heading"><div><h2 id="policy-heading">AI context policy</h2><p>Project rules and a record of managed context decisions.</p></div><span class="pill">${policyState}</span></div>
          <div class="card-content"><dl class="details-list"><div><dt>Protected patterns</dt><dd>${data.firewall.available ? count(data.firewall.protectedCount) : "Unavailable"}</dd></div><div><dt>Recorded ledger events</dt><dd>${data.firewall.available ? count(data.firewall.ledgerCount) : "Unavailable"}</dd></div><div><dt>Last context decision</dt><dd>${data.firewall.available ? escapeHtml(data.firewall.lastContext) : "Unavailable"}</dd></div></dl><p style="margin-top:16px;">${data.firewall.available ? "Rules and audit events apply to managed context. Workspace-writable policy is not an independent security boundary." : "Policy status could not be loaded. Open a project and check local privacy status before relying on these controls."}</p><div class="actions"><button class="btn quiet" data-command="exportEnterprisePolicy">Export policy</button><button class="btn quiet" data-command="openLocalPrivacyStatus">Review status</button></div></div>
        </section>
        <section class="card" aria-labelledby="cloud-heading">
          <div class="card-heading"><div><h2 id="cloud-heading">Cloud connection</h2><p>Optional sync and configured policy mode.</p></div><span class="pill">${data.cloudEnabled ? "Configured" : "Disabled"}</span></div>
          <div class="card-content"><dl class="details-list"><div><dt>Cloud sync setting</dt><dd>${data.cloudEnabled ? "Enabled" : "Disabled"}</dd></div><div><dt>Policy mode</dt><dd>${escapeHtml(String(data.policyMode).toUpperCase())}</dd></div></dl><p style="margin-top:16px;">${data.cloudEnabled ? "Cloud is configured. Review the privacy status for data handling and connection details." : "Local scans and managed broker controls are available without cloud sync."}</p><div class="actions"><button class="btn quiet" data-command="${data.cloudEnabled ? "disconnectCloud" : "connectCloud"}">${data.cloudEnabled ? "Disconnect cloud" : "Connect cloud"}</button><button class="btn quiet" data-command="openPrivacyGuarantee">Review privacy details</button></div></div>
        </section>
      </div>

      <section id="findings" aria-labelledby="findings-heading" style="margin-bottom:30px;">
        <div class="section-heading"><div><h2 id="findings-heading">Latest security findings</h2><p>${latest ? "Results from the latest scanned content." : "Start with a scan; no workspace-wide conclusion is available yet."}</p></div>${latest ? `<span class="pill">${count(findings.length)} finding(s)</span>` : ""}</div>
        <div class="card">${findings.length ? `<ul class="findings">${findingMarkup}</ul>${findings.length > 50 ? '<div class="card-content"><p>Showing the first 50 findings. Review the full scan report for the remaining results.</p></div>' : ""}` : `<div class="empty"><strong>${latest ? "No findings in this scan" : "Your first scan starts here"}</strong><p>${latest ? "Recognized detectors found no risks in this content. Unscanned files, unmarked private text and other tools' traffic are outside this result." : "Scan the active file or clipboard to see a decision, an explanation and redacted evidence. No scan means no risk assessment."}</p><div class="actions"><button class="btn primary" data-command="scanCurrentFile">Scan current file</button><button class="btn quiet" data-command="scanClipboard">Scan clipboard</button></div></div>`}</div>
      </section>

      <section id="trust" aria-labelledby="trust-heading"><div class="section-heading"><div><h2 id="trust-heading">Trust center</h2><p>Coverage, runtime, MCP and policy reports for an informed review.</p></div></div><div class="tools">
        <article class="tool"><span class="tool-index">01 / COVERAGE</span><h3>Route coverage</h3><p>See which routes are enforced, redacted, monitored or outside visibility.</p><button class="btn quiet" data-command="showCoverageMatrix">Open coverage matrix</button></article>
        <article class="tool"><span class="tool-index">02 / RUNTIME</span><h3>Runtime posture</h3><p>Review broker capabilities and direct terminal or extension paths that bypass them.</p><button class="btn quiet" data-command="showRuntimeCapabilitySummary">Review runtime</button></article>
        <article class="tool"><span class="tool-index">03 / ISOLATION</span><h3>Extension isolation</h3><p>Review AI-like extensions and the limits of SoterAI's visibility into them.</p><button class="btn quiet" data-command="showExtensionIsolationSummary">Review isolation</button></article>
        <article class="tool"><span class="tool-index">04 / MCP</span><h3>MCP configuration</h3><p>Check MCP configs for shell access, secret env keys, broad file access and risky tool descriptions.</p><button class="btn quiet" data-command="scanMCPConfigs">Scan MCP configs</button></article>
        <article class="tool"><span class="tool-index">05 / LEAST PRIVILEGE</span><h3>MCP policy</h3><p>Generate a least-privilege policy artifact without displaying environment secret values.</p><button class="btn quiet" data-command="generateMCPSafePolicy">Generate MCP policy</button></article>
        <article class="tool"><span class="tool-index">06 / GOVERNANCE</span><h3>Enterprise review</h3><p>Export project policy and pair it with coverage, runtime and local risk reports.</p><button class="btn quiet" data-command="exportEnterprisePolicy">Export enterprise policy</button></article>
      </div></section>
    </main>
    <footer class="footer"><span>Local-first controls · Explicit coverage · Reviewable decisions</span><span class="action-status" id="actionStatus" role="status" aria-live="polite">Ready</span></footer>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const saved = vscode.getState() || {};
    const status = document.getElementById('actionStatus');
    const buttons = Array.from(document.querySelectorAll('button[data-command]'));
    let pending = false;
    let focusIndex = Number.isInteger(saved.focusIndex) ? saved.focusIndex : -1;
    const persist = () => vscode.setState({ scrollY: window.scrollY, focusIndex, openEvidence: Array.from(document.querySelectorAll('.finding details')).map((item, index) => item.open ? index : -1).filter(index => index >= 0) });
    document.querySelectorAll('.finding details').forEach((item, index) => {
      item.open = Array.isArray(saved.openEvidence) && saved.openEvidence.includes(index);
      item.addEventListener('toggle', persist);
    });
    if (typeof saved.scrollY === 'number' && Number.isFinite(saved.scrollY)) requestAnimationFrame(() => window.scrollTo(0, Math.max(0, saved.scrollY)));
    if (buttons[focusIndex]) requestAnimationFrame(() => buttons[focusIndex].focus({ preventScroll: true }));
    let scrollTimer;
    window.addEventListener('scroll', () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(persist, 100); }, { passive: true });
    buttons.forEach(button => button.addEventListener('click', () => {
      if (pending) return;
      pending = true;
      focusIndex = buttons.indexOf(button);
      buttons.forEach(item => item.disabled = true);
      status.textContent = 'Opening ' + button.textContent.trim().replace(/\\s+/g, ' ') + '…';
      persist();
      vscode.postMessage({ command: button.dataset.command });
    }));
    window.addEventListener('message', event => {
      if (event.data?.type !== 'actionComplete') return;
      pending = false;
      buttons.forEach(item => item.disabled = false);
      if (buttons[focusIndex]) buttons[focusIndex].focus({ preventScroll: true });
      status.textContent = event.data.succeeded === false ? 'Action could not finish. Review the notification and try again.' : 'Ready';
    });
  </script>
</body>
</html>`;
    }

    public dispose(): void {
        if (this._disposed) return;
        this._disposed = true;
        DashboardPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) x.dispose();
        }
    }
}


