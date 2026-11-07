import { lstat, realpath, stat } from "fs/promises";
import * as path from "path";
import { isPathWithin } from "./pathContainment";
import type { BigIntStats } from "node:fs";
import { READ_RELIABILITY_LIMITS } from "./ReadReliability";

export class FileSystemPathViolation extends Error {
    constructor(message: string) {
        super(message);
        this.name = "FileSystemPathViolation";
    }
}

async function rejectSymlinkComponents(root: string, target: string): Promise<void> {
    const relative = path.relative(root, target);
    if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) return;

    let current = root;
    for (const segment of relative.split(path.sep)) {
        if (!segment) continue;
        current = path.join(current, segment);
        try {
            const entry = await lstat(current);
            if (entry.isSymbolicLink()) {
                throw new FileSystemPathViolation("Path contains a symbolic link or junction.");
            }
        } catch (error) {
            if (error instanceof FileSystemPathViolation) throw error;
            return;
        }
    }
}

async function isDirectoryAlias(lexicalPath: string): Promise<boolean> {
    try {
        const entry = await stat(lexicalPath);
        if (!entry.isDirectory()) return false;
        // VS Code normalizes Windows drive letters to lowercase while realpath
        // can return uppercase. Preserve directory-name case checks, but do not
        // classify this spelling difference as a junction/alias.
        const comparable = (value: string) => {
            const normalized = path.normalize(value);
            return process.platform === "win32" ? normalized.replace(/^[a-z]:/i, drive => drive.toUpperCase()) : normalized;
        };
        return comparable(await realpath(lexicalPath)) !== comparable(path.resolve(lexicalPath));
    } catch {
        return false;
    }
}

/** Validate an existing file against one specific workspace root. */
export async function verifyExistingPath(root: string, target: string): Promise<string> {
    const lexicalRoot = path.resolve(root);
    const lexicalTarget = path.resolve(target);
    if (!isPathWithin(lexicalRoot, lexicalTarget)) {
        throw new FileSystemPathViolation("Path is outside the workspace root.");
    }

    let canonicalRoot: string;
    let canonicalTarget: string;
    try {
        canonicalRoot = await realpath(lexicalRoot);
        canonicalTarget = await realpath(lexicalTarget);
    } catch {
        throw new FileSystemPathViolation("Path could not be canonicalized safely.");
    }

    if (!isPathWithin(canonicalRoot, canonicalTarget)) {
        throw new FileSystemPathViolation("Path resolves outside the workspace root.");
    }

    await rejectSymlinkComponents(lexicalRoot, lexicalTarget);
    if (await isDirectoryAlias(path.dirname(lexicalTarget))) {
        throw new FileSystemPathViolation("Path directory is a junction or filesystem alias.");
    }
    return canonicalTarget;
}

/** Validate an output path; the output may be absent, but its parent must exist. */
export async function verifyOutputPath(root: string, target: string): Promise<string> {
    const lexicalRoot = path.resolve(root);
    const lexicalTarget = path.resolve(target);
    const lexicalParent = path.dirname(lexicalTarget);
    if (!isPathWithin(lexicalRoot, lexicalTarget)) {
        throw new FileSystemPathViolation("Output is outside the workspace root.");
    }

    let canonicalRoot: string;
    let canonicalParent: string;
    try {
        canonicalRoot = await realpath(lexicalRoot);
        canonicalParent = await realpath(lexicalParent);
    } catch {
        throw new FileSystemPathViolation("Output parent could not be canonicalized safely.");
    }

    if (!isPathWithin(canonicalRoot, canonicalParent)) {
        throw new FileSystemPathViolation("Output resolves outside the workspace root.");
    }

    await rejectSymlinkComponents(lexicalRoot, lexicalTarget);
    if (await isDirectoryAlias(lexicalParent)) {
        throw new FileSystemPathViolation("Output directory is a junction or filesystem alias.");
    }
    return path.join(canonicalParent, path.basename(lexicalTarget));
}

