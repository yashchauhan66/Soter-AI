import * as vscode from "vscode";
import { ExtensionState } from "./state";
import { registerCommands } from "./commands";
import { registerFirewallCommands, readContextApproval } from "./firewall/commands";
import { setProtectedFileChecker } from "./firewall/ContextGatherer";
import { registerScannerCommands } from "./firewall/scanners";
import { PolicyStore } from "./firewall/PolicyStore";
import { RiskTreeProvider } from "./views/RiskTreeProvider";
import { DashboardPanel } from "./webview/DashboardPanel";
import { ControlPanelViewProvider } from "./webview/ControlPanelViewProvider";
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
import { ProtectionStateService } from "./protection/ProtectionStateService";
import { ProtectionController } from "./protection/ProtectionController";
import { runPackagedRuntimeProbe } from "./packagedRuntimeProbe";

// Single consolidated status-bar item. It replaces the earlier six separate
// items (main, firewall, broker, safe mode, memory, runtime) — those states now
// live in one honest summary tooltip, and clicking opens the Control Panel.
let statusBarItem: vscode.StatusBarItem;
let sentinel: AISentinel;
let permissionStore: PermissionStore;
let workspaceGuard: WorkspaceGuard;
let mcpFirewall: MCPFirewall;
let memoryGuard: MemoryGuard;
let extensionContext: vscode.ExtensionContext;
let brokerManager: BrokerManager;
let protectionState: ProtectionStateService;
let protectionController: ProtectionController;
let rawTerminalNoticeShown = false;

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
    protectionState = new ProtectionStateService(context, { brokerManager, workspaceGuard, sentinel });
    protectionController = new ProtectionController(context, { brokerManager, workspaceGuard, sentinel, protectionState, refreshViews: () => refreshViews() });

    context.subscriptions.push(sentinel, permissionStore, workspaceGuard);

    const projectRiskProvider = new RiskTreeProvider("soterai-project-risk");
    const latestFindingsProvider = new RiskTreeProvider("soterai-latest-findings");
    const policyStatusProvider = new RiskTreeProvider("soterai-policy-status");

    // Consolidated Control Panel — single sidebar surface for every protection
    // toggle (Safe Mode, Protected Workspace, Live Scan, Sentinel, MCP Firewall)
    // plus Emergency Lockdown, with honest per-control coverage badges.
    const controlPanelProvider = new ControlPanelViewProvider(context, {
        workspaceGuard,
        sentinel,
        brokerManager,
        protectionState,
        refreshViews: () => refreshViews(),
    });
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ControlPanelViewProvider.viewType, controlPanelProvider),
    );

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
        controlPanelProvider.refresh();
        void updateStatusBar();
    };

    registerCommands(context, refreshViews);
    registerFirewallCommands(context, refreshViews);
    registerScannerCommands(context);
    registerBrokerCommands(context, brokerManager, refreshViews);
    registerSentinelCommands(context, sentinel);
    registerPermissionCommands(context, permissionStore);
    registerWorkspaceGuardCommands(context, workspaceGuard);
    // Phase 8: pass brokerManager so soterai.preflightMCPTool can hit POST /v1/preflight/mcp-tool.
    registerMCPFirewallCommands(context, mcpFirewall, brokerManager);
    registerMemoryGuardCommands(context, memoryGuard);
    registerDepGuardCommands(context);
    registerPolicyPackCommands(context, refreshViews);
    registerDashboardCommands(context, refreshViews);
    registerLaunchCommands(context);
    registerLiveScanner(context);
    registerClipboardGuard(context);
    registerSecretBrokerCommands(context, refreshViews);

    context.subscriptions.push(
        vscode.commands.registerCommand("soterai.enableFullProtection", async () => {
            try {
                const result = await protectionController.enableFullProtection();
                const limitationText = result.limitations.map((item) => `• ${item}`).join("\n");
                vscode.window.showInformationMessage(`Full Protection configured: ${result.completed.length} steps verified. Coverage remains ${result.snapshot.descriptor.state}.`, "View Coverage").then((choice) => {
                    if (choice === "View Coverage") void vscode.commands.executeCommand("soterai.showCoverageMatrix");
                });
                if (limitationText) void vscode.window.showWarningMessage(`Full Protection limitations (not universal):\n${limitationText}`);
            } catch (error) {
                vscode.window.showErrorMessage(`Full Protection was not completed: ${error instanceof Error ? error.message : "unknown error"}`);
            }
        }),
        vscode.commands.registerCommand("soterai.unlockProtection", async () => {
            const confirm = await vscode.window.showWarningMessage("Unlock SoterAI protection after Emergency Lockdown? Verify the incident is contained first.", { modal: true }, "Unlock");
            if (confirm === "Unlock") await protectionController.unlock();
        }),
    );

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    // One click → the consolidated Control Panel, where every toggle lives.
    statusBarItem.command = "soterai.openControlPanel";
    context.subscriptions.push(statusBarItem);
    updateStatusBar();
    statusBarItem.show();
    void updateBrokerStatus();
    // Dormant in normal installs; proves the packaged VSIX from inside an
    // actual VS Code-family extension host when the runtime harness opts in.
    if (process.env.SOTERAI_PACKAGED_RUNTIME_PROBE) {
        void runPackagedRuntimeProbe(brokerManager, protectionController);
    }

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
        vscode.window.onDidOpenTerminal(() => { void warnRawTerminalCoverage(); }),
        vscode.workspace.onDidSaveTextDocument(async (doc) => {
            const config = vscode.workspace.getConfiguration("soterai");
            const liveScanEnabled = config.get<boolean>("liveScan.enabled", true);
            if (liveScanEnabled && doc.uri.scheme === "file") await vscode.commands.executeCommand("soterai.scanCurrentFile", doc.uri);
        })
    );

    if (workspaceGuard.isEnabled) workspaceGuard.enable();
}

