import * as vscode from "vscode";
import { escapeHtml, getNonce } from "../firewall/util";
import {
    PROTECTION,
    capabilityUiBadge,
    type ProtectionLevel,
} from "../protection/ProtectionLevel";
import type { WorkspaceGuard } from "../workspace-guard/WorkspaceGuard";
import type { AISentinel } from "../sentinel/AISentinel";
import type { BrokerManager } from "../broker/BrokerManager";
import type { ProtectionStateService } from "../protection/ProtectionStateService";


/**
 * SoterAI Control Panel — the single sidebar surface where a user manages every
 * protection toggle from their VS Code screen, without hunting through the
 * command palette or six separate status-bar items.
 *
 * Design rules (non-negotiable, inherited from ProtectionLevel):
 *   - Toggles apply INSTANTLY (no save step) by delegating to the SAME commands
 *     the palette uses, so there is one source of truth for each control.
 *   - Every ON state shows an HONEST protection badge. A control is only labelled
 *     ENFORCED when SoterAI technically controls that path (e.g. brokered Safe
 *     Mode while the broker is running). Advisory controls that cannot intercept
 *     other extensions/processes are labelled MONITORED and say so in plain text.
 *   - The webview never receives secrets, tokens, or raw file content.
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
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [] };

        webviewView.webview.onDidReceiveMessage(async (message: unknown) => {
            await this.handleMessage(message);
        });

        // Keep the panel truthful when the user toggles something elsewhere
        // (palette, status bar) or when broker/workspace state changes.
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) void this.render();
        });

        void this.render();
    }

    /** Re-render from live state. Safe to call from the global refreshViews(). */
    public refresh(): void {
        if (this.view) void this.render();
    }

    // ── toggle handling ─────────────────────────────────────────────────────
    // Phase 11: five primary workflows + toggles/lockdown/coverage. Advanced
    // palette commands stay gated by soterai.showAllCommands (default false).
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
        "action:mcpPreflight",
        "action:depGuard",
    ]);


    private async handleMessage(message: unknown): Promise<void> {
        const msg = message as { type?: string; value?: boolean } | undefined;
        const type = typeof msg?.type === "string" ? msg.type : undefined;
        if (!type || !ControlPanelViewProvider.ALLOWED.has(type)) {
            // Rejected message: fail closed without logging untrusted webview data.
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
                    await vscode.workspace
                        .getConfiguration("soterai")
                        .update("liveScan.enabled", on, vscode.ConfigurationTarget.Global);
                    break;
                case "toggle:sentinel":
                    await vscode.commands.executeCommand(on ? "soterai.enableAISentinel" : "soterai.disableAISentinel");
                    break;
                case "toggle:mcpFirewall":
                    await vscode.workspace
                        .getConfiguration("soterai")
                        .update("mcpFirewall.strictMode", on, vscode.ConfigurationTarget.Global);
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
                case "action:mcpPreflight":
                    await vscode.commands.executeCommand("soterai.preflightMCPTool");
                    break;
                case "action:depGuard":
                    await vscode.commands.executeCommand("soterai.checkDependencyInstall");
                    break;

            }

        } catch (error) {
            vscode.window.showErrorMessage(`SoterAI: could not apply that change — ${error instanceof Error ? error.message : String(error)}`);
        }

        // Reflect real post-change state everywhere (status bar, trees, panel).
        this.deps.refreshViews();
        await this.render();
    }

    // ── state gathering (only booleans/labels; never secrets) ────────────────
    private async gatherState(): Promise<PanelState> {
        const config = vscode.workspace.getConfiguration("soterai");
        const safeMode = this.context.globalState.get<{ enabled?: boolean; level?: string }>("soterai.safeMode");

        let brokerRunning = false;
        try {
            const status = await this.deps.brokerManager.status();
            brokerRunning = Boolean(status.running);
        } catch {
            /* broker optional / stopped */
        }

        return {
            safeMode: Boolean(safeMode?.enabled),
            safeModeLevel: safeMode?.level,
            protectedWorkspace: this.deps.workspaceGuard.isEnabled,
            liveScan: config.get<boolean>("liveScan.enabled", true),
            sentinel: this.deps.sentinel.isEnabled,
            mcpFirewall: config.get<boolean>("mcpFirewall.strictMode", false),
            brokerRunning,
            trusted: vscode.workspace.isTrusted,
        };
    }

    private async render(): Promise<void> {
        if (!this.view) return;
        const state = await this.gatherState();
        const protection = await this.deps.protectionState.refresh();
        this.view.webview.html = this.html(this.view.webview, state, protection.descriptor);
    }

    // ── honest badge mapping ─────────────────────────────────────────────────
    private toggleModel(state: PanelState): ToggleModel[] {
        return [
            {
                id: "safeMode",
                label: "AI Safe Mode",
                on: state.safeMode,
                // Enforced ONLY for brokered traffic while the broker runs; otherwise the
                // policy exists but cannot technically block un-brokered paths.
                level: !state.safeMode ? undefined : state.brokerRunning ? "ENFORCED" : "MONITORED",
                note: state.safeMode
                    ? state.brokerRunning
                        ? `Enforced on brokered AI traffic${state.safeModeLevel ? ` (${state.safeModeLevel})` : ""}. Traffic that bypasses the broker is not covered.`
                        : "Policy set, but the local broker is stopped — un-brokered AI traffic is not blocked. Start the broker for enforcement."
                    : "AI Safe Mode rules are not applied.",
            },
            {
                id: "protectedWorkspace",
                label: "Protected Workspace",
                on: state.protectedWorkspace,
                level: state.protectedWorkspace ? "REDACTED" : undefined,
                note: state.protectedWorkspace
                    ? "Protected files are excluded from SoterAI-built AI context. Direct reads by other extensions/tools are not intercepted."
                    : "Listed files are not excluded from AI context bundles.",
            },
            {
                id: "liveScan",
                label: "Live Scan on Save",
                on: state.liveScan,
                // Registry: live-scan = VISIBILITY_ONLY → UI MONITORED (never ENFORCED).
                level: state.liveScan ? (capabilityUiBadge("live-scan")?.uiLevel ?? "MONITORED") : undefined,
                note: state.liveScan
                    ? `Files are scanned as you type/save (pipeline 1.1.0: secrets, PII, prompt-injection, jailbreak). Registry level: ${capabilityUiBadge("live-scan")?.registryLevel ?? "VISIBILITY_ONLY"} — diagnostics only; does not block send-to-AI or other extensions.`
                    : "Files are not scanned automatically on save.",
            },
            {
                id: "sentinel",
                label: "AI Sentinel",
                on: state.sentinel,
                level: state.sentinel ? "MONITORED" : undefined,
                note: state.sentinel
                    ? "Records a redacted timeline of observed AI activity. Observes only — it does not block."
                    : "AI activity is not being recorded.",
            },
            {
                id: "mcpFirewall",
                label: "MCP Firewall (strict)",
                on: state.mcpFirewall,
                // Registry: mcp-config-scan = DETECTION_ONLY → UI MONITORED.
                level: state.mcpFirewall ? (capabilityUiBadge("mcp-config-scan")?.uiLevel ?? "MONITORED") : undefined,
                note: state.mcpFirewall
                    ? `MCP configs are scanned strictly and risky tools are flagged (${capabilityUiBadge("mcp-config-scan")?.registryLevel ?? "DETECTION_ONLY"}). Optional broker preflight (soterai.preflightMCPTool) is DETECTION_ONLY unless the caller respects the decision; other MCP clients remain unenforced.`
                    : "MCP configs use standard (non-strict) checks.",
            },


        ];
    }

    private html(webview: vscode.Webview, state: PanelState, protection: import("../protection/ProtectionState").ProtectionStateDescriptor): string {
        const nonce = getNonce();
        const toggles = this.toggleModel(state);
        const activeCount = toggles.filter((t) => t.on).length;

        const rows = toggles
            .map((t) => {
                const badge = t.on && t.level ? `<span class="lvl lvl-${t.level}">${escapeHtml(PROTECTION[t.level].label)}</span>` : "";
                return `
      <div class="row">
        <div class="row-main">
          <button class="sw ${t.on ? "on" : "off"}" data-id="${t.id}" data-value="${t.on ? "false" : "true"}"
                  role="switch" aria-checked="${t.on}" aria-label="${escapeHtml(t.label)}">
            <span class="knob"></span>
          </button>
          <div class="row-text">
            <div class="row-title">${escapeHtml(t.label)} ${badge}</div>
            <div class="row-note">${escapeHtml(t.note)}</div>
          </div>
        </div>
      </div>`;
            })
            .join("");

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: var(--vscode-font-family, sans-serif); color: var(--vscode-foreground); padding: 10px 8px 16px; }
    .hero { display:flex; align-items:center; gap:10px; padding:12px; border-radius:8px;
            background: var(--vscode-sideBar-background); border:1px solid var(--vscode-panel-border); margin-bottom:12px; }
    .hero .ico { font-size:22px; }
    .hero .txt { line-height:1.3; }
    .hero .state { font-weight:700; font-size:14px; }
    .hero .sub { font-size:11px; color: var(--vscode-descriptionForeground); }
    .row { padding:10px 4px; border-bottom:1px solid var(--vscode-panel-border); }
    .row-main { display:flex; gap:10px; align-items:flex-start; }
    .row-text { flex:1; }
    .row-title { font-size:13px; font-weight:600; display:flex; align-items:center; gap:6px; }
    .row-note { font-size:11px; color: var(--vscode-descriptionForeground); margin-top:3px; }
    .lvl { font-size:10px; font-weight:700; padding:1px 6px; border-radius:10px; color:#fff; }
    .lvl-ENFORCED { background:#16a34a; } .lvl-VERIFIED { background:#0891b2; }
    .lvl-REDACTED { background:#7c3aed; } .lvl-MONITORED { background:#d97706; }
    .lvl-UNKNOWN { background:#6b7280; } .lvl-EXPOSED { background:#dc2626; }
    .sw { width:38px; height:22px; border-radius:11px; border:none; cursor:pointer; position:relative;
          flex:0 0 auto; margin-top:2px; transition:background .15s; }
    .sw.on { background:#16a34a; } .sw.off { background: var(--vscode-input-background); border:1px solid var(--vscode-panel-border); }
    .sw .knob { position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%; background:#fff; transition:left .15s; }
    .sw.on .knob { left:18px; }
    .workflows { margin-top:14px; display:flex; flex-direction:column; gap:6px; }
    .wf-title { font-size:12px; font-weight:700; margin-bottom:2px; }
    .actions { margin-top:14px; display:flex; flex-direction:column; gap:8px; }
    .btn { padding:8px 12px; border:none; border-radius:5px; cursor:pointer; font-size:12px; font-weight:600; text-align:center; }
    .btn.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .btn.danger { background:#dc2626; color:#fff; }

    .foot { margin-top:12px; font-size:10px; color: var(--vscode-descriptionForeground); line-height:1.4; }
    .trust { font-size:10px; color: var(--vscode-descriptionForeground); margin-top:4px; }
  </style>
</head>
<body>
  <div class="hero">
    <div class="ico">🛡️</div>
    <div class="txt">
      <div class="state">${escapeHtml(protection.title)}</div>
      <div class="sub">${escapeHtml(protection.explanation)}</div>
      <div class="sub">${activeCount}/${toggles.length} controls on · ${escapeHtml(protection.coverage)}</div>
      <div class="sub"><strong>Next:</strong> ${escapeHtml(protection.recommendedAction)}</div>
    </div>
  </div>

  ${rows}

  <div class="workflows">
    <div class="wf-title">Primary workflows</div>
    <button class="btn primary" data-action="fullProtection" aria-label="Enable Full Protection">Enable Full Protection</button>
    <button class="btn secondary" data-action="setupBroker">1. Setup Broker Integration</button>
    <button class="btn secondary" data-action="controlledTerminal">2. Controlled Terminal</button>
    <button class="btn secondary" data-action="scanClipboard">3. Scan Clipboard</button>
    <button class="btn secondary" data-action="mcpPreflight">4. Preflight MCP Tool</button>
    <button class="btn secondary" data-action="depGuard">5. Check Dependencies</button>
  </div>

  <div class="actions">
    <button class="btn secondary" data-action="openCoverage">View Coverage Matrix</button>
    <button class="btn danger" data-action="lockdown">🔴 Emergency Lockdown</button>
  </div>


  <div class="trust">Workspace: ${state.trusted ? "Trusted" : "Restricted"} · Broker: ${state.brokerRunning ? "Running (enforced path available)" : "Stopped (advisory only)"}</div>
  <div class="foot">Badges are honest: <b>Enforced</b> means SoterAI technically controls that path; <b>Monitoring only</b> means advisory detection that cannot intercept other extensions or processes.</div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('.sw').forEach((el) => {
      el.addEventListener('click', () => {
        vscode.postMessage({ type: 'toggle:' + el.getAttribute('data-id'), value: el.getAttribute('data-value') === 'true' });
      });
    });
    document.querySelectorAll('[data-action]').forEach((el) => {
      el.addEventListener('click', () => {
        vscode.postMessage({ type: 'action:' + el.getAttribute('data-action') });
      });
    });
  </script>
</body>
</html>`;
    }
}

interface PanelState {
    safeMode: boolean;
    safeModeLevel?: string;
    protectedWorkspace: boolean;
    liveScan: boolean;
    sentinel: boolean;
    mcpFirewall: boolean;
    brokerRunning: boolean;
    trusted: boolean;
}

interface ToggleModel {
    id: "safeMode" | "protectedWorkspace" | "liveScan" | "sentinel" | "mcpFirewall";
    label: string;
    on: boolean;
    level?: ProtectionLevel;
    note: string;
}
