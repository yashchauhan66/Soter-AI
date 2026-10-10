import * as vscode from "vscode";
import { escapeHtml, getNonce } from "../firewall/util";
import { PROTECTION } from "../protection/ProtectionLevel";
import {
    panelTasks,
    plainControls,
    privacyBoundary,
    primaryCta,
    type PanelFacts,
    type PlainControl,
} from "./panelContent";
import type { WorkspaceGuard } from "../workspace-guard/WorkspaceGuard";
import type { AISentinel } from "../sentinel/AISentinel";
import type { BrokerManager } from "../broker/BrokerManager";
import type { ProtectionStateService } from "../protection/ProtectionStateService";
import { managedControlReasons } from "../enterprise/managedSettingsProbe";
import { controlPanelStyles } from "./controlPanelStyles";
import { AUTOMATIC_SETUP_STAGES, type SetupStage, type SetupStageStatus, type SetupProgress, type AutomaticSetupResult } from "../protection/AutomaticIDEProtection";

/**
 * SoterAI Control Panel — enterprise-grade sidebar surface.
 *
 * Design rules:
 *   - Every toggle maps to an existing command — one source of truth.
 *   - Badges are registry-resolved: only ENFORCED when SoterAI technically
 *     controls that path.
 *   - The webview never receives secrets, tokens, or raw file content.
 *   - Logo (logo_circle_whiter.png) is served as a local webview resource.
 */
