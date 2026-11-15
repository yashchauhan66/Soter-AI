import * as fs from "node:fs/promises";
import path from "node:path";

export interface ProjectProfile { label: string; environmentFiles: number; git: boolean; node: boolean; incomplete: boolean }
/** Inspect only fixed marker metadata. Never parse or execute project configuration. */
export async function detectProjectProfile(root: string): Promise<ProjectProfile> {
    const result: ProjectProfile = { label: "Local project", environmentFiles: 0, git: false, node: false, incomplete: false };
    const markers = ["package.json", "tsconfig.json", "pyproject.toml", "requirements.txt", "go.mod", "Cargo.toml", ".git", ".env", ".env.local", ".env.development", ".env.production"];
    try {
        const stat = await fs.lstat(root), canonical = await fs.realpath(root);
        if (!stat.isDirectory() || stat.isSymbolicLink() || path.resolve(canonical).toLowerCase() !== path.resolve(root).toLowerCase()) throw Error();
        const present = new Set<string>();
        for (const marker of markers) {
            try {
                const entry = await fs.lstat(path.join(root, marker));
                if (entry.isSymbolicLink() || marker !== ".git" && (!entry.isFile() || entry.nlink !== 1)) { result.incomplete = true; continue; }
                present.add(marker);
            } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") result.incomplete = true; }
        }
        result.node = present.has("package.json");
        const stacks = [result.node ? present.has("tsconfig.json") ? "Node / TypeScript" : "Node / JavaScript" : "", present.has("pyproject.toml") || present.has("requirements.txt") ? "Python" : "", present.has("go.mod") ? "Go" : "", present.has("Cargo.toml") ? "Rust" : ""].filter(Boolean);
        result.label = stacks.join(" + ") || "Local project";
        result.environmentFiles = markers.filter(marker => marker.startsWith(".env") && present.has(marker)).length;
        result.git = present.has(".git");
    } catch { result.incomplete = true; }
    return result;
}
