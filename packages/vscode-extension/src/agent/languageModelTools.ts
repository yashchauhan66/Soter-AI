/**
 * GAP 2 — registering SoterAI's tools with VS Code's language model API.
 *
 * This is the thin adapter. Every verdict comes from `toolLogic.ts`; nothing
 * here decides anything, so the agent path and the human path cannot drift.
 *
 * VERSION GATING IS THE WHOLE POINT OF THIS FILE.
 *
 * `engines.vscode` is `^1.85.0` and `vscode.lm.registerTool` did not exist until
 * 1.90. `mcpServerDefinitionProviders` is newer still. Raising the engine floor
 * would drop Cursor, Windsurf, Kiro and Antigravity — the hosts the Open VSX
 * plan depends on — so the floor stays and both APIs are feature-detected at
 * runtime. On a 1.85 host this module registers nothing, logs nothing, and
 * throws nothing; on a modern host the tools appear. `@types/vscode` is 1.125.0,
 * so these symbols typecheck while being absent at runtime, which is exactly the
 * shape that makes an unguarded call ship as a crash on the oldest supported
 * host — the one nobody runs by hand.
 */
import * as vscode from "vscode";

import { AGENT_TOOLS, type AgentToolResult } from "./toolLogic";

/** True when this host implements `vscode.lm.registerTool`. */
export function supportsLanguageModelTools(): boolean {
    return typeof (vscode as { lm?: { registerTool?: unknown } }).lm?.registerTool === "function";
}

/** True when this host implements `vscode.lm.registerMcpServerDefinitionProvider`. */
export function supportsMcpServerDefinitions(): boolean {
    return (
        typeof (vscode as { lm?: { registerMcpServerDefinitionProvider?: unknown } }).lm
            ?.registerMcpServerDefinitionProvider === "function"
    );
}

/**
 * Render a result for a language model.
 *
 * JSON rather than prose: the consumer is a model that will act on it, and a
 * stable shape is easier to reason about than a sentence. `summary` carries the
 * human-readable line for when the model relays it to the user.
 */
function asToolResult(result: AgentToolResult): vscode.LanguageModelToolResult {
    return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify(result, null, 2)),
    ]);
}

/**
 * Register all three tools, or nothing at all.
 *
 * Returns the number registered so the caller can report it honestly instead of
 * claiming agent coverage on a host that has none.
 */
export function registerAgentTools(context: vscode.ExtensionContext): number {
    if (!supportsLanguageModelTools()) return 0;

    let registered = 0;
    for (const tool of AGENT_TOOLS) {
        try {
            context.subscriptions.push(
                vscode.lm.registerTool(tool.name, {
                    invoke: (options) => asToolResult(tool.run(options.input)),
                    // No confirmationMessages: all three tools are read-only
                    // evaluations of text the agent already has. Demanding a
                    // click before a *safety check* would train users to skip
                    // the check, which is the opposite of the point. The
                    // invocation message keeps it visible in the chat UI.
                    prepareInvocation: () => ({
                        invocationMessage: `SoterAI: running ${tool.name.replace(/^soterai_/, "").replace(/_/g, " ")}`,
                    }),
                }),
            );
            registered++;
        } catch {
            // A host can contribute the API and still refuse a specific name
            // (duplicate id, manifest mismatch). One tool failing must not cost
            // the other two, and none of it is worth interrupting the user for.
        }
    }
    return registered;
}
