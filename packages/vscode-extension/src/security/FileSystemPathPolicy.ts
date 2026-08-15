import { lstat, realpath, stat } from "fs/promises";
import * as path from "path";
import { isPathWithin } from "./pathContainment";

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
        return path.normalize(await realpath(lexicalPath)) !== path.normalize(path.resolve(lexicalPath));
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