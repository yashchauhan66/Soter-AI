import * as vscode from "vscode";
import { ExtensionState } from "../state";

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
                switch (message.command) {
                    case "scanCurrentFile":
                        await vscode.commands.executeCommand("soterai.scanCurrentFile");
                        this.refresh();
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
        this._update();
    }

    private _update(): void {
        const webview = this._panel.webview;
        const state = ExtensionState.getInstance();
        const config = vscode.workspace.getConfiguration("soterai");
        const cloudEnabled = config.get("cloud.enabled", false);
        const policyMode = config.get("policy.mode", "local");
        const decision = state.latestDecision;

        webview.html = this._getHtmlForWebview(webview, {
            cloudEnabled,
            policyMode,
            latestDecision: decision,
            trusted: state.isWorkspaceTrusted(),
        });
    }

    private _getHtmlForWebview(
        webview: vscode.Webview,
        data: { cloudEnabled: boolean; policyMode: string; latestDecision?: any; trusted: boolean }
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

  <div class="card" style="margin-top:20px; grid-column:span 2;">
    <div class="card-title">⚠️ Latest Security Findings</div>
    ${hasFindings ?
                `<div>
        ${data.latestDecision.findings.map((f: any) => `
          <div class="finding-item">
            <span class="badge" style="background:${f.severity === 'critical' || f.severity === 'high' ? '#ef4444' : '#f59e0b'}">${f.severity.toUpperCase()}</span>
            <span class="finding-id">${f.title}</span> - <span style="font-style:italic">${f.category}</span>
            <div class="finding-desc">${f.reason}</div>
            <div style="font-family:var(--vscode-editor-font-family); font-size:11px; margin-top:2px;">Redacted Evidence: <code>${f.redactedEvidence}</code></div>
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

function getNonce(): string {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
