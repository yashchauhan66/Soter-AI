import { documentDigest } from "../ai-boundary/policy";
import { buildSafeFileView, terminalSafeText, MAX_FILE_BYTES, type FileViewKind } from "./SafeFileView";

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
    /** Already sanitized output, shown only in the native owner modal. */
    readonly safeText: string;
    readonly outputDigest: string;
    readonly recipient: string;
}
export type AccessResult = { status: "ALLOWED_ONCE"; kind: FileViewKind; text: string }
    | { status: "DENIED" | "UNAVAILABLE" | "CHANGED" | "EXPIRED" | "BUSY"; text?: never };
export interface AccessDependencies<T> {
    enabled(): boolean;
    capture(target: T): Promise<CapturedFile>;
    confirm(receipt: AccessReceipt): Promise<boolean>;
    /** Monotonic elapsed time, not wall-clock validity. */
    now(): number;
    /** Trusted route metadata; command callers cannot supply it. */
    recipient?(target: T, surface: RequestSurface): string;
    /** Additive policy enrollment before content capture, under the same deadline. */
    prepare?(target: T): Promise<void>;
}

const LIFETIME_MS = 60_000;
const MAX_PREVIEW_BYTES = 16 * 1024;
const SURFACES: readonly RequestSurface[] = ["safe-preview", "managed-read-terminal", "integration-command"];
const INTERNAL_RECIPIENT = "This editor's managed reader (requester identity unverified)";

/** One native review per request; no caller-supplied or persistent allow primitive. */
export class ProjectFileAccess<T> {
    private epoch = 0;
    private busy = false;
    private disposed = false;
    private pendingCancel: (() => void) | undefined;
    private preparingEpoch: number | undefined;
    constructor(private readonly deps: AccessDependencies<T>) {}

    revoke(): void { this.epoch++; this.pendingCancel?.(); }
    dispose(): void { this.disposed = true; this.revoke(); }
    isPreparing(): boolean { return this.busy && this.preparingEpoch === this.epoch; }

    async request(target: T, surface: RequestSurface): Promise<AccessResult> {
        if (!SURFACES.includes(surface) || !this.available()) return { status: "UNAVAILABLE" };
        if (this.busy) return { status: "BUSY" };
        this.busy = true;
        const epoch = ++this.epoch;
        let started: number;
        try { started = this.deps.now(); } catch { this.busy = false; return { status: "UNAVAILABLE" }; }
        let cancelled = false;
        let cancel!: () => void;
        const expiration = new Promise<AccessResult>(resolve => {
            cancel = () => { cancelled = true; resolve({ status: "EXPIRED" }); };
        });
        this.pendingCancel = cancel;
        const timer = setTimeout(cancel, LIFETIME_MS);
        timer.unref?.();
        const valid = () => {
            const now = this.deps.now();
            return !cancelled && this.available() && this.epoch === epoch && Number.isFinite(started)
                && Number.isFinite(now) && now >= started && now - started < LIFETIME_MS;
        };
        const operation = async (): Promise<AccessResult> => { try {
            if (!valid()) return { status: "EXPIRED" };
            if (this.deps.prepare) {
                this.preparingEpoch = epoch;
                try { await this.deps.prepare(target); }
                finally { if (this.preparingEpoch === epoch) this.preparingEpoch = undefined; }
                if (!valid()) return { status: "EXPIRED" };
            }
            const recipient = this.recipient(target, surface);
            const before = await this.deps.capture(target);
            if (!valid()) return { status: "EXPIRED" };
            if (this.recipient(target, surface) !== recipient) return { status: "CHANGED" };
            // Prepare only a safe view; never give original content to the UI dependency.
            const view = this.view(before, surface);
            const fingerprint = this.fingerprint(before);
            const outputDigest = documentDigest(view.text);
            const receipt: AccessReceipt = Object.freeze({ workspace: before.workspace, relativePath: before.relativePath,
                surface, kind: view.kind, fieldCount: view.fieldCount, durationSeconds: 60,
                safeText: view.text, outputDigest, recipient });
            const approved = await this.deps.confirm(receipt);
            if (approved !== true) return { status: "DENIED" };
            if (!valid()) return { status: "EXPIRED" };
            if (this.recipient(target, surface) !== recipient) return { status: "CHANGED" };
            const after = await this.deps.capture(target);
            if (!valid()) return { status: "EXPIRED" };
            if (fingerprint !== this.fingerprint(after) || this.recipient(target, surface) !== recipient) return { status: "CHANGED" };
            const fresh = this.view(after, surface);
            if (fresh.kind !== view.kind || fresh.text !== view.text || documentDigest(fresh.text) !== outputDigest) return { status: "CHANGED" };
            return { status: "ALLOWED_ONCE", kind: view.kind, text: view.text };
        } catch {
            // Filesystem/policy errors can include secret paths/content; never propagate them.
            return { status: "UNAVAILABLE" };
        } };
        try { return await Promise.race([operation(), expiration]); }
        finally {
            cancelled = true; clearTimeout(timer);
            if (this.pendingCancel === cancel) this.pendingCancel = undefined;
            if (this.preparingEpoch === epoch) this.preparingEpoch = undefined;
            this.busy = false;
        }
    }

    private available(): boolean {
        try { return !this.disposed && this.deps.enabled() === true; } catch { return false; }
    }
    private recipient(target: T, surface: RequestSurface): string {
        const recipient = this.deps.recipient?.(target, surface) ?? INTERNAL_RECIPIENT;
        if (typeof recipient !== "string" || !recipient.trim() || recipient.length > 256 || /[\x00-\x1f\x7f]/.test(recipient)) throw new Error("Recipient unavailable.");
        return recipient;
    }
    private view(file: CapturedFile, surface: RequestSurface) {
        // A tiny alternate view must never conceal an unsupported original input.
        if (typeof file.content !== "string" || Buffer.byteLength(file.content, "utf8") > MAX_FILE_BYTES || file.content.includes("\0")) throw new Error("Unsupported file.");
        const view = buildSafeFileView(file.relativePath, file.regionView, file.sensitive, file.content);
        const text = surface === "managed-read-terminal" ? terminalSafeText(view.text) : view.text;
        if (Buffer.byteLength(text, "utf8") > MAX_PREVIEW_BYTES) throw new Error("Safe preview exceeds its budget.");
        return { ...view, text };
    }
    private fingerprint(file: CapturedFile): string {
        return documentDigest(JSON.stringify([file.workspace, file.relativePath, file.policyRevision,
            file.fileIdentity, documentDigest(file.content), documentDigest(file.regionView), file.sensitive]));
    }
}
