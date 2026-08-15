import * as vscode from "vscode";
import {
    FileSystemPathViolation,
    verifyExistingPath,
    verifyOutputPath,
} from "./FileSystemPathPolicy";

/**
 * Workspace path policy for operations that can read or mutate user files.
 *
 * VS Code workspace APIs follow symlinks/junctions, so a URI that looks like a
 * workspace-relative path is not sufficient for a security decision. We
 * canonicalize the workspace root and target, reject targets outside the root,
 * and reject symlink components to avoid silently operating on another tree.
 */
export class WorkspacePathViolation extends Error {
    constructor(message: string) {
        super(message);
        this.name = "WorkspacePathViolation";
    }
}

/**
 * Validate an existing workspace file before reading or writing it.
 * Returns the canonical filesystem path for callers that need a diagnostic.
 */
export async function assertWorkspaceFileUri(uri: vscode.Uri): Promise<string> {
    if (uri.scheme !== "file") {
        throw new WorkspacePathViolation("SoterAI only protects files inside a trusted workspace.");
    }

    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) {
        throw new WorkspacePathViolation("SoterAI refused a file outside the current workspace.");
    }

    try {
        return await verifyExistingPath(folder.uri.fsPath, uri.fsPath);
    } catch (error) {
        if (error instanceof FileSystemPathViolation) {
            throw new WorkspacePathViolation(`SoterAI refused this workspace file: ${error.message}`);
        }
        throw error;
    }
}

/**
 * Validate a workspace output path that may not exist yet. Its parent must
 * resolve inside the workspace and contain no symlink component.
 */
export async function assertWorkspaceOutputUri(uri: vscode.Uri): Promise<string> {
    if (uri.scheme !== "file") {
        throw new WorkspacePathViolation("SoterAI only writes files inside a trusted workspace.");
    }

    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) {
        throw new WorkspacePathViolation("SoterAI refused an output outside the current workspace.");
    }

    try {
        return await verifyOutputPath(folder.uri.fsPath, uri.fsPath);
    } catch (error) {
        if (error instanceof FileSystemPathViolation) {
            throw new WorkspacePathViolation(`SoterAI refused this workspace output: ${error.message}`);
        }
        throw error;
    }
}