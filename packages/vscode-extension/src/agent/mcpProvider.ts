/**
 * GAP 2 — offering the SoterAI MCP server to VS Code's own MCP client.
 *
 * `mcpServer.ts` is the server. This tells VS Code the server exists, so a user
 * gets SoterAI's checks in agent mode without hand-editing an `mcp.json`. It is
 * the difference between a capability that ships and one the user has to find.
 *
 * Version-gated for the same reason as the language model tools: the API is far
 * newer than the `^1.85.0` floor, so it is feature-detected and silently skipped
 * on older hosts. See `languageModelTools.ts` for why the floor does not move.
 */
import * as vscode from "vscode";

import { supportsMcpServerDefinitions } from "./languageModelTools";
// Re-exported from the pure server module so the ids are assertable without
// loading `vscode`, and so the manifest, the provider and the server can never
// disagree about them.
import { MCP_PROVIDER_ID, MCP_SERVER_RELATIVE_PATH } from "./mcpServer";
import { SafeReadBridge } from "./SafeReadBridge";
import type { ProjectReaderBridge } from "../project-privacy/commands";
import { safeReadPath } from "./SafeReadProtocol";

export { MCP_PROVIDER_ID, MCP_SERVER_RELATIVE_PATH };

/**
 * Register the provider, reporting whether it happened.
 *
 * The server runs on `process.execPath` — the editor's own Node — rather than a
 * `node` from PATH. A machine can have no `node` installed, or an ancient one,
 * and "SoterAI's MCP server silently never starts" is indistinguishable to the
 * user from "SoterAI does not work".
 */
export function safeReadMcpEnabled(): boolean {
    try {
        const config = vscode.workspace.getConfiguration("soterai"), inspected = config.inspect<boolean>("lite.safeReadMcp");
        return (inspected ? inspected.globalValue ?? inspected.defaultValue ?? true : config.get("lite.safeReadMcp", true)) === true;
    } catch { return false; }
}
export function registerMcpServerProvider(context: vscode.ExtensionContext, reader?: ProjectReaderBridge): boolean {
    if (!supportsMcpServerDefinitions()) return false;

    const serverPath = vscode.Uri.joinPath(context.extensionUri, ...MCP_SERVER_RELATIVE_PATH.split("/")).fsPath;
    const enabled = () => safeReadMcpEnabled() && vscode.workspace.isTrusted === true && reader?.isEnabled() === true
        && vscode.workspace.workspaceFolders?.length === 1 && vscode.workspace.workspaceFolders[0].uri.scheme === "file";
    const bridge = new SafeReadBridge({ enabled, read: async (file, recipient, signal) => {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!enabled() || !root || !reader || safeReadPath({ path: file }) !== file) return { status: "UNAVAILABLE" };
        return reader.readIntegration(vscode.Uri.joinPath(root, file), recipient, signal);
    } });
    const changed = new vscode.EventEmitter<void>();
    const invalidate = () => { bridge.rotate(); changed.fire(); };

    try {
        context.subscriptions.push(
            { dispose: () => { void bridge.dispose(); changed.dispose(); } },
            vscode.workspace.onDidChangeWorkspaceFolders(invalidate),
            vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration("soterai")) invalidate(); }),
            vscode.lm.registerMcpServerDefinitionProvider(MCP_PROVIDER_ID, {
                onDidChangeMcpServerDefinitions: changed.event,
                provideMcpServerDefinitions: async () => {
                    let environment: Record<string, string> = { ELECTRON_RUN_AS_NODE: "1" };
                    if (reader) {
                        if (!enabled()) return [];
                        try {
                            const session = await bridge.start();
                            environment = { ...environment, SOTERAI_SAFE_READ_ENDPOINT: session.endpoint, SOTERAI_SAFE_READ_TOKEN: session.token, SOTERAI_SAFE_READ_SESSION: session.session };
                        } catch { return []; }
                    }
                    return [
                    new vscode.McpStdioServerDefinition(
                        "SoterAI Guard",
                        process.execPath,
                        [serverPath],
                        // ELECTRON_RUN_AS_NODE makes the editor's Electron binary
                        // behave as plain Node. Without it, `process.execPath`
                        // starts a second editor window instead of the server —
                        // and the failure looks like a hanging MCP handshake, not
                        // a missing variable.
                        environment,
                        // Version string: VS Code prompts to refresh tools when
                        // this changes, so it must track the extension version.
                        context.extension.packageJSON.version as string,
                    ),
                    ];
                },
            }),
        );
        return true;
    } catch {
        void bridge.dispose(); changed.dispose();
        // The provider id must match the manifest; a mismatch throws here rather
        // than degrading. Either way the language model tools still work, so this
        // is not worth interrupting the user for.
        return false;
    }
}
