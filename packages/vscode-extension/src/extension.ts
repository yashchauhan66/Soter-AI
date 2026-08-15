import * as vscode from "vscode";
import { ExtensionState } from "./state";
import { registerCommands } from "./commands";
import { registerFirewallCommands, readContextApproval } from "./firewall/commands";
import { setProtectedFileChecker } from "./firewall/ContextGatherer";
import { registerScannerCommands } from "./firewall/scanners";
import { PolicyStore } from "./firewall/PolicyStore";
import { escapeHtml, showInfoWebview } from "./firewall/util";
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
import { registerContinuousGuardCommands } from "./scanners/continuousGuards";
import { registerSecretBrokerCommands } from "./secret-broker/commands";
import { ProtectionStateService } from "./protection/ProtectionStateService";
import { ProtectionController } from "./protection/ProtectionController";
import { registerEgressFirewallCommands } from "./advanced/commands";
import { runPackagedRuntimeProbe } from "./packagedRuntimeProbe";
// ── Secret Shield: strongest prevention layer (Task 1–5) ──────────────────────
import { SecretFileInterceptor } from "./secret-shield/SecretFileInterceptor";
import { AutoVaultMigration } from "./secret-shield/AutoVaultMigration";
import { FileReadSentinel } from "./secret-shield/FileReadSentinel";

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

// Status-bar updates involve two local HTTP calls to the broker. Throttle them
// so rapid tab switches (e.g. an AI agent opening many files) don't pile up
// concurrent HTTP requests. The throttle window is 2 seconds — fast enough
// for the user to see state changes, slow enough to not compete with agents.
let _statusBarTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleStatusBarUpdate(): void {
    if (_statusBarTimer) return; // already scheduled
    _statusBarTimer = setTimeout(() => {
        _statusBarTimer = undefined;
        void updateStatusBar();
    }, 2000);
}
let protectionController: ProtectionController;
let rawTerminalNoticeShown = false;
// Secret Shield instances — must outlive activate() so their disposables stay alive.
let secretFileInterceptor: SecretFileInterceptor;
let autoVaultMigration: AutoVaultMigration;
let fileReadSentinel: FileReadSentinel;