export class ControlPanelViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "soterai-control-panel";

    private view?: vscode.WebviewView;
    private feedback?: { tone: "success" | "error" | "info"; message: string };
    private actionPending = false;
    private renderRevision = 0;
    private setupSteps: Partial<Record<SetupStage, SetupStageStatus>> = {};
    private setupResult?: AutomaticSetupResult;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly deps: {
            workspaceGuard: WorkspaceGuard;
            sentinel: AISentinel;
            brokerManager: BrokerManager;
            protectionState: ProtectionStateService;
            refreshViews: () => void;
        },
    ) {}

    public resolveWebviewView(webviewView: vscode.WebviewView): void {
        this.view = webviewView;

        // Allow the logo to be loaded as a local resource.
        const mediaUri = vscode.Uri.joinPath(this.context.extensionUri, "media");
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [mediaUri],
        };

        this.context.subscriptions.push(webviewView.webview.onDidReceiveMessage(async (message: unknown) => {
            await this.handleMessage(message);
        }));

        this.context.subscriptions.push(webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) void this.render();
        }), webviewView.onDidDispose(() => {
            if (this.view === webviewView) { this.view = undefined; this.renderRevision++; }
        }));

        void this.render();
    }

    public refresh(): void {
        if (this.view) void this.render();
    }

    // ── allowlist ────────────────────────────────────────────────────────────
    private static readonly ALLOWED = new Set([
        "toggle:safeMode",
        "toggle:protectedWorkspace",
        "toggle:liveScan",
        "toggle:sentinel",
        "toggle:mcpFirewall",
        "action:lockdown",
        "action:openCoverage",
        "action:refresh",
        "action:setupBroker",
        "action:fullProtection",
        "action:automaticProtection",
        "action:controlledTerminal",
        "action:scanClipboard",
        "action:checkBeforeAI",
        "action:protectSecrets",
        "action:secureAI",
        "action:mcpPreflight",
        "action:depGuard",
        "action:unlock",
        "action:openWalkthrough",
        "action:openRisk",
        "action:openFindings",
        "action:openPolicy",
        "action:openWebsite",
        "action:openDocs",
        "action:reportIssue",
        "action:protectFile",
        "action:protectSelection",
        "action:redactedPreview",
        "action:manageRules",
    ]);

    private static readonly RESOURCE_LINKS: Record<string, { url: string; label: string }> = {
        "action:openWebsite": { url: "https://soterai.in", label: "soterai.in" },
        "action:openDocs":    { url: "https://soterai.in/vscode-ai-security", label: "Documentation" },
        "action:reportIssue": { url: "https://github.com/yashchauhan66/Soter-AI/issues", label: "Report an issue" },
    };

    // ── message handling ─────────────────────────────────────────────────────
    private async handleMessage(message: unknown): Promise<void> {
        if (!message || typeof message !== "object" || Array.isArray(message)) return;
        const msg = message as Record<string, unknown>;
        const type = typeof msg.type === "string" ? msg.type : undefined;
        if (!type || !ControlPanelViewProvider.ALLOWED.has(type)) {
            // Rejected message: silently ignore untrusted webview input. Do not
            // log attacker-controlled content or show a notification.
            return;
        }
        const isToggle = type.startsWith("toggle:");
        // Toggle payloads mutate state, so require their exact schema. Actions
        // intentionally ignore every field except the allowlisted type: this keeps
        // destinations and command arguments host-owned even if a compromised
        // webview supplies a `url`, `command`, or other attacker-controlled field.
        if (isToggle && (
            typeof msg.value !== "boolean"
            || Object.keys(msg).some((key) => key !== "type" && key !== "value")
        )) return;
        if (type === "action:refresh") { await this.render(); return; }
        // A disabled button alone is insufficient: messages can be repeated or
        // forged. Serialize host-side operations, including pending dialogs.
        if (this.actionPending) return;
        const on = msg.value === true;

        // GAP 3: refuse a toggle an administrator pinned. VS Code keeps the
        // policy value regardless, so writing it would look like it worked and
        // change nothing — the worst outcome for a security control.
        const managed = managedControlReasons();
        const controlForToggle: Record<string, keyof typeof managed> = {
            "toggle:protectedWorkspace": "protectedWorkspace",
            "toggle:sentinel": "sentinel",
        };
        const pinnedControl = controlForToggle[type];
        if (pinnedControl && managed[pinnedControl]) {
            vscode.window.showWarningMessage(`SoterAI: ${managed[pinnedControl]}`);
            await this.render();
            return;
        }

        this.actionPending = true;
        try {
            switch (type) {
                case "toggle:safeMode":
                    await vscode.commands.executeCommand(on ? "soterai.enableAISafeMode" : "soterai.disableAISafeMode");
                    break;
                case "toggle:protectedWorkspace":
                    await vscode.commands.executeCommand(on ? "soterai.enableProtectedWorkspace" : "soterai.disableProtectedWorkspace");
                    break;
                case "toggle:liveScan":
                    await vscode.workspace.getConfiguration("soterai").update("liveScan.enabled", on, vscode.ConfigurationTarget.Global);
                    break;
                case "toggle:sentinel":
                    await vscode.commands.executeCommand(on ? "soterai.enableAISentinel" : "soterai.disableAISentinel");
                    break;
                case "toggle:mcpFirewall":
                    await vscode.workspace.getConfiguration("soterai").update("mcpFirewall.strictMode", on, vscode.ConfigurationTarget.Global);
                    break;
                case "action:lockdown":
                    await vscode.commands.executeCommand("soterai.emergencyLockdown");
                    break;
                case "action:openCoverage":
                    await vscode.commands.executeCommand("soterai.showCoverageMatrix");
                    break;
                case "action:refresh":
                    break;
                case "action:setupBroker":
                    await vscode.commands.executeCommand("soterai.setupBrokerIntegration");
                    break;
                case "action:fullProtection":
                    await vscode.commands.executeCommand("soterai.enableFullProtection");
                    break;
                case "action:automaticProtection": {
                    this.setupResult = undefined;
                    this.setupSteps = { controls: "running", routing: "waiting", verification: "waiting" };
                    await this.render();
                    const report = (update: SetupProgress) => {
                        if (!update || !AUTOMATIC_SETUP_STAGES.some((item) => item.id === update.stage)
                            || !["waiting", "running", "complete", "attention", "failed"].includes(update.status)) return;
                        this.setupSteps[update.stage] = update.status;
                        void this.view?.webview.postMessage?.({ type: "setupProgress", stage: update.stage, status: update.status });
                    };
                    const result = await vscode.commands.executeCommand<AutomaticSetupResult>("soterai.enableAutomaticIDEProtection", report);
                    this.setupResult = result && ["ready", "attention", "failed"].includes(result.status)
                        ? result : { status: "failed", summary: "Automatic setup could not be verified. Refresh status and retry.", changedConfigs: 0 };
                    for (const item of AUTOMATIC_SETUP_STAGES) {
                        if (this.setupSteps[item.id] === "running") this.setupSteps[item.id] = this.setupResult.status === "failed" ? "failed" : "attention";
                    }
                    this.feedback = { tone: this.setupResult.status === "ready" ? "success" : this.setupResult.status === "failed" ? "error" : "info", message: this.setupResult.summary };
                    return;
                }
                case "action:controlledTerminal":
                    await vscode.commands.executeCommand("soterai.runControlledTerminalCommand");
                    break;
                case "action:scanClipboard":
                    await vscode.commands.executeCommand("soterai.scanClipboard");
                    break;
                case "action:checkBeforeAI":
                    await vscode.commands.executeCommand("soterai.checkBeforeSendingToAI");
                    break;
                case "action:protectSecrets":
                    await vscode.commands.executeCommand("soterai.autoMigrateWorkspace");
                    break;
                case "action:secureAI":
                    await vscode.commands.executeCommand("soterai.secureAllAI");
                    break;
                case "action:mcpPreflight":
                    await vscode.commands.executeCommand("soterai.preflightMCPTool");
                    break;
                case "action:depGuard":
                    await vscode.commands.executeCommand("soterai.checkDependencyInstall");
                    break;
                case "action:unlock":
                    await vscode.commands.executeCommand("soterai.unlockProtection");
                    break;
                case "action:openWalkthrough":
                    await vscode.commands.executeCommand("soterai.openWalkthrough");
                    break;
                case "action:openRisk":
                    await vscode.commands.executeCommand("soterai-project-risk.focus");
                    break;
                case "action:openFindings":
                    await vscode.commands.executeCommand("soterai-latest-findings.focus");
                    break;
                case "action:openPolicy":
                    await vscode.commands.executeCommand("soterai-policy-status.focus");
                    break;
                case "action:protectFile":
                case "action:protectSelection":
                case "action:redactedPreview": {
                    const editor = vscode.window.activeTextEditor;
                    if (!editor || editor.document.uri.scheme !== "file") {
                        this.feedback = { tone: "info", message: "Open a local workspace file in the editor first." };
                        return;
                    }
                    if (type === "action:protectSelection" && editor.selection.isEmpty) {
                        this.feedback = { tone: "info", message: "Select the private text in your file, then choose Protect selection." };
                        return;
                    }
                    await vscode.commands.executeCommand(type === "action:protectFile" ? "soterai.blockFromAI"
                        : type === "action:protectSelection" ? "soterai.blockSelectionFromAI" : "soterai.openRedactedPreview", editor.document.uri);
                    break;
                }
                case "action:manageRules":
                    await vscode.commands.executeCommand("soterai.manageAIRules");
                    break;
                case "action:openWebsite":
                case "action:openDocs":
                case "action:reportIssue": {
                    const link = ControlPanelViewProvider.RESOURCE_LINKS[type];
                    if (link) await vscode.env.openExternal(vscode.Uri.parse(link.url));
                    break;
                }
            }
            if (isToggle) {
                const current = await this.gatherState();
                const key = type.slice("toggle:".length) as keyof PanelFacts;
                const changed = current[key] === on;
                this.feedback = { tone: changed ? "success" : "info", message: changed
                    ? "Setting confirmed. The current status is shown above."
                    : "The setting is unchanged. A confirmation may have been cancelled or the setting is managed." };
            } else {
                this.feedback = { tone: "info", message: "Request handled. Review the result or confirmation in VS Code." };
            }
        } catch {
            this.feedback = {
                tone: "error",
                message: "That action could not be completed. Review the VS Code notification and try again.",
            };
            void vscode.window.showErrorMessage("SoterAI could not complete this action. Refresh status and try again.");
        } finally {
            this.actionPending = false;
            this.deps.refreshViews();
            await this.render();
        }
    }

    // ── state gathering ──────────────────────────────────────────────────────
    private async gatherState(): Promise<PanelState> {
        const config  = vscode.workspace.getConfiguration("soterai");
        let safeMode: { enabled?: boolean; level?: string } | undefined;

        let brokerRunning = false;
        let brokerStatus: PanelFacts["brokerStatus"] = "stopped";
        try {
            const status = await this.deps.brokerManager.status();
            brokerRunning = Boolean(status.running && status.state === "healthy");
            if (brokerRunning && config.get<boolean>("hardening.runtimeEvidence", true)) safeMode = status.safeMode;
            brokerStatus = brokerRunning ? "running" : "stopped";
        } catch { brokerStatus = "unavailable"; }

        return {
            safeMode:           Boolean(safeMode?.enabled),
            safeModeLevel:      safeMode?.level,
            protectedWorkspace: this.deps.workspaceGuard.isEnabled,
            liveScan:           config.get<boolean>("liveScan.enabled", true),
            sentinel:           this.deps.sentinel.isEnabled,
            mcpFirewall:        config.get<boolean>("mcpFirewall.strictMode", false),
            brokerRunning,
            brokerStatus,
            trusted:            vscode.workspace.isTrusted,
            privacyMode:        config.get<string>("privacyMode", "local"),
            cloudEnabled:       config.get<boolean>("cloud.enabled", false),
            telemetryLevel:     config.get<string>("telemetry.redactedEvents", "off"),
            // Empty on an unmanaged machine, so nothing about the panel changes
            // for a developer who is not under central management.
            managedReasons:     managedControlReasons(),
        };
    }

    private async render(): Promise<void> {
        const view = this.view;
        if (!view) return;
        const revision = ++this.renderRevision;
        try {
            const [state, protection] = await Promise.all([this.gatherState(), this.deps.protectionState.refresh()]);
            if (this.view !== view || revision !== this.renderRevision) return;
            // Resolve logo URI — served as a local webview resource so CSP is respected.
            const logoUri = view.webview.asWebviewUri(
                vscode.Uri.joinPath(this.context.extensionUri, "media", "logo_circle_whiter.png"),
            );
            view.webview.html = this.buildHtml(
                view.webview,
                state,
                protection.descriptor,
                logoUri,
            );
        } catch {
            if (this.view !== view || revision !== this.renderRevision) return;
            const nonce = getNonce();
            view.webview.html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';"><title>SoterAI status unavailable</title><style>${controlPanelStyles}</style></head><body><main aria-labelledby="panel-title"><header class="brand-header"><h1 class="brand-name" id="panel-title">SoterAI Guard</h1></header><section class="status-card"><div class="status-top"><div class="status-info"><h2>Status unavailable</h2><p class="status-sub">Protection could not be verified. No security status is assumed.</p></div></div><div class="cta-wrap"><button class="cta" id="retry">Retry status check</button></div></section></main><script nonce="${nonce}">const api=acquireVsCodeApi();document.getElementById('retry').addEventListener('click',()=>api.postMessage({type:'action:refresh'}));</script></body></html>`;
        }
    }

    // ── HTML ─────────────────────────────────────────────────────────────────
    private buildHtml(
        webview: vscode.Webview,
        state:   PanelState,
        protection: import("../protection/ProtectionState").ProtectionStateDescriptor,
        logoUri: vscode.Uri,
    ): string {
        const nonce       = getNonce();
        const facts: PanelFacts = state;
        const controls    = plainControls(facts);
        const coreControls = controls.filter((control) => control.id !== "mcpFirewall");
        const advancedControls = controls.filter((control) => control.id === "mcpFirewall");
        const activeControlCount = controls.filter((control) => control.on).length;
        const cta         = primaryCta(protection.state, facts);
        const privacy     = privacyBoundary({
            privacyMode: state.privacyMode ?? "local",
            cloudEnabled: state.cloudEnabled ?? false,
            telemetryLevel: state.telemetryLevel ?? "off",
            trusted: state.trusted,
        });
        const tasks       = panelTasks();
        const startTasks  = tasks.filter((task) => task.group === "start");
        const moreTasks   = tasks.filter((task) => task.group === "more");
        const showSetupGuide = !state.brokerRunning || !state.protectedWorkspace;
        const blockingActive = state.safeMode && state.brokerRunning
            && !["LOCKDOWN", "ERROR", "POLICY_UNAVAILABLE", "BYPASS_DETECTED"].includes(protection.state);
        const monitoringActive = state.liveScan;
        const setupCheckCount = [
            !blockingActive,
            !state.protectedWorkspace,
            !state.liveScan,
            !state.trusted,
        ].filter(Boolean).length;
        const statusTitle = protection.state === "FULLY_ENFORCED" ? "Managed controls active" : protection.title;
        const statusExplanation = protection.state === "FULLY_ENFORCED"
            ? "Configured SoterAI controls are active. These operational facts do not verify agent routing or G1-G6 guarantees; other tools remain outside their control."
            : protection.explanation;
        const routedStatus = protection.state === "LOCKDOWN" ? "Paused" : blockingActive ? "Checking" : "Not blocking";
        const setupLabels: Record<SetupStageStatus, string> = { waiting: "Waiting", running: "Working", complete: "Done", attention: "Review", failed: "Incomplete" };
        const setupBlocked = !state.trusted || protection.state === "LOCKDOWN";
        const setupRows = AUTOMATIC_SETUP_STAGES.map((item) => {
            const status = this.setupSteps?.[item.id] ?? "waiting";
            return `<li data-setup-stage="${item.id}" data-status="${status}"><span>${item.label}</span><span class="setup-state">${setupLabels[status]}</span></li>`;
        }).join("");

        // ── status card severity → CSS modifier + icon ──────────────────────
        const sevMap: Record<string, { cls: string; icon: string }> = {
            info:     { cls: "success", icon: "✓" },
            success:  { cls: "success", icon: "✓" },
            warning:  { cls: "warning", icon: "⚠" },
            error:    { cls: "error",   icon: "✕" },
            critical: { cls: "error",   icon: "✕" },
        };
        const sev = sevMap[protection.severity] ?? { cls: "idle", icon: "·" };

        // ── broker pill ──────────────────────────────────────────────────────
        const brokerPill = state.brokerStatus === "unavailable"
            ? `<span class="pill pill-restricted">Checker status unavailable</span>`
            : state.brokerRunning
            ? `<span class="pill pill-on"><span class="status-dot" aria-hidden="true"></span>Local checker running</span>`
            : `<span class="pill pill-off"><span class="status-dot" aria-hidden="true"></span>Local checker offline</span>`;

        // ── control rows ─────────────────────────────────────────────────────
        const row = (c: PlainControl): string => {
            const badgeHtml = c.managed
                // GAP 3: state and manageability are separate facts. The level
                // badge still shows what protection is actually in effect; the
                // managed pill says only that the user cannot change it here.
                ? `<span class="badge badge-managed">Set by your organisation</span>`
                : c.on && c.level
                    ? `<span class="badge badge-${c.level}">${escapeHtml(PROTECTION[c.level].label)}</span>`
                    : `<span class="badge badge-off">Off</span>`;
            return `
            <div class="control-row" id="row-${c.id}">
              <div class="control-left">
                <button
                  class="toggle ${c.on ? "toggle-on" : "toggle-off"}${c.managed ? " toggle-managed" : ""}"
                  data-id="${c.id}"
                  data-value="${c.on ? "false" : "true"}"
                  data-focus="sw-${c.id}"
                  role="switch"
                  aria-checked="${c.on}"
                  aria-label="${escapeHtml(c.label)}"
                  aria-describedby="note-${c.id}"
                  ${c.managed ? `disabled aria-disabled="true" title="${escapeHtml(c.managedReason ?? "")}"` : ""}
                ><span class="toggle-thumb"></span></button>
              </div>
              <div class="control-body">
                <div class="control-header">
                  <span class="control-label">${escapeHtml(c.label)}</span>
                  ${badgeHtml}
                </div>
                <div class="control-note" id="note-${c.id}">${escapeHtml(c.summary)}</div>
                ${c.managed ? `<div class="control-managed">${escapeHtml(c.managedReason ?? "")}</div>` : ""}
                <details class="control-detail" id="detail-${c.id}" data-persist>
                  <summary>Coverage details</summary>
                  <p>${escapeHtml(c.detail)}</p>
                </details>
              </div>
            </div>`;
        };

        // ── task cards ───────────────────────────────────────────────────────
        const taskCards = (items: typeof tasks) => items.map((t) => `
            <button class="task-card" data-action="${t.action.replace("action:", "")}" data-focus="${t.action}" data-announcement="${escapeHtml(`Opening ${t.label}`)}">
              <span class="task-icon" aria-hidden="true">${t.icon}</span>
              <span class="task-content">
                <span class="task-label">${escapeHtml(t.label)}</span>
                <span class="task-desc">${escapeHtml(t.hint)}</span>
              </span>
              <span class="task-arrow" aria-hidden="true">›</span>
            </button>`).join("");

        // ── footer links ─────────────────────────────────────────────────────
        const footerLinks = Object.entries(ControlPanelViewProvider.RESOURCE_LINKS)
            .map(([action, link]) => `
            <button class="footer-link" data-action="${action.replace("action:", "")}" data-focus="${action}" data-announcement="Opening ${escapeHtml(link.label)}">${escapeHtml(link.label)}</button>`)
            .join(`<span class="footer-sep">·</span>`);

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; img-src ${webview.cspSource}; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>SoterAI Guard</title>
  <style>${controlPanelStyles}</style>
</head>
<body data-pending="${this.actionPending}">
<a class="skip-link" href="#controls-title">Skip to protection controls</a>
<div id="operation-status" class="operation-banner" role="status" aria-live="polite" aria-atomic="true">Waiting for VS Code…</div>
<main aria-labelledby="panel-title">

  <!-- ① Brand Header with logo -->
  <header class="brand-header">
    <img class="brand-logo" src="${logoUri}" alt="SoterAI logo" />
    <div class="brand-text">
      <h1 class="brand-name" id="panel-title">SoterAI Guard</h1>
      <span class="brand-tagline">WORKSPACE SECURITY</span>
    </div>
    <span class="brand-version">v${escapeHtml(String(this.context.extension.packageJSON.version ?? "unknown"))}</span>
    <button class="icon-button" data-action="refresh" data-focus="action:refresh" aria-label="Refresh protection status" title="Refresh status"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13.5 7A5.5 5.5 0 1 0 12 12M13.5 2.5V7H9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
  </header>
  <nav class="section-nav" aria-label="Panel sections"><a href="#protection-status-title" aria-current="location">Overview</a><a href="#controls-title">Controls</a><a href="#tools-title">Tools</a></nav>

  <!-- ② Status card -->
  <section class="status-card" aria-labelledby="protection-status-title">
    <div class="status-top">
      <div class="status-icon ${sev.cls}" aria-hidden="true">${sev.icon}</div>
      <div class="status-info">
        <div class="eyebrow">CURRENT PROTECTION</div>
        <h2 class="status-title" id="protection-status-title" tabindex="-1">${escapeHtml(statusTitle)}</h2>
        <div class="status-sub">${escapeHtml(statusExplanation)}</div>
        <div class="status-meta">${activeControlCount} of ${controls.length} controls active</div>
      </div>
    </div>
    <dl class="outcome-grid" aria-label="Protection outcomes">
      <div class="outcome"><dt class="outcome-label">Routed requests</dt><dd class="outcome-value ${blockingActive ? "on" : "attention"}">${routedStatus}</dd></div>
      <div class="outcome"><dt class="outcome-label">Editor warnings</dt><dd class="outcome-value ${monitoringActive ? "on" : "attention"}">${monitoringActive ? "Active" : "Off"}</dd></div>
      <div class="outcome"><dt class="outcome-label">Setup checks</dt><dd class="outcome-value ${setupCheckCount === 0 ? "on" : "attention"}">${setupCheckCount === 0 ? "Complete" : setupCheckCount + " to review"}</dd></div>
    </dl>
    <div class="cta-wrap">
      <div class="eyebrow" id="next-step-title">RECOMMENDED NEXT STEP</div>
      <button class="cta ${cta.tone === "calm" ? "calm" : ""}" data-action="${cta.action.replace("action:", "")}" data-focus="primary-action" data-announcement="${escapeHtml(cta.label)}">${escapeHtml(cta.label)}<span aria-hidden="true"> →</span></button>
      <div class="cta-hint">${escapeHtml(cta.hint)}</div>
    </div>
  </section>

  <aside class="scope-notice" aria-label="Protection scope"><span class="scope-label">Managed paths only</span><p>Other tools can still read original files and make their own network requests.</p><button class="text-button" data-action="openCoverage" data-focus="scope:coverage">Review coverage <span aria-hidden="true">↗</span></button></aside>

  <section class="auto-setup" aria-labelledby="auto-setup-title">
    <div class="eyebrow">AUTOMATIC SETUP</div>
    <h2 id="auto-setup-title">One-click managed setup</h2>
    <p>Enable local controls, broker auto-start and supported AI routing in one flow. Config changes get one combined review and encrypted backups.</p>
    <ol class="setup-steps" aria-label="Automatic setup progress">${setupRows}</ol>
    <button class="cta" data-action="automaticProtection" data-focus="automatic:setup" data-announcement="Starting managed setup" ${setupBlocked ? 'disabled aria-disabled="true"' : ""}>${this.setupResult ? "Run setup checks again" : "Configure & check managed paths"}<span aria-hidden="true">→</span></button>
    ${setupBlocked ? `<p class="field-hint">${!state.trusted ? "Review workspace trust before setup." : "Review lockdown and unlock explicitly before setup."}</p>` : ""}
    ${this.setupResult ? `<p class="setup-result" role="status">${escapeHtml(this.setupResult.summary)}</p><button class="text-button" data-action="openCoverage" data-focus="automatic:coverage">Review final coverage</button>` : ""}
  </section>

  <section class="privacy-receipt ${privacy.tone}" aria-labelledby="data-boundary-title" aria-live="polite">
    <h2 class="privacy-title" id="data-boundary-title">${escapeHtml(privacy.title)}</h2>
    <div class="privacy-detail">${escapeHtml(privacy.detail)}</div>
  </section>

  <!-- ③ Broker + workspace pills -->
  <div class="broker-row" role="status" aria-label="Runtime and workspace status">
    ${brokerPill}
    ${state.trusted
        ? `<span class="pill pill-trusted">Project access allowed</span>`
        : `<span class="pill pill-restricted">Limited by VS Code</span>`
    }
  </div>

  ${this.feedback ? `<div class="feedback ${this.feedback.tone}" role="status" aria-live="polite">${escapeHtml(this.feedback.message)}</div>` : ""}

  ${showSetupGuide ? `
  <details class="guide-card" id="setup-guide" data-persist>
    <summary id="setup-guide-title">First time here? Open the setup checklist</summary>
      <div class="guide-title">Get protected in three guided steps</div>
      <div class="guide-copy">Use safe test data first, then protect secrets and connect supported AI tools.</div>
      <ol class="guide-steps">
        <li>See a real safety result</li>
        <li>Protect workspace secrets</li>
        <li>Secure supported AI tools</li>
      </ol>
      <button class="btn-secondary guide-button" data-action="openWalkthrough" data-focus="action:openWalkthrough" data-announcement="Opening guided setup">Open guided setup</button>
  </details>` : ""}

  <section aria-labelledby="private-data-title">
    <h2 class="section-label" id="private-data-title">Protect files &amp; text</h2>
    <div class="protect-card"><p>Choose what stays out of SoterAI-built context.</p><div class="protect-grid">
      <button class="btn-secondary" data-action="protectFile" data-focus="action:protectFile">Protect current file</button>
      <button class="btn-secondary" data-action="protectSelection" data-focus="action:protectSelection">Protect selection</button>
      <button class="btn-secondary" data-action="redactedPreview" data-focus="action:redactedPreview">Preview AI context</button>
      <button class="btn-secondary" data-action="manageRules" data-focus="action:manageRules">Manage rules</button>
    </div><span class="field-hint">Folders and patterns: Explorer menu or .aiignore.</span></div>
  </section>

  <!-- ⑤ Quick actions -->
  <section aria-labelledby="start-here-title">
  <h2 class="section-label" id="start-here-title">Review &amp; connect</h2>
  <div class="task-grid">
    ${taskCards(startTasks)}
  </div>
  <details class="more-tools" id="more-checks" data-persist>
    <summary>More security checks</summary>
    <div class="task-grid">${taskCards(moreTasks)}</div>
  </details>
  </section>

  <!-- ⑥ Controls -->
  <section aria-labelledby="controls-title">
  <h2 class="section-label" id="controls-title" tabindex="-1">Protection controls<span class="section-count">${activeControlCount}/${controls.length} on</span></h2>
  <div class="controls-list">
    ${coreControls.map(row).join("")}
  </div>
  <details class="more-tools" id="advanced-controls" data-persist>
    <summary>Advanced agent-tool controls</summary>
    <div class="controls-list">${advancedControls.map(row).join("")}</div>
  </details>
  </section>

  <!-- ⑦ Utility buttons -->
  <section aria-labelledby="tools-title">
  <h2 class="section-label" id="tools-title" tabindex="-1">Tools</h2>
  <div class="actions-row">
    <button class="btn-secondary" data-action="openCoverage" data-focus="action:openCoverage" data-announcement="Opening protection coverage">
      What is protected
    </button>
    <button class="btn-danger" data-action="lockdown" data-focus="action:lockdown" data-announcement="Opening emergency lockdown confirmation">
      Emergency lockdown
    </button>
  </div>
  <p class="utility-note">Lockdown stops SoterAI's broker and revokes its local grants. Other tools remain outside its control.</p>
  </section>

  <section aria-labelledby="explore-title">
    <h2 class="section-label" id="explore-title">Explore</h2>
    <nav class="surface-grid" aria-label="Security views">
      <button class="surface-button" data-action="openRisk" data-focus="action:openRisk" data-announcement="Opening project risk">Project<br>Risk</button>
      <button class="surface-button" data-action="openFindings" data-focus="action:openFindings" data-announcement="Opening latest findings">Latest<br>Findings</button>
      <button class="surface-button" data-action="openPolicy" data-focus="action:openPolicy" data-announcement="Opening policy status">Policy &amp;<br>Cloud</button>
    </nav>
  </section>

  <!-- ⑧ Footer -->
  <footer class="footer">
    <nav class="footer-links" aria-label="SoterAI resources">
      ${footerLinks}
    </nav>
    <div class="footer-meta">SoterAI checks run locally by default.<br>Status checked ${escapeHtml(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}</div>
    <details class="label-help" id="label-help" data-persist>
      <summary>How protection labels work</summary>
      <p><strong>Blocks</strong> means SoterAI controls that routed path. <strong>Warns</strong> means SoterAI reports risk but cannot stop another extension's direct calls.</p>
    </details>
  </footer>
</main>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    // Store only UI identifiers and positions, never editor/clipboard content.
    const saved = vscode.getState() || {};
    window.addEventListener('message', event => {
      const update = event.data;
      const labels = { waiting: 'Waiting', running: 'Working', complete: 'Done', attention: 'Review', failed: 'Incomplete' };
      if (update?.type !== 'setupProgress' || !['controls', 'routing', 'verification'].includes(update.stage)
        || !Object.prototype.hasOwnProperty.call(labels, update.status)) return;
      const row = document.querySelector('[data-setup-stage="' + update.stage + '"]');
      if (row) { row.setAttribute('data-status', update.status); row.querySelector('.setup-state').textContent = labels[update.status]; }
      const status = document.getElementById('operation-status');
      if (status) status.textContent = update.stage === 'controls' ? 'Enabling local controls…'
        : update.stage === 'routing' ? 'Review the AI routing changes in VS Code, then apply or cancel.' : 'Checking managed setup status…';
    });
    function save(patch) { vscode.setState(Object.assign({}, vscode.getState() || {}, patch)); }
    const sectionLinks = Array.from(document.querySelectorAll('.section-nav a'));
    function markSection(link) {
      for (const item of sectionLinks) item.removeAttribute('aria-current');
      link.setAttribute('aria-current', 'location');
    }
    for (const link of sectionLinks) link.addEventListener('click', () => markSection(link));
    const initialSection = sectionLinks.find(link => link.getAttribute('href') === location.hash);
    if (initialSection) markSection(initialSection);
    for (const detail of document.querySelectorAll('details[data-persist]')) {
      if (saved.details && saved.details[detail.id] === true) detail.open = true;
      const summary = detail.querySelector('summary');
      if (summary) summary.setAttribute('data-focus', 'disclosure:' + detail.id);
      detail.addEventListener('toggle', () => {
        const details = {};
        for (const item of document.querySelectorAll('details[data-persist]')) details[item.id] = item.open;
        save({ details });
      });
    }
    if (saved.focus) {
      const el = document.querySelector('[data-focus="' + CSS.escape(saved.focus) + '"]');
      if (el) el.focus({ preventScroll: true });
    }
    for (const el of document.querySelectorAll('[data-focus]')) {
      el.addEventListener('focus', () => {
        save({ focus: el.getAttribute('data-focus') });
      });
    }
    requestAnimationFrame(() => {
      if (Number.isFinite(saved.scrollY) && saved.scrollY >= 0) window.scrollTo(0, saved.scrollY);
      window.addEventListener('scroll', () => save({ scrollY: window.scrollY }), { passive: true });
    });

    let pending = document.body.getAttribute('data-pending') === 'true';
    function disableActions() {
      document.body.setAttribute('data-pending', 'true');
      document.querySelector('main').setAttribute('aria-busy', 'true');
      for (const button of document.querySelectorAll('button')) {
        if (button.getAttribute('data-action') !== 'refresh') button.disabled = true;
      }
    }
    if (pending) disableActions();
    function markBusy(el) {
      if (pending || el.disabled) return false;
      pending = true;
      el.setAttribute('aria-busy', 'true');
      disableActions();
      const status = document.getElementById('operation-status');
      if (status) status.textContent = el.getAttribute('data-announcement') || 'Applying change';
      setTimeout(() => { if (pending && status) status.textContent = 'Waiting for VS Code. Finish or cancel the open dialog, or refresh status.'; }, 20000);
      return true;
    }

    // Toggle switches
    for (const el of document.querySelectorAll('.toggle')) {
      el.addEventListener('click', () => {
        if (!markBusy(el)) return;
        vscode.postMessage({
          type: 'toggle:' + el.getAttribute('data-id'),
          value: el.getAttribute('data-value') === 'true'
        });
      });
    }

    // All action buttons (CTA, tasks, utility, footer)
    for (const el of document.querySelectorAll('[data-action]')) {
      el.addEventListener('click', () => {
        if (el.getAttribute('data-action') === 'refresh') {
          vscode.postMessage({ type: 'action:refresh' });
          return;
        }
        if (!markBusy(el)) return;
        vscode.postMessage({ type: 'action:' + el.getAttribute('data-action') });
      });
    }
  </script>
</body>
</html>`;
    }
}

/** The panel renders only verified booleans and labels — never secrets. */
type PanelState = PanelFacts;
