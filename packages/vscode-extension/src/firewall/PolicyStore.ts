import * as vscode from "vscode";
import {
    DEFAULT_PROJECT_POLICY,
    parseProjectPolicy,
    classifyPath,
    type ProjectPolicy,
} from "@soterai/guard-core";
import { firstWorkspaceFolder } from "./util";

/**
 * ProjectPolicyStore — reads/writes `.soterai/policy.json` in the workspace and
 * exposes the parsed {@link ProjectPolicy} the firewall uses to classify files.
 * Reads always go through `parseProjectPolicy` so a corrupt/partial file falls
 * back safely to the strict defaults.
 */
export class PolicyStore {
    static readonly REL_PATH = ".soterai/policy.json";

    static policyUri(): vscode.Uri | undefined {
        const folder = firstWorkspaceFolder();
        if (!folder) return undefined;
        return vscode.Uri.joinPath(folder.uri, ".soterai", "policy.json");
    }

    /** Load the project policy, or the default when no file exists. */
    static async load(): Promise<ProjectPolicy> {
        const uri = this.policyUri();
        if (!uri) return DEFAULT_PROJECT_POLICY;
        try {
            const bytes = await vscode.workspace.fs.readFile(uri);
            const raw = JSON.parse(new TextDecoder().decode(bytes));
            return parseProjectPolicy(raw);
        } catch {
            return DEFAULT_PROJECT_POLICY;
        }
    }

    static async exists(): Promise<boolean> {
        const uri = this.policyUri();
        if (!uri) return false;
        try {
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            return false;
        }
    }

    /** Persist a policy to `.soterai/policy.json` (creating the folder). */
    static async save(policy: ProjectPolicy): Promise<vscode.Uri> {
        const uri = this.policyUri();
        if (!uri) throw new Error("No workspace folder open.");
        const dir = vscode.Uri.joinPath(firstWorkspaceFolder()!.uri, ".soterai");
        await vscode.workspace.fs.createDirectory(dir);
        const content = JSON.stringify(policy, null, 2);
        await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
        return uri;
    }

    /** Create the default policy if none exists; returns the file uri. */
    static async createDefault(): Promise<vscode.Uri> {
        return this.save(DEFAULT_PROJECT_POLICY);
    }

    /** Add a workspace-relative path pattern to `protectedFiles` (idempotent). */
    static async addProtected(relPath: string): Promise<ProjectPolicy> {
        const policy = await this.load();
        if (!policy.protectedFiles.includes(relPath)) {
            policy.protectedFiles.push(relPath);
            await this.save(policy);
        }
        return policy;
    }

    /** Remove a pattern from `protectedFiles`. */
    static async removeProtected(relPath: string): Promise<ProjectPolicy> {
        const policy = await this.load();
        policy.protectedFiles = policy.protectedFiles.filter((p) => p !== relPath);
        await this.save(policy);
        return policy;
    }

    /**
     * List workspace files that currently match a protected/sensitive pattern.
     * Uses the same file walk as the workspace scanner (bounded, exclude globs).
     */
    static async listClassified(policy: ProjectPolicy, maxFiles = 2000): Promise<
        Array<{ relPath: string; level: string; matchedPattern?: string }>
    > {
        const config = vscode.workspace.getConfiguration("soterai");
        const excludeGlobs = config.get<string[]>("scan.excludeGlobs", ["**/node_modules/**", "**/.git/**"]);
        const files = await vscode.workspace.findFiles("**/*", `{${excludeGlobs.join(",")}}`, maxFiles);
        const out: Array<{ relPath: string; level: string; matchedPattern?: string }> = [];
        for (const f of files) {
            const rel = vscode.workspace.asRelativePath(f);
            const cls = classifyPath(rel, policy);
            if (cls.level !== "normal") {
                out.push({ relPath: rel, level: cls.level, matchedPattern: cls.matchedPattern });
            }
        }
        return out;
    }
}
