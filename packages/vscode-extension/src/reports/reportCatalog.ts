/**
 * GAP 5 — one door to every report.
 *
 * The palette carried eighteen `show*` commands plus a spread of `export*` and
 * `open*` rows. That is a surface a user has to already understand: they must
 * know which report exists before they can look at anything, and the titles read
 * as internal module names ("Show Runtime Capability Summary") rather than as
 * questions a person actually has.
 *
 * Every command below stays registered — automation, keybindings and other
 * extensions may call them — and every one is hidden from the palette so the
 * palette offers a single "Open Report" row instead.
 *
 * PURE BY CONTRACT: no `vscode` import, so the catalogue can be asserted against
 * the manifest without an extension host. Labels are phrased as what the user
 * gets, and the jargon rules that apply to the Control Panel apply here too.
 */

export interface ReportPick {
    /** The user's words for what this report answers. Never "Show X". */
    label: string;
    /** One line, so the choice can be made from the quick pick alone. */
    description: string;
    /** The command that still does the work. Must exist in the manifest. */
    command: string;
}

/**
 * Ordered by how often a real user needs the answer, not alphabetically and not
 * by the module that produces it.
 */
export const REPORT_PICKS: ReportPick[] = [
    {
        label: "What is protected right now",
        description: "Which AI routes SoterAI covers, and which it cannot.",
        command: "soterai.showCoverageMatrix",
    },
    {
        label: "What AI has seen",
        description: "Redacted record of the context SoterAI built for AI tools.",
        command: "soterai.showWhatAISaw",
    },
    {
        label: "What AI saw last session",
        description: "The same record, limited to the previous editor session.",
        command: "soterai.showWhatAISawLastSession",
    },
    {
        label: "AI activity timeline",
        description: "What AI tools did in this project, in order.",
        command: "soterai.showAITimeline",
    },
    {
        label: "Files an AI agent read",
        description: "Sensitive files opened while SoterAI was watching.",
        command: "soterai.showFileReadLog",
    },
    {
        label: "Context SoterAI refused to send",
        description: "Content that was blocked before it reached an AI tool.",
        command: "soterai.showBlockedAIContext",
    },
    {
        label: "Files kept out of AI",
        description: "Your protected list, as SoterAI applies it.",
        command: "soterai.showProtectedFiles",
    },
    {
        label: "Risk score for this project",
        description: "Findings from the last workspace scan, with what was skipped.",
        command: "soterai.showWorkspaceRiskScore",
    },
    {
        label: "AI extensions installed here",
        description: "Which ones SoterAI can route, and which it cannot.",
        command: "soterai.showAIExtensions",
    },
    {
        label: "Agent tool permissions",
        description: "What each configured agent tool is allowed to do.",
        command: "soterai.showMCPToolPermissions",
    },
    {
        label: "Approvals currently active",
        description: "Access you granted that has not expired yet.",
        command: "soterai.showActiveAIApprovals",
    },
    {
        label: "Local checking service status",
        description: "Whether the local broker is running, and what it covers.",
        command: "soterai.showBrokerStatus",
    },
    {
        label: "What this editor supports",
        description: "Which SoterAI surfaces are live on the editor you are using.",
        command: "soterai.showRuntimeCapabilitySummary",
    },
    {
        label: "Blocking rules in effect",
        description: "The rules AI Safe Mode is applying right now.",
        command: "soterai.showAISafeModeRules",
    },
    {
        label: "Outbound AI destinations",
        description: "Where SoterAI-routed traffic is allowed to go.",
        command: "soterai.showEgressFirewallStatus",
    },
    {
        label: "Poisoned AI memory findings",
        description: "Instructions found hidden in AI memory or rules files.",
        command: "soterai.showMemoryPoisoningFindings",
    },
    {
        label: "Extension isolation summary",
        description: "What other extensions can reach, and what SoterAI cannot stop.",
        command: "soterai.showExtensionIsolationSummary",
    },
    {
        label: "Check no canary value leaked",
        description: "Verifies SoterAI's own logs and reports hold no planted secret.",
        command: "soterai.verifyNoCanaryInLogs",
    },
];
