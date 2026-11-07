import * as path from "node:path";
import { lstat, realpath } from "node:fs/promises";

/** Conservative explicit-publication exclusions, not universal private-text detection. */
const NEVER_PUBLISH = /(?:^|\/)(?:\.git|\.soterai|\.codex|\.claude|\.cline|\.ssh|\.aws|\.azure|\.gnupg|\.docker|\.kube|node_modules|\.vscode|\.history)(?:\/|$)|(?:^|\/)(?:\.aiignore|\.soterai-policy\.json|\.npmrc|\.yarnrc|\.netrc|\.gitconfig|\.git-credentials|\.bash_history|\.zsh_history|\.python_history|\.pgpass|\.pypirc|auth-token|control-auth-token|credentials|credentials\.json|soterai-publication-manifest\.json|soterai-development-contract\.json|soterai-fixtures\.json)$/i;

export function publicationRelativePath(value: string): string {
    if (!value || value.length > 512 || /[\x00-\x1f\x7f]/.test(value)
        || value.includes("\\") || value.includes(":") || value.startsWith("/")) throw new Error("Invalid publication path.");
    const parts = value.split("/");
    if (parts.some(part => !part || part === "." || part === ".." || /[ .]$/.test(part)
        || /[<>"|?*]/.test(part) || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part))) {
        throw new Error("Unsupported publication path.");
    }
    if (NEVER_PUBLISH.test(value)) throw new Error("History, policy and credential paths cannot be published.");
    return value;
}

function comparable(value: string): string {
    const normal = path.normalize(value);
    return process.platform === "win32" ? normal.toLowerCase() : normal;
}
export function pathContains(parent: string, target: string): boolean {
    const rel = path.relative(comparable(path.resolve(parent)), comparable(path.resolve(target)));
    return rel === "" || (rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}

/** Reject links/junctions and noncanonical aliases throughout an existing directory chain. */
export async function canonicalDirectory(directory: string): Promise<string> {
    const absolute = path.resolve(directory);
    const root = path.parse(absolute).root;
    let current = root;
    for (const part of absolute.slice(root.length).split(path.sep).filter(Boolean)) {
        current = path.join(current, part);
        const entry = await lstat(current);
        if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error("Linked or non-directory publication path.");
        const resolved = await realpath(current);
        // Drive-letter spelling alone is not an alias. Directory spelling differences are rejected.
        const driveCase = (value: string) => process.platform === "win32"
            ? path.normalize(value).replace(/^[a-z]:/i, drive => drive.toUpperCase()) : path.normalize(value);
        if (driveCase(resolved) !== driveCase(current)) throw new Error("Publication directory is a filesystem alias.");
    }
    return await realpath(absolute);
}

export async function validateNewDestination(sourceRoot: string, destination: string,
    protectedRoots: readonly string[]): Promise<string> {
    const source = await canonicalDirectory(sourceRoot);
    const absolute = path.resolve(destination);
    const parent = await canonicalDirectory(path.dirname(absolute));
    publicationRelativePath(path.basename(absolute));
    const target = path.join(parent, path.basename(absolute));
    if (pathContains(source, target) || pathContains(target, source)
        || protectedRoots.some(root => pathContains(root, target) || pathContains(target, root))) {
        throw new Error("Choose a new folder outside the source project and protected storage.");
    }
    try { await lstat(target); }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return target;
        throw error;
    }
    throw new Error("Publication destination must be a new folder; existing folders are never overwritten.");
}
