import { createHash, randomUUID } from "node:crypto";
import { lstat } from "node:fs/promises";
import path from "node:path";
import { readBoundaryFile } from "../ai-boundary/readFile";
import { tier2LiteTemplates, TIER2_LITE_COVERAGE } from "./DevcontainerTemplate";

export interface Tier2LiteInput {
    enabled?: boolean;
    sourceRoot: string;
    /** Exact, individually classified public files. No directories, globs or implicit traversal. */
    publicPaths: readonly string[];
    /** Effective deny policy, including latched denies. Unknown/error must not become public. */
    isProtected: (relativePath: string) => boolean;
    reviewedBaseImage: string;
    /** Number of newly generated opaque placeholders; no secret values or original paths accepted. */
    placeholderCount?: number;
}

const blockedSegments = new Set(["home", "homes", "users", "root", "var", "tmp", "temp", "cache", "caches",
    "history", "recovery", "backup", "backups", "node_modules", "venv", "__pycache__", "appdata"]);
const blockedNames = /^(?:id_rsa|id_dsa|id_ecdsa|id_ed25519|credentials?|secrets?|tokens?|docker\.sock)(?:\.|$)/i;
const blockedSuffixes = /\.(?:pem|key|p12|pfx|jks|kdbx|sqlite|sqlite3|db|log|bak|old|swp|swo|orig)$/i;

export function validatePublicPath(relativePath: string): string {
    if (typeof relativePath !== "string" || !relativePath || relativePath.length > 240) throw new Error("Invalid public file path.");
    const segments = relativePath.split("/");
    if (segments.some(segment => !/^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(segment) || segment.endsWith(".")
        || blockedSegments.has(segment.toLowerCase()) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment))) {
        throw new Error("Public export rejects hidden, history, home, cache, recovery or ambiguous paths.");
    }
    const basename = segments[segments.length - 1];
    if (blockedNames.test(basename) || blockedSuffixes.test(basename)) throw new Error("Public export rejects credential or recovery files.");
    return relativePath;
}

/**
 * Generates an in-memory public snapshot plan. Reads only explicitly classified,
 * unprotected regular files via existing alias/hardlink/bounded-read checks.
 * Does not write/export to disk, launch anything or provide an OS boundary.
 */
export async function generateTier2LiteWorkspace(input: Tier2LiteInput) {
    if (input.enabled !== true) throw new Error("Tier-2-lite generation is disabled; no export or launch is available.");
    if (!path.isAbsolute(input.sourceRoot)) throw new Error("An absolute source workspace is required.");
    if (!Array.isArray(input.publicPaths) || input.publicPaths.length < 1 || input.publicPaths.length > 256) {
        throw new Error("Classify between one and 256 exact public files before generation.");
    }
    if (typeof input.isProtected !== "function") throw new Error("Effective deny-policy evaluation is required.");
    const count = input.placeholderCount ?? 0;
    if (!Number.isInteger(count) || count < 0 || count > 128) throw new Error("Invalid opaque placeholder count.");
    const runId = randomUUID();
    const templates = tier2LiteTemplates(runId, input.reviewedBaseImage);
    const publicPaths = input.publicPaths.map(validatePublicPath);
    if (new Set(publicPaths.map(value => value.toLowerCase())).size !== publicPaths.length) throw new Error("Public paths collide.");
    for (const relativePath of publicPaths) {
        if (input.isProtected(relativePath) !== false) throw new Error("Public export refused a protected or unknown-classification path.");
    }
    const root = await lstat(input.sourceRoot);
    if (!root.isDirectory() || root.isSymbolicLink()) throw new Error("Source workspace must be a regular directory, not a link.");
    const files: { relativePath: string; content: string; kind: "PUBLIC" | "PLACEHOLDER" | "TEMPLATE" }[] = [];
    let publicBytes = 0;
    for (const relativePath of publicPaths) {
        // Re-evaluate after earlier asynchronous work; still not atomic against same-user mutation.
        if (input.isProtected(relativePath) !== false) throw new Error("Deny policy changed; generation stopped.");
        const content = await readBoundaryFile(input.sourceRoot, path.join(input.sourceRoot, ...relativePath.split("/")));
        if (input.isProtected(relativePath) !== false) throw new Error("Deny policy changed; generation stopped.");
        publicBytes += Buffer.byteLength(content, "utf8");
        if (publicBytes > 4 * 1024 * 1024) throw new Error("Public snapshot exceeds its total size limit.");
        files.push({ relativePath: `public/${relativePath}`, content, kind: "PUBLIC" });
    }
    for (let index = 0; index < count; index++) {
        const opaqueId = randomUUID();
        files.push({ relativePath: `public/soterai-placeholders/${opaqueId}.json`, kind: "PLACEHOLDER",
            content: JSON.stringify({ placeholder: `soterai:opaque:${opaqueId}`, resolvableByAgent: false }) + "\n" });
    }
    const manifest = {
        schemaVersion: 1, runId, status: "GENERATED_ONLY", coverage: TIER2_LITE_COVERAGE,
        covers: ["Only explicitly classified unprotected public files are selected for this snapshot.",
            "Initial source history, hidden files, homes, caches, recovery files and credentials are omitted.",
            "Opaque placeholders contain no source value and provide no secret-resolution authority.",
            "Template requests a nonprivileged, nonroot offline container with no host bind mounts."],
        doesNotCover: ["Agents started natively are OUTSIDE COVERAGE.", "Same-user native files, processes, memory, buffers, clipboard and display.",
            "Private values mistakenly classified as public or already disclosed elsewhere.",
            "Editor attach helpers, base-image metadata or runtime behavior before independent verification.",
            "Independent consent, durable protected custody, mandatory host egress or G1-G6 architecture guarantees."],
        guarantees: "UNTESTED", nativeAgents: "OUTSIDE_COVERAGE", forwardingPolicy: templates.forwardingPolicy,
        deployment: templates.deployment,
        inventory: files.map(file => ({ path: file.relativePath, kind: file.kind,
            sha256: createHash("sha256").update(file.content).digest("hex") })),
    };
    const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
    files.push({ relativePath: ".devcontainer/devcontainer.json", content: json(templates.devcontainer), kind: "TEMPLATE" },
        { relativePath: ".devcontainer/Dockerfile", content: templates.dockerfile, kind: "TEMPLATE" },
        { relativePath: "isolated-host-profile.settings.json", content: json(templates.hostProfileSettings), kind: "TEMPLATE" },
        { relativePath: "tier2-lite-manifest.json", content: json(manifest), kind: "TEMPLATE" },
        { relativePath: ".dockerignore", content: "**\n!public/\n!public/**\n!.devcontainer/\n!.devcontainer/Dockerfile\n", kind: "TEMPLATE" });
    return { runId, files, manifest };
}
