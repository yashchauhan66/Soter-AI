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
        // Lockdown recovery. Without this the panel could enter Emergency
        // Lockdown and offer no way out except the command palette.
        "action:unlock",
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
                case "action:unlock":
                    await vscode.commands.executeCommand("soterai.unlockProtection");
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
    // Wording, ordering and the registry-resolved badge live in panelContent.ts
    // so they can be unit-tested without a VS Code host. capabilityUiBadge is
    // called there, which keeps the "no claim stronger than the registry" rule
    // in one place instead of duplicated per surface.

    private html(
        webview: vscode.Webview,
        state: PanelState,
        protection: import("../protection/ProtectionState").ProtectionStateDescriptor,
    ): string {
        const nonce = getNonce();
        const facts: PanelFacts = state;
        const controls = plainControls(facts);
        const activeCount = controls.filter((c) => c.on).length;
        const cta = primaryCta(protection.state, facts);
        const tasks = panelTasks();
        const firstRun = activeCount === 0 && !state.brokerRunning;

        const row = (c: PlainControl): string => {
            const badge =
                c.on && c.level
                    ? `<span class="lvl lvl-${c.level}">${escapeHtml(PROTECTION[c.level].label)}</span>`
                    : "";
            return `
      <div class="row">
        <button class="sw ${c.on ? "on" : "off"}" data-id="${c.id}" data-value="${c.on ? "false" : "true"}"
                data-focus="sw-${c.id}" role="switch" aria-checked="${c.on}"
                aria-label="${escapeHtml(c.label)}"><span class="knob"></span></button>
        <div class="row-text">
          <div class="row-title">${escapeHtml(c.label)} ${badge}</div>
          <div class="row-note">${escapeHtml(c.summary)}</div>
          <details class="more">
            <summary>Exactly what this covers</summary>
            <p>${escapeHtml(c.detail)}</p>
          </details>
        </div>
      </div>`;
        };

        const taskButtons = tasks
            .map(
                (t) => `
    <button class="task" data-action="${t.action.replace("action:", "")}" data-focus="${t.action}">
      <span class="task-ico" aria-hidden="true">${t.icon}</span>
      <span class="task-text">
        <span class="task-label">${escapeHtml(t.label)}</span>
        <span class="task-hint">${escapeHtml(t.hint)}</span>
      </span>
    </button>`,
            )
            .join("");

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: var(--vscode-font-family, sans-serif); color: var(--vscode-foreground);
           padding: 12px 10px 18px; font-size:13px; }
    h2 { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em;
         color: var(--vscode-descriptionForeground); margin:18px 0 8px; }

    /* Status: one sentence, one severity colour, no wall of text. */
    .status { padding:12px; border-radius:8px; border:1px solid var(--vscode-panel-border);
              background: var(--vscode-sideBar-background); border-left-width:3px; }
    .status.info { border-left-color:#16a34a; }
    .status.warning { border-left-color:#d97706; }
    .status.error, .status.critical { border-left-color:#dc2626; }
    .status .state { font-weight:700; font-size:14px; }
    .status .sub { font-size:11px; color: var(--vscode-descriptionForeground); margin-top:4px; line-height:1.45; }

    /* Exactly one primary button, so there is never a choice to agonise over. */
    .cta { width:100%; margin-top:10px; padding:10px 12px; border:none; border-radius:6px;
           cursor:pointer; font-size:13px; font-weight:600; text-align:center;
           background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .cta.calm { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .cta-hint { font-size:11px; color: var(--vscode-descriptionForeground); margin-top:6px; line-height:1.45; }

    .task { display:flex; width:100%; gap:10px; align-items:flex-start; text-align:left;
            padding:9px 10px; margin-bottom:6px; cursor:pointer; border-radius:6px;
            border:1px solid var(--vscode-panel-border); background:transparent;
            color: var(--vscode-foreground); font-size:13px; font-family:inherit; }
    .task:hover { background: var(--vscode-list-hoverBackground); }
    .task.blocked .task-ico { opacity:.45; }
    .task-ico { font-size:15px; line-height:1.3; }
    .task-text { display:flex; flex-direction:column; gap:2px; }
    .task-label { font-weight:600; }
    .task-hint { font-size:11px; color: var(--vscode-descriptionForeground); line-height:1.4; }

    .row { display:flex; gap:10px; align-items:flex-start; padding:10px 2px;
           border-bottom:1px solid var(--vscode-panel-border); }
    .row-text { flex:1; }
    .row-title { font-weight:600; display:flex; align-items:center; gap:6px; }
    .row-note { font-size:11px; color: var(--vscode-descriptionForeground); margin-top:3px; line-height:1.45; }
    .more { margin-top:5px; }
    .more summary { font-size:11px; color: var(--vscode-textLink-foreground); cursor:pointer; }
    .more p { font-size:11px; color: var(--vscode-descriptionForeground); margin:5px 0 0; line-height:1.5; }

    .lvl { font-size:10px; font-weight:700; padding:1px 6px; border-radius:10px; color:#fff; }
    .lvl-ENFORCED { background:#16a34a; } .lvl-VERIFIED { background:#0891b2; }
    .lvl-REDACTED { background:#7c3aed; } .lvl-MONITORED { background:#d97706; }
    .lvl-UNKNOWN { background:#6b7280; } .lvl-EXPOSED { background:#dc2626; }

    .sw { width:38px; height:22px; border-radius:11px; border:none; cursor:pointer; position:relative;
          flex:0 0 auto; margin-top:2px; transition:background .15s; }
    .sw.on { background:#16a34a; }
    .sw.off { background: var(--vscode-input-background); border:1px solid var(--vscode-panel-border); }
    .sw .knob { position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%;
                background:#fff; transition:left .15s; }
    .sw.on .knob { left:18px; }

    [aria-busy="true"] { opacity:.55; cursor:progress; }
    :focus-visible { outline:2px solid var(--vscode-focusBorder); outline-offset:2px; }

    .escape { margin-top:16px; display:flex; flex-direction:column; gap:6px; }
    .btn { padding:7px 12px; border:none; border-radius:5px; cursor:pointer; font-size:12px;
           font-weight:600; text-align:center; font-family:inherit; }
    .btn.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .btn.danger { background:transparent; color:#dc2626; border:1px solid #dc2626; }
    .foot { margin-top:14px; font-size:10px; color: var(--vscode-descriptionForeground); line-height:1.5; }
  </style>
</head>
<body>
  <div class="status ${escapeHtml(protection.severity)}">
    <div class="state">${escapeHtml(protection.title)}</div>
    <div class="sub">${escapeHtml(protection.explanation)}</div>
    <div class="sub">${activeCount} of ${controls.length} controls on · ${escapeHtml(protection.coverage)}</div>
  </div>

  <button class="cta ${cta.tone === "calm" ? "calm" : ""}" data-action="${cta.action.replace("action:", "")}"
          data-focus="${cta.action}">${escapeHtml(cta.label)}</button>
  <div class="cta-hint">${escapeHtml(cta.hint)}</div>

  ${firstRun ? `<div class="cta-hint"><strong>New here?</strong> Press the button above once. Nothing is sent anywhere — all checking happens on this machine.</div>` : ""}

  <h2>Do something now</h2>
  ${taskButtons}

  <h2>Controls</h2>
  ${controls.map(row).join("")}

  <div class="escape">
    <button class="btn secondary" data-action="openCoverage" data-focus="action:openCoverage">What is actually covered?</button>
    <button class="btn danger" data-action="lockdown" data-focus="action:lockdown">Emergency lockdown</button>
  </div>

  <div class="foot">
    Workspace: ${state.trusted ? "Trusted" : "Restricted"} · Local checking: ${state.brokerRunning ? "on" : "off"}<br>
    Badges are honest. <b>Enforced</b> means SoterAI technically controls that path.
    <b>Monitoring only</b> means it can warn you but cannot stop another extension or process.
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    // The panel re-renders by replacing the whole document, which drops keyboard
    // focus and silently punishes anyone not using a mouse. setState survives
    // that replacement, so the focused control is restored afterwards.
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

    // A toggle round-trips through the extension host and back. Without this the
    // switch looks dead for that whole window and users click it twice.
    function busy(el) {
      el.setAttribute('aria-busy', 'true');
      el.setAttribute('disabled', 'true');
    }

    for (const el of document.querySelectorAll('.sw')) {
      el.addEventListener('click', () => {
        busy(el);
        vscode.postMessage({
          type: 'toggle:' + el.getAttribute('data-id'),
          value: el.getAttribute('data-value') === 'true'
        });
      });
    }
    for (const el of document.querySelectorAll('[data-action]')) {
      el.addEventListener('click', () => {
        busy(el);
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
