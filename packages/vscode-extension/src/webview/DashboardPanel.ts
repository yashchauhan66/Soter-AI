import * as vscode from "vscode";
import { ExtensionState } from "../state";
import { PolicyStore } from "../firewall/PolicyStore";
import { LedgerStore } from "../firewall/LedgerStore";
import { getBrokerManager } from "../broker/BrokerManager";
import { escapeHtml, getNonce } from "../firewall/util";

export class DashboardPanel {
    public static currentPanel: DashboardPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

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
                    "connectCloud",
                    "disconnectCloud",
                ]);
                const cmd = typeof message?.command === "string" ? message.command : undefined;
                if (!cmd || !knownCommands.has(cmd)) {
                    console.warn(`[SoterAI Dashboard] Rejected unknown webview message command: ${String(message?.command)}`);
                    return;
                }
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
                    case "connectCloud":
                        await vscode.commands.executeCommand("soterai.connectToCloud");
                        this.refresh();
                        break;
                    case "disconnectCloud":
                        await vscode.commands.executeCommand("soterai.disconnectCloud");
                        this.refresh();
                        break;
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
        const webview = this._panel.webview;
        const state = ExtensionState.getInstance();
        const config = vscode.workspace.getConfiguration("soterai");
        const cloudEnabled = config.get("cloud.enabled", false);
        const policyMode = config.get("policy.mode", "local");
        const liveScanEnabled = config.get("liveScan.enabled", true);
        const decision = state.latestDecision;

        // AI Context Firewall summary (no context/secrets needed here).
        let firewall = { policyExists: false, protectedCount: 0, ledgerCount: 0, lastContext: "None" };
        try {
            const policyExists = await PolicyStore.exists();
            const policy = await PolicyStore.load();
            const entries = await LedgerStore.readAll();
            const last = entries.filter((e) => e.eventType === "context_built").pop();
            firewall = {
                policyExists,
                protectedCount: policy.protectedFiles.length,
                ledgerCount: entries.length,
                lastContext: last ? `${last.decision.toUpperCase()} — ${last.redactedEvidencePreview ?? ""}` : "None",
            };
        } catch {
            /* no workspace / read error — leave defaults */
        }

        let broker = { running: false, url: "http://127.0.0.1:47321", safeMode: "Off", memory: "Idle", recentEvents: 0 };
        try {
            const manager = getBrokerManager();
            if (manager) {
                const status = await manager.status();
                const recent = status.running
                    ? await manager.request<{ events: unknown[] }>("/v1/events/recent", { method: "GET" })
                    : { events: [] };
                broker = {
                    running: status.running,
                    url: status.url,
                    safeMode: status.safeMode?.enabled ? `On (${status.safeMode.level})` : "Off",
                    memory: status.memorySessionId ? "Active" : "Idle",
                    recentEvents: recent.events.length,
                };
            }
        } catch { /* broker is optional and may be stopped */ }

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

    private _getHtmlForWebview(
        webview: vscode.Webview,
        data: {
            cloudEnabled: boolean;
            policyMode: string;
            liveScanEnabled: boolean;
            latestDecision?: any;
            trusted: boolean;
            firewall: { policyExists: boolean; protectedCount: number; ledgerCount: number; lastContext: string };
            broker: { running: boolean; url: string; safeMode: string; memory: string; recentEvents: number };
        }
    ): string {
        const nonce = getNonce();
        const hasFindings = data.latestDecision?.findings && data.latestDecision.findings.length > 0;
        const scoreColor = data.latestDecision?.riskScore >= 70 ? "#ef4444" : data.latestDecision?.riskScore >= 35 ? "#f59e0b" : "#10b981";

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SoterAI IDE Shield</title>
  <style>
    body {
      font-family: var(--vscode-font-family, 'Segoe UI', Roboto, sans-serif);
      padding: 24px;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .title {
      font-size: 22px;
      font-weight: 600;
      color: var(--vscode-textLink-foreground);
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .card {
      background-color: var(--vscode-sideBar-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .card-title {
      font-size: 16px;
      font-weight: 500;
      margin-bottom: 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 8px;
    }
    .btn {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 500;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 12px;
    }
    .btn:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    .score-badge {
      display: inline-block;
      width: 48px;
      height: 48px;
      line-height: 48px;
      text-align: center;
      border-radius: 50%;
      font-size: 18px;
      font-weight: bold;
      color: #ffffff;
      background-color: ${scoreColor};
    }
    .stat-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 13px;
    }
    .badge {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
    }
    .finding-item {
      padding: 8px 0;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .finding-id {
      font-weight: bold;
      font-size: 12px;
    }
    .finding-desc {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">🛡️ SoterAI IDE Guard</div>
    <div>
      <span class="badge">${data.trusted ? "Workspace Trusted" : "Restricted Mode"}</span>
      <span class="badge" style="background:${data.liveScanEnabled ? 'var(--vscode-statusBarItem-remoteBackground)' : 'var(--vscode-statusBarItem-warningBackground)'}">Live Scan: ${data.liveScanEnabled ? "On" : "Off"}</span>
      <span class="badge" style="background:var(--vscode-statusBarItem-warningBackground)">Local Mode</span>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="card-title">🔍 Scan & Shield Status</div>
      <div style="display:flex; align-items:center; gap:20px;">
        <div class="score-badge">${data.latestDecision ? data.latestDecision.riskScore : 0}</div>
        <div>
          <div style="font-weight:600">Workspace Risk Score</div>
          <div style="font-size:12px; color:var(--vscode-descriptionForeground)">
            Latest Decision: <strong>${data.latestDecision ? data.latestDecision.decision.toUpperCase() : "NONE"}</strong>
          </div>
        </div>
      </div>
      <button class="btn" id="scanBtn">Scan Current File</button>
      <button class="btn" id="clipBtn" style="margin-left:8px;">Scan Clipboard</button>
      <button class="btn" id="guideBtn" style="margin-left:8px; background-color:var(--vscode-button-secondaryBackground); color:var(--vscode-button-secondaryForeground);">Getting Started</button>
    </div>

    <div class="card">
      <div class="card-title">☁️ SoterAI Cloud Sync</div>
      <div class="stat-row">
        <span>Cloud Mode:</span>
        <strong>${data.cloudEnabled ? "Enabled" : "Disabled (Offline Only)"}</strong>
      </div>
      <div class="stat-row">
        <span>Policy Mode:</span>
        <strong>${data.policyMode.toUpperCase()}</strong>
      </div>
      ${data.cloudEnabled ?
                `<button class="btn" style="background-color: var(--vscode-statusBarItem-errorBackground)" id="disconnectBtn">Disconnect Cloud</button>` :
                `<button class="btn" id="connectBtn">Connect to SoterAI Cloud</button>`
            }
    </div>
  </div>

  <div class="card" style="margin-top:20px;">
    <div class="card-title">🚦 AI Context Firewall</div>
    <div class="stat-row"><span>Project Policy:</span><strong>${data.firewall.policyExists ? "Active (.soterai/policy.json)" : "Not created"}</strong></div>
    <div class="stat-row"><span>Protected Patterns:</span><strong>${data.firewall.protectedCount}</strong></div>
    <div class="stat-row"><span>What-AI-Saw Ledger:</span><strong>${data.firewall.ledgerCount} event(s)</strong></div>
    <div class="stat-row"><span>Last AI Context:</span><strong>${escapeHtml(data.firewall.lastContext)}</strong></div>
    <div class="finding-desc" style="margin-top:10px;">Prevents accidental exposure of secrets/protected files to AI tools by gating, redacting, and auditing context. Cannot block another extension from reading un-migrated files — see the limitations doc.</div>
  </div>

  <div class="card" style="margin-top:20px;">
    <div class="card-title">Local AI Broker</div>
    <div class="stat-row"><span>Status:</span><strong>${data.broker.running ? "Running" : "Stopped"}</strong></div>
    <div class="stat-row"><span>Endpoint:</span><strong>${escapeHtml(data.broker.url)}</strong></div>
    <div class="stat-row"><span>Network:</span><strong>127.0.0.1 only + bearer auth</strong></div>
    <div class="stat-row"><span>Safe Mode:</span><strong>${escapeHtml(data.broker.safeMode)}</strong></div>
    <div class="stat-row"><span>AI Memory:</span><strong>${escapeHtml(data.broker.memory)}</strong></div>
    <div class="stat-row"><span>Recent protected events:</span><strong>${data.broker.recentEvents}</strong></div>
    <div class="finding-desc">Only traffic routed through the broker is fully inspected. Local auth tokens and provider keys are never sent to this webview.</div>
  </div>

  <div class="card" style="margin-top:20px; grid-column:span 2;">
    <div class="card-title">⚠️ Latest Security Findings</div>
    ${hasFindings ?
                `<div>
        ${data.latestDecision.findings.map((f: any) => `
          <div class="finding-item">
            <span class="badge" style="background:${f.severity === 'critical' || f.severity === 'high' ? '#ef4444' : '#f59e0b'}">${escapeHtml(String(f.severity).toUpperCase())}</span>
            <span class="finding-id">${escapeHtml(f.title)}</span> - <span style="font-style:italic">${escapeHtml(f.category)}</span>
            <div class="finding-desc">${escapeHtml(f.reason)}</div>
            <div style="font-family:var(--vscode-editor-font-family); font-size:11px; margin-top:2px;">Redacted Evidence: <code>${escapeHtml(f.redactedEvidence)}</code></div>
          </div>
        `).join("")}
      </div>` :
                `<div style="font-size:13px; color:var(--vscode-descriptionForeground); text-align:center; padding:20px 0;">No active threats detected. System secure.</div>`
            }
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('scanBtn')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'scanCurrentFile' });
    });
    document.getElementById('clipBtn')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'scanClipboard' });
    });
    document.getElementById('guideBtn')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'openWalkthrough' });
    });
    document.getElementById('connectBtn')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'connectCloud' });
    });
    document.getElementById('disconnectBtn')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'disconnectCloud' });
    });
  </script>
</body>
</html>`;
    }

    public dispose(): void {
        DashboardPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) x.dispose();
        }
    }
}


