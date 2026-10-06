import * as vscode from "vscode";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { type ContextItem } from "@soterai/guard-core";
import { BoundarySnapshot } from "./BoundarySnapshot";
import { relativePath } from "./policy";

const runGit = promisify(execFile);
const LIMIT = 64 * 1024;

/** Literal pathspecs, no external diff/textconv, and no untrusted-workspace execution. */
export async function collectSafeDiffs(boundary: BoundarySnapshot): Promise<ContextItem[]> {
    if (!vscode.workspace.isTrusted) return [];
    const items = new Map<string, ContextItem>();
    let bytes = 0;
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
        if (folder.uri.scheme !== "file") continue;
        const git = (args: string[]) => runGit("git", ["--literal-pathspecs", ...args], {
            cwd: folder.uri.fsPath, windowsHide: true, timeout: 5000, maxBuffer: LIMIT,
        });
        for (const stage of [[], ["--cached"]]) {
            const base = ["diff", "--relative", "--no-ext-diff", "--no-textconv", ...stage];
            try {
                const { stdout } = await git([...base, "--name-status", "-z", "--find-renames", "--"]);
                const fields = stdout.split("\0");
                if (fields.at(-1) === "") fields.pop();
                if (fields.length > 300) continue;
                for (let i = 0; i < fields.length;) {
                    const status = fields[i++];
                    if (!/^[ACDMRTUXB][0-9]*$/.test(status)) break;
                    const count = /^[RC]/.test(status) ? 2 : 1;
                    const names = fields.slice(i, i + count);
                    i += names.length;
                    if (names.length !== count || names.some(name => !name)) break;
                    const uris = names.map(name => {
                        relativePath(name);
                        return vscode.Uri.joinPath(folder.uri, name);
                    });
                    if (uris.some(uri => boundary.blocks(uri) || boundary.hasRegions(uri))) continue;
                    // Deleted, alias and oversized sources also fail closed.
                    try { for (const uri of uris) await boundary.read(uri); } catch { continue; }
                    const { stdout: diff } = await git([...base, "--no-renames", "--", ...names]);
                    if (!diff.trim()) continue;
                    bytes += Buffer.byteLength(diff, "utf8");
                    if (bytes > LIMIT) return [...items.values()];
                    const uri = uris[uris.length - 1];
                    const key = uri.toString();
                    const previous = items.get(key);
                    items.set(key, {
                        path: vscode.workspace.asRelativePath(uri), kind: "git_diff",
                        content: previous ? previous.content + "\n" + diff : diff,
                        classification: boundary.classify(uri),
                    });
                }
            } catch { /* Failed or ambiguous git output is never shared. */ }
        }
    }
    return [...items.values()];
}