export function activate(context: vscode.ExtensionContext): void {
    extensionContext = context;

    // Command-palette hygiene: ~100 advanced commands are gated behind the
    // `soterai.advancedCommands` context key so the default palette only shows
    // 10 core commands. Every command still works from the SoterAI Guard
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

    fileReadSentinel = new FileReadSentinel(context);
    context.subscriptions.push(fileReadSentinel);

    autoVaultMigration = new AutoVaultMigration(context);
    context.subscriptions.push(autoVaultMigration);

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
    registerScannerCommands(context, async () => (await protectionState?.refresh())?.descriptor);
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
    const liveScanEnabled = vscode.workspace.getConfiguration("soterai").get<boolean>("liveScan.enabled", true);
    if (liveScanEnabled) registerLiveScanner(context);
    registerClipboardGuard(context);
    registerContinuousGuardCommands(context, {
        scanText: async (text) => ExtensionState.getInstance().engine.scan(text, { context: "selection" }),
    });
    registerSecretBrokerCommands(context, refreshViews);
    // Gap A + Gap B: outbound AI egress firewall (obfuscation-resistant), which
    // also appends every decision to the tamper-proof ledger.
    registerEgressFirewallCommands(context);

    // ── Secret Shield commands (need refreshViews, wired here) ────────────────
    // Document-open events are visibility only. VS Code exposes no caller-aware,
    // awaitable file-read interceptor; enforceable protection comes from explicit
    // encrypted vault migration or broker-routed egress.
    secretFileInterceptor = new SecretFileInterceptor(context, (uri, count) => {
        sentinel.recordEvent({
            type: "protected_access",
            risk: "high",
            source: "sentinel",
            filePath: vscode.workspace.asRelativePath(uri),
            decision: "alert",
            redactedEvidence:
                `Sensitive document "${vscode.workspace.asRelativePath(uri)}" opened with ` +
                `${count} plaintext secret(s); direct-read caller is not observable`,
        });
        refreshViews();
    });
    context.subscriptions.push(secretFileInterceptor);

    // AutoVaultMigration start — delayed scan fires after editor is ready.
    autoVaultMigration.start();

    context.subscriptions.push(
        vscode.commands.registerCommand("soterai.autoMigrateWorkspace", async () => {
            await autoVaultMigration.scanWorkspace({ silent: false });
            refreshViews();
        }),
        vscode.commands.registerCommand(
            "soterai.migrateCurrentFileToVault",
            async (uri?: vscode.Uri) => {
                const target = uri ?? vscode.window.activeTextEditor?.document.uri;
                if (!target) {
                    vscode.window.showErrorMessage(
                        "[SoterAI] No file to migrate — open a sensitive file first.",
                    );
                    return;
                }
                if (!vscode.workspace.isTrusted) {
                    vscode.window.showWarningMessage(
                        "[SoterAI] Vault migration requires a trusted workspace because it changes files and stores encrypted recovery data.",
                    );
                    return;
                }
                const preview = await autoVaultMigration.previewFile(target);
                if (preview.candidates.length === 0) {
                    vscode.window.showInformationMessage("[SoterAI] No migratable plaintext secrets found in this file.");
                    return;
                }
                const confirm = await vscode.window.showWarningMessage(
                    `Migrate ${preview.candidates.length} secret(s) from ${preview.file}? ` +
                    "Encrypted recovery data is written outside the workspace before placeholders replace plaintext on disk.",
                    { modal: true },
                    "Migrate & Backup",
                );
                if (confirm !== "Migrate & Backup") return;
                const count = await autoVaultMigration.migrateFile(target);
                if (count > 0) {
                    secretFileInterceptor.clearCache(target);
                    vscode.window.showInformationMessage(
                        `[SoterAI] ${count} secret(s) migrated to encrypted vault. ` +
                            `"${vscode.workspace.asRelativePath(target)}" now contains placeholders on disk — ` +
                            "all AI agents (including CLI tools) see only placeholders.",
                    );
                    refreshViews();
                }
            },
        ),
        vscode.commands.registerCommand("soterai.showFileReadLog", () => {
            const events = fileReadSentinel.getEvents();
            if (events.length === 0) {
                vscode.window.showInformationMessage(
                    "[SoterAI] No sensitive-document-open events recorded yet.",
                );
                return;
            }
            const rows = [...events]
                .reverse()
                .slice(0, 50)
                .map(
                    (e) =>
                        `<tr><td>${new Date(e.timestamp).toLocaleString()}</td>` +
                        `<td><strong>${escapeHtml(e.agentName)}</strong></td>` +
                        `<td><code>${escapeHtml(e.filePath)}</code></td>` +
                        `<td>${e.secretCount} secret(s)</td></tr>`,
                )
                .join("");
            showFileReadLogWebview(rows);
        }),
        vscode.commands.registerCommand("soterai.clearFileReadLog", () => {
            fileReadSentinel.clearEvents();
            vscode.window.showInformationMessage("[SoterAI] Sensitive-document-open log cleared.");
        }),
    );
    // ── End Secret Shield ──────────────────────────────────────────────────────

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
    // @ts-ignore — process is available in the VS Code extension host (Node runtime)
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
        vscode.window.onDidChangeActiveTextEditor(() => { scheduleStatusBarUpdate(); }),
        vscode.window.onDidOpenTerminal(() => { void warnRawTerminalCoverage(); }),
        vscode.workspace.onDidSaveTextDocument((doc) => {
            // Only scan files the user themselves saved — skip virtual/scheme docs.
            // The LiveScanner already handles as-you-type scanning with debounce,
            // so the save hook is intentionally lightweight: it does NOT fire a
            // second full scan here. That second scan was causing visible latency
            // for AI agents (Cline, Claude Code, OpenCode) that save files
            // programmatically in rapid succession.
            if (doc.uri.scheme !== "file") return;
            // Refresh views/status only — the live scanner handles diagnostics.
            void updateStatusBar();
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

// ── Secret Shield helpers ─────────────────────────────────────────────────────

function showFileReadLogWebview(rows: string): void {
    showInfoWebview(
        "soteraiFileReadLog",
        "SoterAI: Sensitive Document Open Log",
        `<h1>Sensitive Document Open Log</h1>
         <p>VS Code document-open events for sensitive files that still contained detected plaintext secrets.
            Migrate reviewed files to the vault to remove those values from disk.</p>
         <table>
           <tr><th>Time</th><th>Active AI context</th><th>File</th><th>Detected secrets</th></tr>
           ${rows || "<tr><td colspan='4'>No events recorded.</td></tr>"}
         </table>
         <p class="note">
           VS Code does not identify which extension caused an open. Active AI extensions
           are context only, never caller attribution. Direct filesystem reads by CLI tools
           are not visible here; vault migration protects the migrated on-disk content.
         </p>`,
    );
}
