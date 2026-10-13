import { documentDigest } from "../ai-boundary/policy";
import { buildSafeFileView, type FileViewKind } from "./SafeFileView";

export type RequestSurface = "safe-preview" | "managed-read-terminal" | "integration-command";
export interface CapturedFile {
    workspace: string;
    relativePath: string;
    policyRevision: string;
    fileIdentity: string;
    /** Trusted guard memory only. Never part of the approval receipt/result. */
    content: string;
    regionView: string;
    sensitive: boolean;
}
export interface AccessReceipt {
    workspace: string;
    relativePath: string;
    surface: RequestSurface;
    kind: FileViewKind;
    fieldCount: number;
    durationSeconds: 60;
}
export type AccessResult = { status: "ALLOWED_ONCE"; kind: FileViewKind; text: string }
    | { status: "DENIED" | "UNAVAILABLE" | "CHANGED" | "EXPIRED" | "BUSY"; text?: never };
export interface AccessDependencies<T> {
    enabled(): boolean;
    capture(target: T): Promise<CapturedFile>;
    confirm(receipt: AccessReceipt): Promise<boolean>;
    /** Monotonic elapsed time, not wall-clock validity. */
    now(): number;
}

const LIFETIME_MS = 60_000;

/** One native review per request; no caller-supplied or persistent allow primitive. */
export class ProjectFileAccess<T> {
    private epoch = 0;
    private busy = false;
    private disposed = false;
    constructor(private readonly deps: AccessDependencies<T>) {}

    revoke(): void { this.epoch++; }
    dispose(): void { this.disposed = true; this.revoke(); }

    async request(target: T, surface: RequestSurface): Promise<AccessResult> {
        if (!this.available()) return { status: "UNAVAILABLE" };
        if (this.busy) return { status: "BUSY" };
        this.busy = true;
        const epoch = this.epoch;
        const started = this.deps.now();
        const valid = () => {
            const now = this.deps.now();
            return this.available() && this.epoch === epoch && Number.isFinite(started)
                && Number.isFinite(now) && now >= started && now - started < LIFETIME_MS;
        };
        try {
            const before = await this.deps.capture(target);
            if (!valid()) return { status: "EXPIRED" };
            // Prepare only a safe view; never give original content to the UI dependency.
            const view = buildSafeFileView(before.relativePath, before.regionView, before.sensitive, before.content);
            const fingerprint = this.fingerprint(before);
            const approved = await this.deps.confirm({ workspace: before.workspace, relativePath: before.relativePath,
                surface, kind: view.kind, fieldCount: view.fieldCount, durationSeconds: 60 });
            if (!approved) return { status: "DENIED" };
            if (!valid()) return { status: "EXPIRED" };
            const after = await this.deps.capture(target);
            if (!valid()) return { status: "EXPIRED" };
            if (fingerprint !== this.fingerprint(after)) return { status: "CHANGED" };
            return { status: "ALLOWED_ONCE", kind: view.kind, text: view.text };
        } catch {
            // Filesystem/policy errors can include secret paths/content; never propagate them.
            return { status: "UNAVAILABLE" };
        } finally { this.busy = false; }
    }

    private available(): boolean {
        try { return !this.disposed && this.deps.enabled(); } catch { return false; }
    }
    private fingerprint(file: CapturedFile): string {
        return documentDigest(JSON.stringify([file.workspace, file.relativePath, file.policyRevision,
            file.fileIdentity, documentDigest(file.content), documentDigest(file.regionView), file.sensitive]));
    }
}
