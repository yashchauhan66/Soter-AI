import * as vscode from "vscode";
import type { ContextItem, ContextKind } from "@soterai/guard-core";
import { BoundarySnapshot, setBoundaryProtectedChecker } from "../ai-boundary/BoundarySnapshot";
import { collectSafeDiffs } from "../ai-boundary/gitDiff";

const MAX_ITEM_BYTES = 64 * 1024; // don't stream huge files into a prompt bundle

/**
 * Optional protected-file checker (wired to WorkspaceGuard at activation).
 * When set, protected files are EXCLUDED from every SoterAI-built context
 * bundle — this is the enforced half of Protected Workspace Mode. Paths other
 * tools read directly remain monitoring-only.
 */
export function setProtectedFileChecker(checker: (relPath: string) => boolean): void {
    setBoundaryProtectedChecker(checker);
}

/** Context source config files an AI assistant commonly reads. */
const AGENT_CONFIG_FILES = [
    "README.md",
    "CLAUDE.md",
    ".cursorrules",
    ".github/copilot-instructions.md",
    ".mcp.json",
    ".vscode/mcp.json",
    ".cursor/mcp.json",
];

function kindForPath(rel: string): ContextKind {
    if (/(^|\/)(README|CLAUDE)\.md$/i.test(rel)) return "readme";
    if (/cursorrules|copilot-instructions/i.test(rel)) return "agent_config";
    if (/mcp\.json$/i.test(rel)) return "mcp_config";
    return "other";
}

async function readItem(boundary: BoundarySnapshot, uri: vscode.Uri, kind: ContextKind): Promise<ContextItem | undefined> {
    try {
        if (boundary.blocks(uri)) return undefined;
        const disk = await boundary.read(uri);
        const editor = vscode.window.activeTextEditor;
        const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString())
            ?? (editor?.document.uri.toString() === uri.toString() ? editor.document : undefined);
        const text = doc ? doc.getText() : disk;
        if (Buffer.byteLength(text, "utf8") > MAX_ITEM_BYTES) return undefined;
        return { path: vscode.workspace.asRelativePath(uri), kind, content: boundary.sanitize(uri, text), classification: boundary.classify(uri) };
    } catch {
        return undefined;
    }
}

/**
 * Gather the raw context a user is likely about to hand an AI assistant:
 * selection, active file, open tabs, git diff, and agent/MCP config files.
 * The RAW content is only used to build a SAFE bundle downstream — it is never
 * persisted by this gatherer.
 */
export async function gatherContext(): Promise<ContextItem[]> {
    const boundary = await BoundarySnapshot.load();
    const items: ContextItem[] = [];
    const seen = new Set<string>();
    const push = (item?: ContextItem) => {
        if (!item || seen.has(`${item.kind}:${item.path}`)) return;
        // Enforced exclusion: files on the Protected Workspace list never enter
        // a SoterAI-built context bundle.
        seen.add(`${item.kind}:${item.path}`);
        items.push(item);
    };

    const editor = vscode.window.activeTextEditor;
    const active = editor ? await readItem(boundary, editor.document.uri, "active_file") : undefined;

    // Selection (highest signal).
    if (editor && active && !editor.selection.isEmpty) {
        push({
            ...active, kind: "selection",
            content: boundary.selection(editor.document.uri, editor.document.getText(),
                editor.document.offsetAt(editor.selection.start), editor.document.offsetAt(editor.selection.end)),
        });
    }

    // Active file.
    push(active);

    // Open tabs.
    for (const group of vscode.window.tabGroups.all) {
        for (const tab of group.tabs) {
            const input = tab.input as { uri?: vscode.Uri } | undefined;
            if (input?.uri && input.uri.scheme === "file") {
                push(await readItem(boundary, input.uri, "open_tab"));
            }
        }
    }

    // Old revisions cannot safely reuse protected-region offsets.
    for (const item of await collectSafeDiffs(boundary)) push(item);
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
        for (const rel of AGENT_CONFIG_FILES) {
            const uri = vscode.Uri.joinPath(folder.uri, rel);
            push(await readItem(boundary, uri, kindForPath(rel)));
        }
    }

    return items;
}
