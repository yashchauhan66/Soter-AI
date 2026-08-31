/**
 * What the agent surfaces actually managed to register on THIS host.
 *
 * Needed because "SoterAI contributes language model tools" is only true on a
 * host that implements the API. On VS Code 1.85 — still inside the supported
 * `^1.85.0` range, and the version Cursor/Windsurf/Kiro track — the count is
 * zero, and a UI that claims agent coverage there would be lying about the one
 * thing this product sells.
 *
 * Deliberately a tiny module with no `vscode` import: it is read by the runtime
 * capability summary, written once during activation, and unit-testable.
 *
 * No new command was added to report this. The palette already has 162 commands
 * and collapsing the duplicates is a separate gap; until that lands, this belongs
 * in the existing `soterai.showRuntimeCapabilitySummary` report rather than in a
 * 163rd entry.
 */

export interface AgentSurfaceStatus {
    /** How many language model tools registered. 0 on hosts without the API. */
    languageModelTools: number;
    /** Whether the MCP server definition provider registered. */
    mcpProviderRegistered: boolean;
    /** Whether the host implements `vscode.lm.registerTool` at all. */
    hostSupportsTools: boolean;
}

let status: AgentSurfaceStatus = {
    languageModelTools: 0,
    mcpProviderRegistered: false,
    hostSupportsTools: false,
};

export function setAgentSurfaceStatus(next: AgentSurfaceStatus): void {
    status = next;
}

export function agentSurfaceStatus(): AgentSurfaceStatus {
    return status;
}

/**
 * One honest sentence for the runtime capability report.
 *
 * Names the host limitation when there is one, because "0 tools registered" on
 * its own reads as a bug rather than as an older editor.
 */
export function describeAgentSurfaces(): string {
    if (!status.hostSupportsTools) {
        return (
            "Agent tools: NOT AVAILABLE on this host. This editor does not implement " +
            "vscode.lm.registerTool, so SoterAI cannot be called by an AI agent here. " +
            "Everything else works; SoterAI keeps its ^1.85.0 floor so Cursor, Windsurf, Kiro " +
            "and Antigravity stay supported rather than dropping them for this API."
        );
    }
    return (
        `Agent tools: ${status.languageModelTools} registered (ADVISORY). ` +
        `MCP server provider: ${status.mcpProviderRegistered ? "registered" : "not available on this host"}. ` +
        "An agent can ask SoterAI to check text, a shell command or a dependency. " +
        "SoterAI cannot force the agent to ask, and cannot block what an agent does without asking."
    );
}
