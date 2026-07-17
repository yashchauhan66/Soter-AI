import * as vscode from "vscode";
import { ExtensionState } from "./state";
import { registerCommands } from "./commands";
import { registerFirewallCommands, readContextApproval } from "./firewall/commands";
import { setProtectedFileChecker } from "./firewall/ContextGatherer";
import { registerScannerCommands } from "./firewall/scanners";
import { PolicyStore } from "./firewall/PolicyStore";
import { RiskTreeProvider } from "./views/RiskTreeProvider";
import { DashboardPanel } from "./webview/DashboardPanel";
import { TelemetryManager } from "./telemetry";
import { BrokerManager, setBrokerManager } from "./broker/BrokerManager";
import { registerBrokerCommands } from "./broker/commands";
import { AISentinel } from "./sentinel/AISentinel";
import { registerSentinelCommands } from "./sentinel/commands";
import { PermissionStore } from "./permissions/PermissionStore";
import { registerPermissionCommands } from "./permissions/commands";
import { WorkspaceGuard, registerWorkspaceGuardCommands } from "./workspace-guard/WorkspaceGuard";
import { MCPFirewall, registerMCPFirewallCommands } from "./mcp-firewall/MCPFirewall";
import { MemoryGuard, registerMemoryGuardCommands } from "./memory-guard/MemoryGuard";
import { registerDepGuardCommands } from "./dep-guard/DepGuard";
import { registerPolicyPackCommands } from "./policy-packs/commands";
import { EnterpriseDashboard, registerDashboardCommands } from "./enterprise/EnterpriseDashboard";
import { registerLaunchCommands } from "./launchCommands";
import { registerLiveScanner } from "./diagnostics/LiveScanner";
import { registerClipboardGuard } from "./clipboard/ClipboardGuard";
import { registerSecretBrokerCommands } from "./secret-broker/commands";

let statusBarItem: vscode.StatusBarItem;
let firewallStatusItem: vscode.StatusBarItem;
let brokerStatusItem: vscode.StatusBarItem;
let safeModeStatusItem: vscode.StatusBarItem;
let memoryStatusItem: vscode.StatusBarItem;
let sentinel: AISentinel;
let permissionStore: PermissionStore;
let workspaceGuard: WorkspaceGuard;
let mcpFirewall: MCPFirewall;
let memoryGuard: MemoryGuard;
let extensionContext: vscode.ExtensionContext;
let brokerManager: BrokerManager;

export function activate(context: vscode.ExtensionContext): void {
    extensionContext = context;

    // Command-palette hygiene: ~100 advanced commands are gated behind the
    // `soterai.advancedCommands` context key so the default palette only shows
    // the 12 core commands. Every command still works from the SoterAI Guard
    // view, status bar, aliases, and executeCommand — this only controls palette
    // visibility. Flipped by either the launch-era `soterai.showAllCommands`
    // setting or the marketplace-facing `soterai.experimentalFeatures.enabled`
    // setting.
    const applyAdvancedCommandVisibility = () => {
        const config = vscode.workspace.getConfiguration("soterai");
        const showAll = config.get<boolean>("showAllCommands", false);
        const experimental = config.get<boolean>("experimentalFeatures.enabled", false);
        void vscode.commands.executeCommand("setContext", "soterai.advancedCommands", showAll || experimental);
    };
    applyAdvancedCommandVisibility();

    // First-run onboarding: open the native Getting Started walkthrough exactly
    // once, so a brand-new user is guided instead of facing a cold palette. The
    // flag lives in globalState; reinstalls/updates never re-trigger it, and it
    // stays silent if VS Code is opening with no UI (e.g. CLI-only sessions).
    if (!context.globalState.get<boolean>("soterai.onboarded")) {
        void context.globalState.update("soterai.onboarded", true);
        void vscode.commands.executeCommand(
            "workbench.action.openWalkthrough",
            "soterai.soterai-ide-guard#soterai.gettingStarted",
            false,
        );
    }

    const state = ExtensionState.getInstance();
    brokerManager = new BrokerManager(context);
    setBrokerManager(brokerManager);
    context.subscriptions.push(brokerManager);

    sentinel = new AISentinel(context);
    permissionStore = new PermissionStore(context);
    workspaceGuard = new WorkspaceGuard(context);
    // Enforce the Protected Workspace list on every SoterAI-built context
    // bundle: protected files never enter gatherContext() output. Direct reads
    // by other tools remain monitoring-only (see WorkspaceGuard honesty notes).
    setProtectedFileChecker((relPath) => workspaceGuard.isEnabled && workspaceGuard.isProtected(relPath));
    mcpFirewall = new MCPFirewall(context);
    memoryGuard = new MemoryGuard();

    context.subscriptions.push(sentinel, permissionStore, workspaceGuard);

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
        if (DashboardPanel.currentPanel) DashboardPanel.currentPanel.refresh();
        if (EnterpriseDashboard.currentPanel) EnterpriseDashboard.currentPanel.refresh();
        updateStatusBar();
        void updateFirewallStatus();
        void updateBrokerStatus();
    };

    registerCommands(context, refreshViews);
    registerFirewallCommands(context, refreshViews);
    registerScannerCommands(context);
    registerBrokerCommands(context, brokerManager, refreshViews);
    registerSentinelCommands(context, sentinel);
    registerPermissionCommands(context, permissionStore);
    registerWorkspaceGuardCommands(context, workspaceGuard);
    registerMCPFirewallCommands(context, mcpFirewall);
    registerMemoryGuardCommands(context, memoryGuard);
    registerDepGuardCommands(context);
    registerPolicyPackCommands(context, refreshViews);
    registerDashboardCommands(context, refreshViews);
    registerLaunchCommands(context);
    registerLiveScanner(context);
    registerClipboardGuard(context);
    registerSecretBrokerCommands(context, refreshViews);

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = "soterai.openSecurityPanel";
    context.subscriptions.push(statusBarItem);
    updateStatusBar();
    statusBarItem.show();

    firewallStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    firewallStatusItem.command = "soterai.inspectAIContext";
    context.subscriptions.push(firewallStatusItem);
    firewallStatusItem.show();
    void updateFirewallStatus();

    brokerStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 98);
    brokerStatusItem.command = "soterai.showBrokerStatus";
    safeModeStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 97);
    safeModeStatusItem.command = "soterai.showAISafeModeRules";
    memoryStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 96);
    memoryStatusItem.command = "soterai.openAIMemoryInspector";
    context.subscriptions.push(brokerStatusItem, safeModeStatusItem, memoryStatusItem);
    brokerStatusItem.show();
    safeModeStatusItem.show();
    memoryStatusItem.show();
    void updateBrokerStatus();

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("soterai")) {
                if (e.affectsConfiguration("soterai.showAllCommands") || e.affectsConfiguration("soterai.experimentalFeatures.enabled")) {
                    applyAdvancedCommandVisibility();
                }
                state.initEngine();
                TelemetryManager.getInstance().startBatchTimer();
                refreshViews();
            }
        })
    );

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(() => { updateStatusBar(); }),
        vscode.workspace.onDidSaveTextDocument(async (doc) => {
            const config = vscode.workspace.getConfiguration("soterai");
            const liveScanEnabled = config.get<boolean>("liveScan.enabled", true);
            if (liveScanEnabled && doc.uri.scheme === "file") await vscode.commands.executeCommand("soterai.scanCurrentFile", doc.uri);
        })
    );

    if (workspaceGuard.isEnabled) workspaceGuard.enable();
}