export interface ReadPathSnapshot {
    readonly root: string;
    readonly target: string;
    readonly canonical: string;
    readonly directories: readonly { readonly path: string; readonly identity: string }[];
    readonly file: BigIntStats;
}
const readPathUnavailable = () => new FileSystemPathViolation("Unsafe or changed managed read path.");
function readSpelling(value: string): string {
    const normalized = path.normalize(value);
    return process.platform === "win32" ? normalized.replace(/^[a-z]:/i, drive => drive.toUpperCase()) : normalized;
}
function directoryIdentity(value: BigIntStats): string {
    if (!value.isDirectory() || value.isSymbolicLink()) throw readPathUnavailable();
    // Directory contents may change independently. Bind the directory object,
    // not mtime/ctime/size that also change when an unrelated sibling is saved.
    return [value.dev, value.ino, value.birthtimeNs, value.mode].join(":");
}
export function sameReadFile(first: BigIntStats, second: BigIntStats, pathStat = false): boolean {
    return (first.dev === second.dev || (pathStat && process.platform === "win32" && (first.dev === 0n || second.dev === 0n)))
        && first.ino === second.ino && first.mode === second.mode && first.size === second.size && first.nlink === second.nlink
        && first.birthtimeNs === second.birthtimeNs && first.ctimeNs === second.ctimeNs && first.mtimeNs === second.mtimeNs;
}
export function regularReadFile(value: BigIntStats, maximum: number): boolean {
    return value.isFile() && !value.isSymbolicLink() && value.nlink === 1n && value.size >= 0n && value.size <= BigInt(maximum);
}
/** Capture ancestry through the filesystem root, including workspace ancestors. */
export async function captureReadPath(root: string, target: string, check: () => void): Promise<ReadPathSnapshot> {
    check(); const canonical = await verifyExistingPath(root, target); check();
    const lexicalRoot = path.resolve(root), lexicalTarget = path.resolve(target), parents: string[] = [];
    for (let current = path.dirname(lexicalTarget);; current = path.dirname(current)) {
        if (parents.length >= READ_RELIABILITY_LIMITS.pathComponents) throw readPathUnavailable();
        parents.push(current); if (path.dirname(current) === current) break;
    }
    const directories: { path: string; identity: string }[] = [];
    for (const directory of parents.reverse()) {
        const value = await lstat(directory, { bigint: true }); check();
        const resolved = await realpath(directory); check();
        if (readSpelling(directory) !== readSpelling(resolved)) throw readPathUnavailable();
        directories.push({ path: directory, identity: directoryIdentity(value) });
    }
    const file = await lstat(lexicalTarget, { bigint: true }); check();
    if (!regularReadFile(file, READ_RELIABILITY_LIMITS.readBytes) || readSpelling(canonical) !== readSpelling(lexicalTarget)) throw readPathUnavailable();
    return Object.freeze({ root: lexicalRoot, target: lexicalTarget, canonical, directories: Object.freeze(directories), file });
}
/** Detect observed parent/file swaps. Portable path APIs cannot close every race. */
export async function revalidateReadPath(snapshot: ReadPathSnapshot, check: () => void): Promise<void> {
    check();
    if (!isPathWithin(snapshot.root, snapshot.target)) throw readPathUnavailable();
    for (const directory of snapshot.directories) {
        const value = await lstat(directory.path, { bigint: true }); check();
        if (directoryIdentity(value) !== directory.identity) throw readPathUnavailable();
        const resolved = await realpath(directory.path); check();
        if (readSpelling(resolved) !== readSpelling(directory.path)) throw readPathUnavailable();
    }
    const file = await lstat(snapshot.target, { bigint: true }); check();
    if (!regularReadFile(file, READ_RELIABILITY_LIMITS.readBytes) || !sameReadFile(snapshot.file, file, true)) throw readPathUnavailable();
}
