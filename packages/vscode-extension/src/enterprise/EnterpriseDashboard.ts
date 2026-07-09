import * as vscode from "vscode";
import { escapeHtml, showInfoWebview, getNonce } from "../firewall/util";
import { ExtensionState } from "../state";
import { PolicyStore } from "../firewall/PolicyStore";
import { LedgerStore } from "../firewall/LedgerStore";
import { getBrokerManager } from "../broker/BrokerManager";

export class EnterpriseDashboard {
    public static currentPanel: EnterpriseDashboard | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel) {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    public static createOrShow(
        context: vscode.ExtensionContext,
        sentinel?: { isEnabled: boolean; getEvents: () => ReadonlyArray<any>; getHighRiskEvents: () => any[] },
        workspaceGuard?: { isEnabled: boolean; getProtectedFiles: () => ReadonlyArray<any>; getWorkspaceRiskScore: () => number },
        memoryGuard?: { getFindings: () => ReadonlyArray<any> }
    ): void {
        const column = vscode.window.activeTextEditor?.viewColumn;
        if (EnterpriseDashboard.currentPanel) {
            EnterpriseDashboard.currentPanel._panel.reveal(column);
            EnterpriseDashboard.currentPanel._refresh(sentinel, workspaceGuard, memoryGuard);
            return;
        }
        const panel = vscode.window.createWebviewPanel(
            "soteraiEnterpriseDashboard", "SoterAI Enterprise Risk Dashboard",
            column || vscode.ViewColumn.One,
            { enableScripts: false, retainContextWhenHidden: true }
        );
        EnterpriseDashboard.currentPanel = new EnterpriseDashboard(panel);
        EnterpriseDashboard.currentPanel._refresh(sentinel, workspaceGuard, memoryGuard);
    }

    public refresh(): void { this._refresh(); }

    private async _refresh(
        sentinel?: { isEnabled: boolean; getEvents: () => ReadonlyArray<any>; getHighRiskEvents: () => any[] },
        workspaceGuard?: { isEnabled: boolean; getProtectedFiles: () => ReadonlyArray<any>; getWorkspaceRiskScore: () => number },
        memoryGuard?: { getFindings: () => ReadonlyArray<any> }
    ): Promise<void> {
        const state = ExtensionState.getInstance();
        const config = vscode.workspace.getConfiguration("soterai");
        const decision = state.latestDecision;
        const firewall = { policyExists: false, protectedCount: 0, ledgerCount: 0 };
        try {
            firewall.policyExists = await PolicyStore.exists();
            const policy = await PolicyStore.load();
            firewall.protectedCount = policy.protectedFiles.length;
            const entries = await LedgerStore.readAll();
            firewall.ledgerCount = entries.length;
        } catch { /* no workspace */ }

        let broker = { running: false, safeMode: "Off", memory: "Idle" };
        try {
            const manager = getBrokerManager();
            if (manager) {
                const status = await manager.status();
                broker = { running: status.running, safeMode: status.safeMode?.enabled ? `On (${status.safeMode.level})` : "Off", memory: status.memorySessionId ? "Active" : "Idle" };
            }
        } catch { /* broker optional */ }

        const workspaceRisk = workspaceGuard?.getWorkspaceRiskScore() ?? 0;
        const sentinelEvents = sentinel?.getEvents().length ?? 0;
        const sentinelHighRisk = sentinel?.getHighRiskEvents().length ?? 0;
        const memoryFindings = memoryGuard?.getFindings().length ?? 0;
        const overallRisk = decision?.riskScore ?? 0;
        const scoreColor = overallRisk >= 70 ? "#ef4444" : overallRisk >= 35 ? "#f59e0b" : "#10b981";

        const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Enterprise Risk Dashboard</title>
<style>
body{font-family:var(--vscode-font-family,sans-serif);padding:24px;color:var(--vscode-foreground);background:var(--vscode-editor-background)}
.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:16px}
.card{background:var(--vscode-sideBar-background);border:1px solid var(--vscode-panel-border);border-radius:8px;padding:16px}
.card-title{font-size:14px;font-weight:600;margin-bottom:8px;border-bottom:1px solid var(--vscode-panel-border);padding-bottom:6px}
.score-badge{display:inline-block;width:48px;height:48px;line-height:48px;text-align:center;border-radius:50%;font-size:18px;font-weight:bold;color:#fff;background:${scoreColor}}
.stat-row{display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px}
.badge{display:inline-block;padding:1px 6px;border-radius:10px;font-size:10px;font-weight:700;color:#fff}
.block{background:#ef4444}.warn{background:#f59e0b}.allow{background:#22c55e}
.note{color:var(--vscode-descriptionForeground);font-size:11px;margin-top:12px}
h1{font-size:18px;color:var(--vscode-textLink-foreground)}
</style></head><body>
<h1>SoterAI Enterprise Risk Dashboard</h1>
<div class="grid">
<div class="card"><div class="card-title">Overall Risk Score</div><div style="display:flex;align-items:center;gap:16px"><div class="score-badge">${overallRisk}</div><div><div style="font-weight:600">Latest Score</div><div style="font-size:11px;color:var(--vscode-descriptionForeground)">Decision: ${decision?.decision?.toUpperCase() ?? "NONE"}</div></div></div></div>

<div class="card"><div class="card-title">Workspace Protection</div>
<div class="stat-row"><span>Protected Files:</span><strong>${workspaceGuard?.getProtectedFiles().length ?? firewall.protectedCount}</strong></div>
<div class="stat-row"><span>Protected Mode:</span><strong>${workspaceGuard?.isEnabled ? "Active" : "Off"}</strong></div>
<div class="stat-row"><span>Workspace Risk:</span><strong>${workspaceRisk}/100</strong></div>
<div class="stat-row"><span>Policy:</span><strong>${firewall.policyExists ? "Active" : "Default"}</strong></div></div>

<div class="card"><div class="card-title">AI Activity Sentinel</div>
<div class="stat-row"><span>Status:</span><strong>${sentinel?.isEnabled ? "Active" : "Off"}</strong></div>
<div class="stat-row"><span>Total Events:</span><strong>${sentinelEvents}</strong></div>
<div class="stat-row"><span>High Risk:</span><strong>${sentinelHighRisk}</strong></div></div>

<div class="card"><div class="card-title">Local AI Broker</div>
<div class="stat-row"><span>Status:</span><strong>${broker.running ? "Running" : "Stopped"}</strong></div>
<div class="stat-row"><span>Safe Mode:</span><strong>${escapeHtml(broker.safeMode)}</strong></div>
<div class="stat-row"><span>Memory:</span><strong>${escapeHtml(broker.memory)}</strong></div>
<div class="stat-row"><span>Network:</span><strong>127.0.0.1 only</strong></div></div>

<div class="card"><div class="card-title">Memory Poisoning Guard</div>
<div class="stat-row"><span>Findings:</span><strong>${memoryFindings}</strong></div>
<div class="stat-row"><span>Status:</span><strong>${memoryFindings > 0 ? "Issues Found" : "Clean"}</strong></div></div>

<div class="card"><div class="card-title">Security Posture</div>
<div class="stat-row"><span>Cloud Sync:</span><strong>${config.get("cloud.enabled", false) ? "Enabled" : "Disabled"}</strong></div>
<div class="stat-row"><span>Policy Mode:</span><strong>${config.get("policy.mode", "local").toUpperCase()}</strong></div>
<div class="stat-row"><span>Ledger Events:</span><strong>${firewall.ledgerCount}</strong></div>
<div class="stat-row"><span>Trusted:</span><strong>${vscode.workspace.isTrusted ? "Yes" : "No"}</strong></div></div>
</div>
<div class="note" style="margin-top:16px">Risk scores are deterministic and explainable. No fake precision. Dashboard data is redacted — no raw secrets are displayed.</div>
</body></html>`;

        this._panel.webview.html = html;
    }

    public dispose(): void {
        EnterpriseDashboard.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) { const x = this._disposables.pop(); if (x) x.dispose(); }
    }
}

export function registerDashboardCommands(context: vscode.ExtensionContext, refresh: () => void): void {
    const reg = (id: string, handler: (...args: any[]) => any) => context.subscriptions.push(vscode.commands.registerCommand(id, handler));

    reg("soterai.openEnterpriseDashboard", () => {
        EnterpriseDashboard.createOrShow(context);
    });

    reg("soterai.exportEnterpriseRiskReport", async () => {
        const state = ExtensionState.getInstance();
        const decision = state.latestDecision;
        const firewall = { policyExists: false, protectedCount: 0, ledgerCount: 0 };
        try {
            firewall.policyExists = await PolicyStore.exists();
            const policy = await PolicyStore.load();
            firewall.protectedCount = policy.protectedFiles.length;
            const entries = await LedgerStore.readAll();
            firewall.ledgerCount = entries.length;
        } catch { /* no workspace */ }

        const report = {
            exportedAt: new Date().toISOString(),
            overallRisk: decision?.riskScore ?? 0,
            decision: decision?.decision ?? "none",
            findings: decision?.findings?.map((f: any) => ({
                severity: f.severity, title: f.title, category: f.category, redactedEvidence: f.redactedEvidence
            })) ?? [],
            policy: { exists: firewall.policyExists, protectedCount: firewall.protectedCount },
            ledgerEvents: firewall.ledgerCount,
            cloudEnabled: vscode.workspace.getConfiguration("soterai").get("cloud.enabled", false),
            policyMode: vscode.workspace.getConfiguration("soterai").get("policy.mode", "local"),
        };
        const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(report, null, 2), language: "json" });
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage("Enterprise risk report exported (redacted).");
    });
}