async function updateBrokerStatus(): Promise<void> {
    // Broker/safe-mode/memory/runtime state is now folded into the single
    // consolidated status-bar tooltip built by updateStatusBar().
    await updateStatusBar();
}

async function warnRawTerminalCoverage(): Promise<void> {
    if (rawTerminalNoticeShown) return;
    const config = vscode.workspace.getConfiguration("soterai");
    if (!config.get<boolean>("terminal.warnOnRawTerminalOpen", true)) return;
    rawTerminalNoticeShown = true;
    const choice = await vscode.window.showWarningMessage(
        "Raw VS Code terminals are outside SoterAI broker enforcement. Use Controlled Terminal for fixed-argv policy checks and redacted output.",
        "Use Controlled Terminal",
        "Runtime Summary",
        "Don't Show Again",
    );
    if (choice === "Use Controlled Terminal") await vscode.commands.executeCommand("soterai.runControlledTerminalCommand");
    if (choice === "Runtime Summary") await vscode.commands.executeCommand("soterai.showRuntimeCapabilitySummary");
    if (choice === "Don't Show Again") {
        await config.update("terminal.warnOnRawTerminalOpen", false, vscode.ConfigurationTarget.Global);
    }
}

async function updateStatusBar(): Promise<void> {
    if (!statusBarItem) return;
    const state = ExtensionState.getInstance();
    const trusted = vscode.workspace.isTrusted;
    const latestRisk = state.latestDecision ? state.latestDecision.riskScore : undefined;

    const protection = protectionState ? await protectionState.refresh() : undefined;
    const protectionTitle = protection?.descriptor.title ?? "Protection state unavailable";
    const text = `$(shield) SoterAI: ${protectionTitle}`;
    const background = protection?.descriptor.severity === "error" || protection?.descriptor.severity === "critical"
        ? new vscode.ThemeColor("statusBarItem.errorBackground")
        : protection?.descriptor.severity === "warning"
            ? new vscode.ThemeColor("statusBarItem.warningBackground")
            : undefined;

    // ── gather sub-states for the consolidated tooltip (no secrets) ──────────
    let brokerRunning = false;
    let safeMode: { enabled?: boolean; level?: string } | undefined;
    let memoryActive = false;
    try {
        if (brokerManager) {
            const status = await brokerManager.status();
            brokerRunning = Boolean(status.running);
            safeMode = status.safeMode;
            memoryActive = Boolean(brokerManager.memorySessionId);
        }
    } catch { /* broker optional / stopped */ }
    const hasPolicy = await PolicyStore.exists().catch(() => false);
    const approved = extensionContext ? await readContextApproval(extensionContext).catch(() => undefined) : undefined;

    const line = (label: string, value: string) => `${label}: ${value}`;
    const tip = new vscode.MarkdownString(
        [
            "**SoterAI IDE Guard**",
            "",
            line("Protection", protection ? `${protection.descriptor.state} — ${protection.descriptor.explanation}` : "state unavailable"),
            line("Coverage", protection?.descriptor.coverage ?? "unknown"),
            line("Recommended action", protection?.descriptor.recommendedAction ?? "Open the Control Panel"),
            line("Latest scan", latestRisk === undefined ? "none yet — coverage UNKNOWN until content is scanned" : `score ${latestRisk}/100 (scanned content only)`),
            line("Workspace", trusted ? "Trusted" : "Restricted (vault & cloud disabled)"),
            line("AI Context Firewall", approved ? "context approval session active" : hasPolicy ? "policy active" : "local-only"),
            line("Local broker", brokerRunning ? "running — enforced path available for routed traffic" : "stopped — advisory only"),
            line("AI Safe Mode", safeMode?.enabled ? `on${safeMode.level ? ` (${safeMode.level})` : ""}${brokerRunning ? "" : " — not enforced while broker stopped"}` : "off"),
            line("AI Memory", memoryActive ? "active" : "idle"),
            "",
            "$(list-selection) Click to open the SoterAI Control Panel.",
        ].join("\n\n"),
    );
    tip.isTrusted = true;
    tip.supportThemeIcons = true;

    statusBarItem.text = text;
    statusBarItem.tooltip = tip;
    statusBarItem.backgroundColor = background;
}

export async function deactivate(): Promise<void> {
    TelemetryManager.getInstance().dispose();
    if (brokerManager) await brokerManager.stop();
}