async function updateBrokerStatus(): Promise<void> {
    if (!brokerStatusItem || !brokerManager) return;
    const status = await brokerManager.status();
    brokerStatusItem.text = status.running ? "$(radio-tower) SoterAI Broker: Running" : "$(circle-slash) SoterAI Broker: Stopped";
    brokerStatusItem.tooltip = status.running ? `Authenticated local broker at ${status.url}` : "Local AI Broker is stopped";
    safeModeStatusItem.text = `$(shield) SoterAI Safe Mode: ${status.safeMode?.enabled ? "On" : "Off"}`;
    safeModeStatusItem.tooltip = status.safeMode?.enabled ? `Safe Mode level: ${status.safeMode.level}` : "AI Safe Mode is disabled";
    memoryStatusItem.text = `$(history) SoterAI Memory: ${brokerManager.memorySessionId ? "Active" : "Idle"}`;
    memoryStatusItem.tooltip = brokerManager.memorySessionId ? "AI Memory session is active" : "No active AI Memory session";
}

function updateStatusBar(): void {
    const state = ExtensionState.getInstance();
    // Honest semantics: "no scan yet" is UNKNOWN coverage, not "Secure".
    if (!state.latestDecision) {
        statusBarItem.text = `$(shield) SoterAI: Monitoring`;
        statusBarItem.tooltip = "Local scanning active. No scan has run yet — coverage unknown until content is scanned.";
        statusBarItem.backgroundColor = undefined;
        return;
    }
    const latestRisk = state.latestDecision.riskScore;
    if (latestRisk >= 70) {
        statusBarItem.text = `$(shield) SoterAI: Blocked (${latestRisk})`;
        statusBarItem.tooltip = `High-Risk Content Blocked. Score: ${latestRisk}/100.`;
        statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
    } else if (latestRisk >= 35) {
        statusBarItem.text = `$(shield) SoterAI: Warning (${latestRisk})`;
        statusBarItem.tooltip = `Risky content/patterns detected. Score: ${latestRisk}/100.`;
        statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    } else {
        statusBarItem.text = `$(shield) SoterAI: No Risk Found`;
        statusBarItem.tooltip = `Latest scan found no high-risk content (score ${latestRisk}/100). This reflects scanned content only, not unscanned paths.`;
        statusBarItem.backgroundColor = undefined;
    }
}

async function updateFirewallStatus(): Promise<void> {
    if (!firewallStatusItem) return;
    const state = ExtensionState.getInstance();
    const latestRisk = state.latestDecision ? state.latestDecision.riskScore : 0;
    if (!vscode.workspace.isTrusted) {
        firewallStatusItem.text = "$(lock) SoterAI: Restricted Mode";
        firewallStatusItem.tooltip = "Untrusted workspace — vault and cloud disabled.";
        firewallStatusItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
        return;
    }
    if (latestRisk >= 70) {
        firewallStatusItem.text = "$(alert) SoterAI: High Risk Context";
        firewallStatusItem.tooltip = "Latest context/scan is high risk.";
        firewallStatusItem.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
        return;
    }
    firewallStatusItem.backgroundColor = undefined;
    const approved = extensionContext ? await readContextApproval(extensionContext) : undefined;
    const hasPolicy = await PolicyStore.exists().catch(() => false);
    if (approved) {
        firewallStatusItem.text = "$(unlock) SoterAI: Context Approved";
        firewallStatusItem.tooltip = "A sensitive AI-context approval session is active.";
    } else if (hasPolicy) {
        firewallStatusItem.text = "$(shield) SoterAI: Protected Files Active";
        firewallStatusItem.tooltip = "AI Context Firewall policy is active.";
    } else {
        firewallStatusItem.text = "$(shield) SoterAI: Local Protected";
        firewallStatusItem.tooltip = "AI Context Firewall active (local-only).";
    }
}

export async function deactivate(): Promise<void> {
    TelemetryManager.getInstance().dispose();
    if (brokerManager) await brokerManager.stop();
}
