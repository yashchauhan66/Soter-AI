import { containsRawSecret, redactForSharing } from "./Redactor";

export type ChangeKind = "create" | "modify" | "delete" | "rename" | "dependency_install" | "policy_change";

export interface PlannedChange {
    path: string;
    kind: ChangeKind;
    beforeHash?: string;
    afterHash?: string;
    reversible?: boolean;
    securitySensitive?: boolean;
    dependencyName?: string;
}

export interface TransactionPreview {
    changeCount: number;
    filesModified: number;
    filesDeleted: number;
    dependenciesInstalled: string[];
    securitySensitiveChanges: string[];
    requiresCheckpoint: boolean;
    recommendedAction: "ALLOW" | "ASK" | "DENY";
    reasons: string[];
    rollbackAvailable: boolean;
    redactedSummary: string;
}

export interface CheckpointFile {
    path: string;
    content: string;
}

export interface InMemoryCheckpoint {
    id: string;
    files: Array<{ path: string; contentHash: string; redactedPreview: string }>;
    createdAt: string;
}

export function previewTransaction(changes: PlannedChange[]): TransactionPreview {
    const filesModified = changes.filter((change) => change.kind === "modify" || change.kind === "create" || change.kind === "rename").length;
    const filesDeleted = changes.filter((change) => change.kind === "delete").length;
    const dependenciesInstalled = changes.filter((change) => change.kind === "dependency_install").map((change) => change.dependencyName ?? change.path);
    const securitySensitiveChanges = changes.filter((change) => change.securitySensitive || isSecuritySensitivePath(change.path)).map((change) => change.path);
    const rollbackAvailable = changes.every((change) => change.reversible !== false && change.kind !== "dependency_install");
    const reasons: string[] = [];

    if (filesDeleted > 0) reasons.push("Deletes files");
    if (dependenciesInstalled.length) reasons.push("Installs dependencies");
    if (securitySensitiveChanges.length) reasons.push("Touches security-sensitive paths");
    if (!rollbackAvailable) reasons.push("Not fully reversible");

    const recommendedAction =
        filesDeleted >= 20 || (dependenciesInstalled.length && securitySensitiveChanges.length)
            ? "DENY"
            : reasons.length
              ? "ASK"
              : "ALLOW";

    const summary = [
        `${changes.length} planned change(s)`,
        `${filesModified} file create/modify/rename operation(s)`,
        `${filesDeleted} deletion(s)`,
        `${dependenciesInstalled.length} dependency install(s)`,
        `${securitySensitiveChanges.length} security-sensitive change(s)`,
    ].join("; ");

    return {
        changeCount: changes.length,
        filesModified,
        filesDeleted,
        dependenciesInstalled,
        securitySensitiveChanges,
        requiresCheckpoint: recommendedAction !== "ALLOW",
        recommendedAction,
        reasons,
        rollbackAvailable,
        redactedSummary: redactForSharing(summary),
    };
}

export async function createInMemoryCheckpoint(id: string, files: CheckpointFile[], now = new Date().toISOString()): Promise<InMemoryCheckpoint> {
    return {
        id,
        createdAt: now,
        files: await Promise.all(files.map(async (file) => ({
            path: containsRawSecret(file.path) ? "[REDACTED_PATH]" : file.path,
            contentHash: await simpleHash(file.content),
            redactedPreview: redactForSharing(file.content).slice(0, 160),
        }))),
    };
}

function isSecuritySensitivePath(pathValue: string): boolean {
    const p = pathValue.replace(/\\/g, "/").toLowerCase();
    return p.includes("/auth/") || p.includes("/security/") || p.includes(".github/workflows/") || p.includes(".soterai/") || p.endsWith("package.json") || p.endsWith("package-lock.json");
}

async function simpleHash(text: string): Promise<string> {
    if (typeof globalThis.crypto?.subtle?.digest === "function") {
        const bytes = new TextEncoder().encode(text);
        const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
        return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    return Math.abs(hash).toString(16).padStart(8, "0");
}
