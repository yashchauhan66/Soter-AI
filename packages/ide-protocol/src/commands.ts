/**
 * Canonical cross-IDE command identifiers and feature flags.
 *
 * Every IDE adapter (VS Code, JetBrains, Neovim, Vim, Sublime, Visual Studio,
 * Eclipse, JupyterLab) exposes the same logical features under host-native UI.
 * These identifiers keep telemetry, docs, and the feature-parity matrix aligned.
 * They are UI/contract identifiers only — no detector logic lives here.
 */

/** Stable feature keys shared across all adapters and the parity matrix. */
export const GuardFeature = {
    ScanSelection: "scanSelection",
    RedactSelection: "redactSelection",
    ScanCurrentFile: "scanCurrentFile",
    ScanWorkspaceRisk: "scanWorkspaceRisk",
    ScanGitChanges: "scanGitChanges",
    TerminalCommandChecker: "terminalCommandChecker",
    SafePromptBuilder: "safePromptBuilder",
    ContextInspector: "contextInspector",
    SafeMode: "safeMode",
    MemoryInspector: "memoryInspector",
    BrokerStatus: "brokerStatus",
    McpScanner: "mcpScanner",
    ExtensionRiskScanner: "extensionRiskScanner",
    WhatAiSawLedger: "whatAiSawLedger",
    CanaryLeakDetection: "canaryLeakDetection",
    SecretVault: "secretVault",
    OutputLeakMonitor: "outputLeakMonitor",
    PolicyConfig: "policyConfig",
    ReportExport: "reportExport",
    CloudConnect: "cloudConnect",
    ApprovalWorkflow: "approvalWorkflow",
} as const;

export type GuardFeatureKey = (typeof GuardFeature)[keyof typeof GuardFeature];

/**
 * Namespaced command ids. Native hosts may map these to their own command
 * systems (VS Code `contributes.commands`, JetBrains actions, Neovim user
 * commands, etc.), but the id keeps a single source of truth.
 */
export const GuardCommand = {
    ScanSelection: "soterai.scanSelection",
    RedactSelection: "soterai.redactSelection",
    ScanCurrentFile: "soterai.scanCurrentFile",
    ScanWorkspaceRisk: "soterai.scanWorkspaceRisk",
    ScanGitChanges: "soterai.scanGitChanges",
    CheckTerminalCommand: "soterai.checkTerminalCommand",
    BuildSafePrompt: "soterai.buildSafePrompt",
    InspectContext: "soterai.inspectContext",
    SafeModeEnable: "soterai.safeMode.enable",
    SafeModeDisable: "soterai.safeMode.disable",
    SafeModeStatus: "soterai.safeMode.status",
    OpenMemoryInspector: "soterai.memory.open",
    BrokerStatus: "soterai.broker.status",
    ScanMcpConfig: "soterai.mcp.scan",
    ScanExtensionRisk: "soterai.extensions.scan",
    OpenLedger: "soterai.ledger.open",
    ExportReport: "soterai.report.export",
    OpenPolicy: "soterai.policy.open",
} as const;

export type GuardCommandId = (typeof GuardCommand)[keyof typeof GuardCommand];

/**
 * Feature support level a given adapter declares for the parity matrix.
 * Mirrors docs/cross-ide-feature-parity-matrix.md legend.
 */
export type FeatureSupport =
    | "supported"
    | "partial"
    | "needs-broker"
    | "needs-future-agent"
    | "not-possible";

/** A declared capability for one adapter — feeds honest capability reporting. */
export interface AdapterCapability {
    feature: GuardFeatureKey;
    support: FeatureSupport;
    /** Short honest note, e.g. "blocking curl call" or "requires host agent". */
    note?: string;
}

/** Every feature routes through the broker unless a host can do it purely locally. */
export const BROKER_BACKED_FEATURES: readonly GuardFeatureKey[] = [
    GuardFeature.ScanSelection,
    GuardFeature.RedactSelection,
    GuardFeature.ScanCurrentFile,
    GuardFeature.ScanWorkspaceRisk,
    GuardFeature.ScanGitChanges,
    GuardFeature.TerminalCommandChecker,
    GuardFeature.SafePromptBuilder,
    GuardFeature.SafeMode,
    GuardFeature.MemoryInspector,
    GuardFeature.WhatAiSawLedger,
    GuardFeature.CanaryLeakDetection,
    GuardFeature.OutputLeakMonitor,
] as const;
