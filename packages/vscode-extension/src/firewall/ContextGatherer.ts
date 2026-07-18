import * as vscode from "vscode";
import { execFile } from "child_process";
import { promisify } from "util";
import type { ContextItem, ContextKind } from "@soterai/guard-core";
import { firstWorkspaceFolder } from "./util";

const execFileAsync = promisify(execFile);

const MAX_ITEM_BYTES = 64 * 1024; // don't stream huge files into a prompt bundle

/**
 * Optional protected-file checker (wired to WorkspaceGuard at activation).
 * When set, protected files are EXCLUDED from every SoterAI-built context
 * bundle — this is the enforced half of Protected Workspace Mode. Paths other
 * tools read directly remain monitoring-only.
 */
let isProtectedPath: ((relPath: string) => boolean) | undefined;
export function setProtectedFileChecker(checker: (relPath: string) => boolean): void {
    isProtectedPath = checker;
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

async function readItem(uri: vscode.Uri, kind: ContextKind): Promise<ContextItem | undefined> {
    try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        if (bytes.byteLength > MAX_ITEM_BYTES) return undefined;
        return { path: vscode.workspace.asRelativePath(uri), kind, content: new TextDecoder().decode(bytes) };
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
    const items: ContextItem[] = [];
    const seen = new Set<string>();
    const push = (item?: ContextItem) => {
        if (!item || seen.has(`${item.kind}:${item.path}`)) return;
        // Enforced exclusion: files on the Protected Workspace list never enter
        // a SoterAI-built context bundle.
        if (isProtectedPath?.(item.path)) return;
        seen.add(`${item.kind}:${item.path}`);
        items.push(item);
    };

    const editor = vscode.window.activeTextEditor;

    // Selection (highest signal).
    if (editor && !editor.selection.isEmpty) {
        push({
            path: vscode.workspace.asRelativePath(editor.document.uri),
            kind: "selection",
            content: editor.document.getText(editor.selection),
        });
    }

    // Active file.
    if (editor) {
        push({
            path: vscode.workspace.asRelativePath(editor.document.uri),
            kind: "active_file",
            content: editor.document.getText().slice(0, MAX_ITEM_BYTES),
        });
    }

    // Open tabs.
    for (const group of vscode.window.tabGroups.all) {
        for (const tab of group.tabs) {
            const input = tab.input as { uri?: vscode.Uri } | undefined;
            if (input?.uri && input.uri.scheme === "file") {
                push(await readItem(input.uri, "open_tab"));
            }
        }
    }

    // Git diff (staged + unstaged), as a synthetic item.
    const folder = firstWorkspaceFolder();
    if (folder) {
        try {
            // Safe child process boundary: execFile invokes git directly with
            // fixed arguments. No shell, command interpolation, or persistence
            // of raw diff content is used here.
            const [{ stdout: unstaged }, { stdout: staged }] = await Promise.all([
                execFileAsync("git", ["diff"], { cwd: folder.uri.fsPath, maxBuffer: 8 * 1024 * 1024 }),
                execFileAsync("git", ["diff", "--staged"], { cwd: folder.uri.fsPath, maxBuffer: 8 * 1024 * 1024 }),
            ]);
            const diff = `${staged}\n${unstaged}`.trim();
            if (diff) push({ path: "git diff", kind: "git_diff", content: diff.slice(0, MAX_ITEM_BYTES) });
        } catch {
            /* not a git repo — skip */
        }

        // Agent/MCP config files.
        for (const rel of AGENT_CONFIG_FILES) {
            const uri = vscode.Uri.joinPath(folder.uri, rel);
            push(await readItem(uri, kindForPath(rel)));
        }
    }

    return items;
}
