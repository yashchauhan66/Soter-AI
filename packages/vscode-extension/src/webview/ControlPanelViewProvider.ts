import * as vscode from "vscode";
import { escapeHtml, getNonce } from "../firewall/util";
import { PROTECTION } from "../protection/ProtectionLevel";
import {
    panelTasks,
    plainControls,
    primaryCta,
    type PanelFacts,
    type PlainControl,
} from "./panelContent";
import type { WorkspaceGuard } from "../workspace-guard/WorkspaceGuard";
import type { AISentinel } from "../sentinel/AISentinel";
import type { BrokerManager } from "../broker/BrokerManager";
import type { ProtectionStateService } from "../protection/ProtectionStateService";

/**
 * SoterAI Control Panel — enterprise-grade sidebar surface.
 *
 * Design rules:
 *   - Every toggle maps to an existing command — one source of truth.
 *   - Badges are registry-resolved: only ENFORCED when SoterAI technically
 *     controls that path.
 *   - The webview never receives secrets, tokens, or raw file content.
 *   - Logo (Bestlogo.png) is served as a local webview resource.
 */
export class ControlPanelViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "soterai-control-panel";

    private view?: vscode.WebviewView;

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

        webviewView.webview.onDidReceiveMessage(async (message: unknown) => {
            await this.handleMessage(message);
        });

        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) void this.render();
        });

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
        "action:controlledTerminal",
        "action:scanClipboard",
        "action:checkBeforeAI",
        "action:protectSecrets",
        "action:secureAI",
        "action:mcpPreflight",
        "action:depGuard",
        "action:unlock",
        "action:openWebsite",
        "action:openDocs",
        "action:reportIssue",
    ]);

    private static readonly RESOURCE_LINKS: Record<string, { url: string; label: string }> = {
        "action:openWebsite": { url: "https://soterai.in", label: "soterai.in" },
        "action:openDocs":    { url: "https://soterai.in/vscode-ai-security", label: "Documentation" },
        "action:reportIssue": { url: "https://github.com/yashchauhan66/Soter-AI/issues", label: "Report an issue" },
    };

    // ── message handling ─────────────────────────────────────────────────────
    private async handleMessage(message: unknown): Promise<void> {
        const msg = message as { type?: string; value?: boolean } | undefined;
        const type = typeof msg?.type === "string" ? msg.type : undefined;
        if (!type || !ControlPanelViewProvider.ALLOWED.has(type)) {
            // Rejected message: silently ignore untrusted webview input. Do not
            // log attacker-controlled content or show a notification.
            return;
        }
        const on = msg?.value === true;

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
                case "action:openWebsite":
                case "action:openDocs":
                case "action:reportIssue": {
                    const link = ControlPanelViewProvider.RESOURCE_LINKS[type];
                    if (link) await vscode.env.openExternal(vscode.Uri.parse(link.url));
                    break;
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(
                `SoterAI: could not apply that change — ${error instanceof Error ? error.message : String(error)}`,
            );
        }

        this.deps.refreshViews();
        await this.render();
    }

    // ── state gathering ──────────────────────────────────────────────────────
    private async gatherState(): Promise<PanelState> {
        const config  = vscode.workspace.getConfiguration("soterai");
        const safeMode = this.context.globalState.get<{ enabled?: boolean; level?: string }>("soterai.safeMode");

        let brokerRunning = false;
        try {
            const status = await this.deps.brokerManager.status();
            brokerRunning = Boolean(status.running);
        } catch { /* broker optional / stopped */ }

        return {
            safeMode:           Boolean(safeMode?.enabled),
            safeModeLevel:      safeMode?.level,
            protectedWorkspace: this.deps.workspaceGuard.isEnabled,
            liveScan:           config.get<boolean>("liveScan.enabled", true),
            sentinel:           this.deps.sentinel.isEnabled,
            mcpFirewall:        config.get<boolean>("mcpFirewall.strictMode", false),
            brokerRunning,
            trusted:            vscode.workspace.isTrusted,
        };
    }

    private async render(): Promise<void> {
        if (!this.view) return;
        const state      = await this.gatherState();
        const protection = await this.deps.protectionState.refresh();
        // Resolve logo URI — served as a local webview resource so CSP is respected.
        const logoUri = this.view.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, "media", "Bestlogo.png"),
        );
        this.view.webview.html = this.buildHtml(
            this.view.webview,
            state,
            protection.descriptor,
            logoUri,
        );
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
        const cta         = primaryCta(protection.state, facts);
        const tasks       = panelTasks();
        const startTasks  = tasks.filter((task) => task.group === "start");
        const moreTasks   = tasks.filter((task) => task.group === "more");
        const blockingActive = state.safeMode && state.brokerRunning;
        const monitoringActive = state.liveScan;
        const knownGapCount = [
            !blockingActive,
            !state.protectedWorkspace,
            !state.liveScan,
            !state.trusted,
        ].filter(Boolean).length;

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
        const brokerPill = state.brokerRunning
            ? `<span class="pill pill-on">Request checking active</span>`
            : `<span class="pill pill-off">Request blocking needs setup</span>`;

        // ── control rows ─────────────────────────────────────────────────────
        const row = (c: PlainControl): string => {
            const badgeHtml = c.on && c.level
                ? `<span class="badge badge-${c.level}">${escapeHtml(PROTECTION[c.level].label)}</span>`
                : `<span class="badge badge-off">Off</span>`;
            return `
            <div class="control-row" id="row-${c.id}">
              <div class="control-left">
                <button
                  class="toggle ${c.on ? "toggle-on" : "toggle-off"}"
                  data-id="${c.id}"
                  data-value="${c.on ? "false" : "true"}"
                  data-focus="sw-${c.id}"
                  role="switch"
                  aria-checked="${c.on}"
                  aria-label="${escapeHtml(c.label)}"
                ><span class="toggle-thumb"></span></button>
              </div>
              <div class="control-body">
                <div class="control-header">
                  <span class="control-label">${escapeHtml(c.label)}</span>
                  ${badgeHtml}
                </div>
                <div class="control-note">${escapeHtml(c.summary)}</div>
                <details class="control-detail">
                  <summary>Coverage details</summary>
                  <p>${escapeHtml(c.detail)}</p>
                </details>
              </div>
            </div>`;
        };

        // ── task cards ───────────────────────────────────────────────────────
        const taskCards = (items: typeof tasks) => items.map((t) => `
            <button class="task-card" data-action="${t.action.replace("action:", "")}" data-focus="${t.action}">
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
            <button class="footer-link" data-action="${action.replace("action:", "")}" data-focus="${action}">${escapeHtml(link.label)}</button>`)
            .join(`<span class="footer-sep">·</span>`);

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; img-src ${webview.cspSource}; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>SoterAI Guard</title>
  <style>
    /* ── Reset + base ────────────────────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
      font-size: 12px;
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background, #1e1e1e);
      padding: 0 0 24px;
      overflow-x: hidden;
    }

    /* ── Brand header ────────────────────────────────────────────────────── */
    .brand-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 14px 12px;
      border-bottom: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.08));
      background: var(--vscode-sideBarSectionHeader-background, rgba(255,255,255,0.03));
    }
    .brand-logo {
      width: 32px;
      height: 32px;
      object-fit: contain;
      border-radius: 6px;
      flex-shrink: 0;
    }
    .brand-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .brand-name {
      font-size: 13px;
      font-weight: 700;
      color: var(--vscode-foreground);
      letter-spacing: 0;
      white-space: nowrap;
    }
    .brand-tagline {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      letter-spacing: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .brand-version {
      margin-left: auto;
      font-size: 10px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-badge-background, rgba(255,255,255,0.1));
      padding: 2px 6px;
      border-radius: 10px;
      letter-spacing: 0;
      flex-shrink: 0;
    }

    /* ── Status card ─────────────────────────────────────────────────────── */
    .status-card {
      margin: 12px 12px 0;
      border-radius: 8px;
      border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.1));
      overflow: hidden;
    }
    .status-top {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
    }
    .status-icon {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .status-icon.success { background: rgba(22,163,74,0.18); color: #22c55e; border: 1px solid rgba(22,163,74,0.35); }
    .status-icon.warning { background: rgba(217,119,6,0.18); color: #f59e0b; border: 1px solid rgba(217,119,6,0.35); }
    .status-icon.error   { background: rgba(220,38,38,0.18); color: #f87171; border: 1px solid rgba(220,38,38,0.35); }
    .status-icon.idle    { background: rgba(107,114,128,0.18); color: #9ca3af; border: 1px solid rgba(107,114,128,0.35); }
    .status-info { flex: 1; min-width: 0; }
    .status-title {
      font-size: 12px;
      font-weight: 700;
      color: var(--vscode-foreground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .status-sub {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 2px;
      line-height: 1.5;
    }
    .outcome-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.08)); }
    .outcome { min-width: 0; padding: 8px 6px 9px; text-align: center; border-right: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.08)); }
    .outcome:last-child { border-right: 0; }
    .outcome-label { display: block; font-size: 10px; color: var(--vscode-descriptionForeground); line-height: 1.25; }
    .outcome-value { display: block; margin-top: 2px; font-size: 11px; font-weight: 700; color: var(--vscode-foreground); line-height: 1.25; }
    .outcome-value.on { color: #22c55e; }
    .outcome-value.attention { color: #fbbf24; }

    /* ── Broker pill ─────────────────────────────────────────────────────── */
    .broker-row {
      margin: 8px 12px 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 10px;
      letter-spacing: 0;
    }
    .pill-on  { background: rgba(22,163,74,0.15); color: #22c55e; border: 1px solid rgba(22,163,74,0.3); }
    .pill-off { background: rgba(107,114,128,0.12); color: #9ca3af; border: 1px solid rgba(107,114,128,0.2); }
    .pill-trusted { background: rgba(8,145,178,0.15); color: #22d3ee; border: 1px solid rgba(8,145,178,0.3); }
    .pill-restricted { background: rgba(220,38,38,0.12); color: #f87171; border: 1px solid rgba(220,38,38,0.25); }

    /* ── Section headers ─────────────────────────────────────────────────── */
    .section-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0;
      color: var(--vscode-descriptionForeground);
      padding: 14px 14px 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .section-label::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--vscode-panel-border, rgba(255,255,255,0.08));
    }

    /* ── CTA button ──────────────────────────────────────────────────────── */
    .cta-wrap { padding: 0 12px; }
    .cta {
      width: 100%;
      padding: 9px 14px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0;
      transition: opacity 0.15s, transform 0.1s;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      font-family: inherit;
    }
    .cta:hover { opacity: 0.88; }
    .cta:active { transform: scale(0.98); }
    .cta.calm {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .cta-hint {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      padding: 5px 0 0;
      line-height: 1.5;
    }

    /* ── Task cards ──────────────────────────────────────────────────────── */
    .task-grid { padding: 0 12px; display: flex; flex-direction: column; gap: 5px; }
    .task-card {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 10px;
      border-radius: 7px;
      border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.08));
      background: var(--vscode-input-background, rgba(255,255,255,0.04));
      cursor: pointer;
      font-family: inherit;
      color: var(--vscode-foreground);
      text-align: left;
      transition: background 0.12s, border-color 0.12s;
      width: 100%;
    }
    .task-card:hover {
      background: var(--vscode-list-hoverBackground);
      border-color: var(--vscode-focusBorder, rgba(255,255,255,0.2));
    }
    .task-icon { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 20px; color: var(--vscode-icon-foreground, var(--vscode-foreground)); }
    .task-icon svg { display: block; }
    .task-content { flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .task-label { font-size: 12px; font-weight: 600; line-height: 1.35; overflow-wrap: anywhere; }
    .task-desc { font-size: 11px; color: var(--vscode-descriptionForeground); line-height: 1.45; }
    .task-arrow { color: var(--vscode-descriptionForeground); font-size: 15px; flex-shrink: 0; }

    /* ── Control rows ────────────────────────────────────────────────────── */
    .controls-list { padding: 0 12px; display: flex; flex-direction: column; gap: 2px; }
    .control-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 0;
      border-bottom: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.06));
    }
    .control-row:last-child { border-bottom: none; }
    .control-left { flex-shrink: 0; padding-top: 1px; }
    .control-body { flex: 1; min-width: 0; }
    .control-header { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .control-label { font-size: 12px; font-weight: 600; }
    .control-note {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 3px;
      line-height: 1.5;
    }
    .control-detail { margin-top: 4px; }
    .control-detail summary {
      font-size: 11px;
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      user-select: none;
    }
    .control-detail p {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 4px;
      line-height: 1.55;
      padding-left: 4px;
      border-left: 2px solid var(--vscode-panel-border);
    }

    /* ── Badge chips ─────────────────────────────────────────────────────── */
    .badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0;
      padding: 2px 6px;
      border-radius: 10px;
      white-space: nowrap;
    }
    .badge-ENFORCED  { background: rgba(22,163,74,0.2);   color: #22c55e;  border: 1px solid rgba(22,163,74,0.4); }
    .badge-VERIFIED  { background: rgba(8,145,178,0.2);   color: #22d3ee;  border: 1px solid rgba(8,145,178,0.4); }
    .badge-REDACTED  { background: rgba(124,58,237,0.2);  color: #a78bfa;  border: 1px solid rgba(124,58,237,0.35); }
    .badge-MONITORED { background: rgba(217,119,6,0.2);   color: #fbbf24;  border: 1px solid rgba(217,119,6,0.35); }
    .badge-UNKNOWN   { background: rgba(107,114,128,0.15);color: #9ca3af;  border: 1px solid rgba(107,114,128,0.3); }
    .badge-EXPOSED   { background: rgba(220,38,38,0.15);  color: #f87171;  border: 1px solid rgba(220,38,38,0.3); }
    .badge-off       { background: transparent; color: var(--vscode-descriptionForeground); border: 1px solid var(--vscode-panel-border); }

    /* ── Toggle switch ───────────────────────────────────────────────────── */
    .toggle {
      width: 36px;
      height: 20px;
      border-radius: 10px;
      border: none;
      cursor: pointer;
      position: relative;
      flex-shrink: 0;
      transition: background 0.18s;
      padding: 0;
    }
    .toggle-on  { background: #16a34a; }
    .toggle-off { background: var(--vscode-input-background, rgba(255,255,255,0.1)); border: 1px solid var(--vscode-panel-border); }
    .toggle-thumb {
      position: absolute;
      top: 2px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #fff;
      transition: left 0.18s;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
    .toggle-on  .toggle-thumb { left: 18px; }
    .toggle-off .toggle-thumb { left: 2px; }

    /* ── Utility buttons ─────────────────────────────────────────────────── */
    .actions-row {
      padding: 0 12px;
      display: flex;
      gap: 6px;
    }
    .btn-secondary {
      flex: 1;
      padding: 7px 10px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      background: transparent;
      color: var(--vscode-foreground);
      cursor: pointer;
      font-size: 11px;
      font-weight: 500;
      font-family: inherit;
      transition: background 0.12s;
    }
    .btn-secondary:hover { background: var(--vscode-list-hoverBackground); }
    .btn-danger {
      flex: 1;
      padding: 7px 10px;
      border: 1px solid rgba(220,38,38,0.5);
      border-radius: 6px;
      background: rgba(220,38,38,0.08);
      color: #f87171;
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      font-family: inherit;
      transition: background 0.12s;
    }
    .btn-danger:hover { background: rgba(220,38,38,0.16); }

    /* ── Footer ──────────────────────────────────────────────────────────── */
    .footer {
      margin: 16px 12px 0;
      padding-top: 12px;
      border-top: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.07));
    }
    .footer-links {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 2px;
      align-items: center;
      margin-bottom: 8px;
    }
    .footer-link {
      background: none;
      border: none;
      padding: 2px 4px;
      cursor: pointer;
      font-family: inherit;
      font-size: 11px;
      color: var(--vscode-textLink-foreground);
    }
    .footer-link:hover { color: var(--vscode-textLink-activeForeground); text-decoration: underline; }
    .footer-sep { color: var(--vscode-descriptionForeground); font-size: 10px; padding: 0 2px; }
    .footer-meta {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.6;
    }
    .footer-meta strong { color: var(--vscode-foreground); font-weight: 600; }
    .more-tools { margin: 6px 12px 0; }
    .more-tools > summary, .label-help > summary { color: var(--vscode-textLink-foreground); cursor: pointer; font-size: 11px; user-select: none; }
    .more-tools .task-grid { padding: 7px 0 0; }
    .label-help { margin-top: 8px; }
    .label-help p { margin-top: 5px; font-size: 11px; line-height: 1.55; color: var(--vscode-descriptionForeground); }

    /* ── Accessibility ───────────────────────────────────────────────────── */
    :focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 2px; }
    [aria-busy="true"] { opacity: 0.5; cursor: progress; pointer-events: none; }
  </style>
</head>
<body>

  <!-- ① Brand Header with logo -->
  <div class="brand-header">
    <img class="brand-logo" src="${logoUri}" alt="SoterAI logo" />
    <div class="brand-text">
      <span class="brand-name">SoterAI Guard</span>
      <span class="brand-tagline">Local AI Security · Zero cloud dependency</span>
    </div>
    <span class="brand-version">v${escapeHtml(String(this.context.extension.packageJSON.version ?? "unknown"))}</span>
  </div>

  <!-- ② Status card -->
  <div class="status-card" style="margin-top:12px; margin-left:12px; margin-right:12px;">
    <div class="status-top">
      <div class="status-icon ${sev.cls}">${sev.icon}</div>
      <div class="status-info">
        <div class="status-title">${escapeHtml(protection.title)}</div>
        <div class="status-sub">${escapeHtml(protection.explanation)}</div>
      </div>
    </div>
    <div class="outcome-grid" aria-label="Protection outcomes">
      <div class="outcome"><span class="outcome-label">Blocking</span><span class="outcome-value ${blockingActive ? "on" : "attention"}">${blockingActive ? "Active" : "Needs setup"}</span></div>
      <div class="outcome"><span class="outcome-label">Editor warnings</span><span class="outcome-value ${monitoringActive ? "on" : "attention"}">${monitoringActive ? "Active" : "Off"}</span></div>
      <div class="outcome"><span class="outcome-label">Known gaps</span><span class="outcome-value ${knownGapCount === 0 ? "on" : "attention"}">${knownGapCount}</span></div>
    </div>
  </div>

  <!-- ③ Broker + workspace pills -->
  <div class="broker-row">
    ${brokerPill}
    ${state.trusted
        ? `<span class="pill pill-trusted">Project access allowed</span>`
        : `<span class="pill pill-restricted">Limited by VS Code</span>`
    }
  </div>

  <!-- ④ Primary CTA -->
  <div class="section-label">Next Step</div>
  <div class="cta-wrap">
    <button class="cta ${cta.tone === "calm" ? "calm" : ""}"
            data-action="${cta.action.replace("action:", "")}"
            data-focus="${cta.action}">${escapeHtml(cta.label)}</button>
    <div class="cta-hint">${escapeHtml(cta.hint)}</div>
  </div>

  <!-- ⑤ Quick actions -->
  <div class="section-label">Start Here</div>
  <div class="task-grid">
    ${taskCards(startTasks)}
  </div>
  <details class="more-tools">
    <summary>More security checks</summary>
    <div class="task-grid">${taskCards(moreTasks)}</div>
  </details>

  <!-- ⑥ Controls -->
  <div class="section-label">Protection Controls</div>
  <div class="controls-list">
    ${coreControls.map(row).join("")}
  </div>
  <details class="more-tools">
    <summary>Advanced agent-tool controls</summary>
    <div class="controls-list">${advancedControls.map(row).join("")}</div>
  </details>

  <!-- ⑦ Utility buttons -->
  <div class="section-label">Tools</div>
  <div class="actions-row">
    <button class="btn-secondary" data-action="openCoverage" data-focus="action:openCoverage">
      What is protected
    </button>
    <button class="btn-danger" data-action="lockdown" data-focus="action:lockdown">
      Stop all AI access
    </button>
  </div>

  <!-- ⑧ Footer -->
  <div class="footer">
    <div class="footer-links">
      ${footerLinks}
    </div>
    <div class="footer-meta">Detection runs locally by default. Raw secrets are not sent to SoterAI.</div>
    <details class="label-help">
      <summary>How protection labels work</summary>
      <p><strong>Blocks</strong> means SoterAI controls that routed path. <strong>Warns</strong> means SoterAI reports risk but cannot stop another extension's direct calls.</p>
    </details>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    // Restore keyboard focus across re-renders.
    const saved = vscode.getState() || {};
    if (saved.focus) {
      const el = document.querySelector('[data-focus="' + CSS.escape(saved.focus) + '"]');
      if (el) el.focus();
    }
    for (const el of document.querySelectorAll('[data-focus]')) {
      el.addEventListener('focus', () => {
        vscode.setState(Object.assign({}, vscode.getState(), { focus: el.getAttribute('data-focus') }));
      });
    }

    function markBusy(el) {
      el.setAttribute('aria-busy', 'true');
    }

    // Toggle switches
    for (const el of document.querySelectorAll('.toggle')) {
      el.addEventListener('click', () => {
        markBusy(el);
        vscode.postMessage({
          type: 'toggle:' + el.getAttribute('data-id'),
          value: el.getAttribute('data-value') === 'true'
        });
      });
    }

    // All action buttons (CTA, tasks, utility, footer)
    for (const el of document.querySelectorAll('[data-action]')) {
      el.addEventListener('click', () => {
        markBusy(el);
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
