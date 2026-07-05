import * as vscode from "vscode";
import { ExtensionState } from "./state";
import { registerCommands } from "./commands";
import { RiskTreeProvider } from "./views/RiskTreeProvider";
import { DashboardPanel } from "./webview/DashboardPanel";
import { TelemetryManager } from "./telemetry";

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext): void {
    console.log("SoterAI IDE Guard activated successfully.");

    // Init ExtensionState
    const state = ExtensionState.getInstance();
    state.initEngine();

    // Create & Register Tree Views
    const projectRiskProvider = new RiskTreeProvider("soterai-project-risk");
    const latestFindingsProvider = new RiskTreeProvider("soterai-latest-findings");
    const policyStatusProvider = new RiskTreeProvider("soterai-policy-status");

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider("soterai-project-risk", projectRiskProvider),
        vscode.window.registerTreeDataProvider("soterai-latest-findings", latestFindingsProvider),
        vscode.window.registerTreeDataProvider("soterai-policy-status", policyStatusProvider)
    );

    const refreshViews = () => {
        projectRiskProvider.refresh();
        latestFindingsProvider.refresh();
        policyStatusProvider.refresh();
        if (DashboardPanel.currentPanel) {
            DashboardPanel.currentPanel.refresh();
        }
        updateStatusBar();
    };

    // Register commands
    registerCommands(context, refreshViews);

    // Status Bar Indicator
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = "soterai.openSecurityPanel";
    context.subscriptions.push(statusBarItem);
    updateStatusBar();
    statusBarItem.show();

    // Event Listeners
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("soterai")) {
                state.initEngine();
                TelemetryManager.getInstance().startBatchTimer();
                refreshViews();
            }
        })
    );

    // Auto-scan on active editor change/save if configured (defaults to simple update status)
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(() => {
            updateStatusBar();
        }),
        vscode.workspace.onDidSaveTextDocument(async (doc) => {
            // Auto-scan on save for file categories
            if (doc.uri.scheme === "file") {
                await vscode.commands.executeCommand("soterai.scanCurrentFile", doc.uri);
            }
        })
    );
}

function updateStatusBar(): void {
    const state = ExtensionState.getInstance();
    const latestRisk = state.latestDecision ? state.latestDecision.riskScore : 0;

    if (latestRisk >= 70) {
        statusBarItem.text = `$(shield) SoterAI: Blocked (${latestRisk})`;
        statusBarItem.tooltip = `High-Risk Content Blocked. Score: ${latestRisk}/100. click to open Dashboard.`;
        statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
    } else if (latestRisk >= 35) {
        statusBarItem.text = `$(shield) SoterAI: Warning (${latestRisk})`;
        statusBarItem.tooltip = `Risky content/patterns detected. Score: ${latestRisk}/100. click to open Dashboard.`;
        statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    } else {
        statusBarItem.text = `$(shield) SoterAI: Secure`;
        statusBarItem.tooltip = "Local AI Security Shield Active. Click to open SoterAI panel.";
        statusBarItem.backgroundColor = undefined;
    }
}

export function deactivate(): void {
    TelemetryManager.getInstance().dispose();
}
