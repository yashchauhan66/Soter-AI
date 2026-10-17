import * as vscode from "vscode";
import * as path from "node:path";
import { lstatSync, realpathSync, readdirSync } from "node:fs";
import { isPathWithin } from "../../../core/src/pathContainment";
import { fileIdentity, samePath } from "../firewall/VaultStorage";
import { exportRootPolicy } from "../ai-boundary/BoundarySnapshot";
import { runtimePolicyBinding } from "../vault-runtime/RuntimeBinding";

export function managedPathIdentity(root: string, target: string, directory: boolean): string {
    if (!path.isAbsolute(root) || !path.isAbsolute(target) || !isPathWithin(root, target)
        || !samePath(root, realpathSync(root)) || !samePath(target, realpathSync(target))) throw new Error("Checked path unavailable.");
    let component = target;
    while (true) {
        if (lstatSync(component).isSymbolicLink()) throw new Error("Checked path unavailable.");
        const parent = path.dirname(component); if (parent === component) break; component = parent;
    }
    const stat = lstatSync(target);
    if (directory ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1 || stat.size > 65536) throw new Error("Checked path unavailable.");
    return directory ? JSON.stringify([process.platform === "win32" ? 0 : stat.dev, stat.ino, stat.birthtimeMs]) : fileIdentity(stat);
}
export function managedRootIdentity(root: vscode.Uri): string {
    if (!(root instanceof vscode.Uri) || root.scheme !== "file" || root.authority || root.query || root.fragment
        || !vscode.workspace.workspaceFolders?.some(folder => folder.uri.toString() === root.toString())
        || !vscode.workspace.isTrusted || vscode.env.remoteName) throw new Error("Checked workspace unavailable.");
    return managedPathIdentity(root.fsPath, root.fsPath, true);
}
export function managedPolicyBinding(root: vscode.Uri): string {
    return JSON.stringify([managedRootIdentity(root), runtimePolicyBinding(root.fsPath), exportRootPolicy(root.toString())]);
}
/** Empty means no current cipher AND no retained recovery, never a downgrade
 * from a captured encrypted vault. Missing directories are not created. */
export function managedEmptyStoreIdentity(directory: string): string {
    if (!path.isAbsolute(directory) || vscode.workspace.workspaceFolders?.some(folder => folder.uri.scheme === "file" && isPathWithin(folder.uri.fsPath, directory))) throw new Error("Checked storage unavailable.");
    let existing = directory;
    while (true) {
        try { lstatSync(existing); break; }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT" || path.dirname(existing) === existing) throw error; existing = path.dirname(existing); }
    }
    const identity = managedPathIdentity(existing, existing, true);
    if (existing === directory) {
        const names = readdirSync(directory);
        if (names.length > 8192 || names.some(name => /^soterai-vault\.enc$|^vault-|^write-.*\.enc$/i.test(name))) throw new Error("Checked storage unavailable.");
    }
    return JSON.stringify([existing, identity]);
}
