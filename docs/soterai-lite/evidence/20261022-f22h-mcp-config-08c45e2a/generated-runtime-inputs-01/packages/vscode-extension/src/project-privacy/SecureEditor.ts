import * as vscode from "vscode";
import * as path from "node:path";
import { constants } from "node:fs";
import { lstat, mkdir, open, unlink } from "node:fs/promises";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { SENSITIVE_FILE_GLOBS } from "@soterai/guard-core";
import { BoundarySnapshot, onDidChangeBoundaryRules, onDidChangeOwnerPolicySession } from "../ai-boundary/BoundarySnapshot";
import { withPendingRestriction, onDidChangeManualRestriction, manualRestrictionIntentPending } from "../ai-boundary/RestrictionOperation";
import { assertWorkspaceFileUri, assertWorkspaceOutputUri } from "../security/WorkspacePathGuard";
import { verifyExistingPath, verifyOutputPath } from "../security/FileSystemPathPolicy";
import { SecureEditorModel } from "./SecureEditorModel";
import { decryptEditorRecovery, encryptEditorRecovery } from "./SecureEditorRecovery";

export const SECURE_EDITOR_VIEW_TYPE = "soterai.secureEditor";
const KEY_PREFIX = "soterai.lite.secureEditor.recovery.";
const RECORD_PREFIX = "soterai.lite.secureEditor.backup.";
const ASSOCIATIONS = "soterai.lite.secureEditor.association.v1";
const ENV = /^\.env(?:\..*)?$/i;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function unavailable(): never { throw new Error("Secure editor operation unavailable. The private draft remains withheld."); }
const digest = (bytes: string | Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const identity = (stat: { dev: number; ino: number; birthtimeMs: number; size: number; mtimeMs: number }): string =>
    JSON.stringify([process.platform === "win32" ? 0 : stat.dev, stat.ino, stat.birthtimeMs, stat.size, stat.mtimeMs]);
const samePath = (a: string, b: string): boolean => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const escape = (value: string): string => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

export function secureEditorEnabled(): boolean {
    try {
        const config = vscode.workspace.getConfiguration("soterai"), inspected = config.inspect<boolean>("lite.secureEditor");
        return vscode.workspace.isTrusted && (inspected ? inspected.globalValue ?? inspected.defaultValue ?? true : config.get("lite.secureEditor", true)) === true;
    } catch { return false; }
}
interface FileBasis { root: string; policy: string; identity: string; digest: string; bytes: Buffer }
interface View { panel: vscode.WebviewPanel; session: string; disposed: boolean; timer?: ReturnType<typeof setTimeout>; subscriptions: vscode.Disposable[] }
interface BackupRecord { schemaVersion: 1; id: string; source: string; root: string; digest: string; keyId: string; kind: "implicit" | "native"; createdAt: number }
async function boundedRead(handle: Awaited<ReturnType<typeof open>>, limit: number): Promise<Buffer> {
    const buffer = Buffer.alloc(limit + 1); let length = 0;
    while (length < buffer.length) { const result = await handle.read(buffer, length, buffer.length - length, length); if (!result.bytesRead) break; length += result.bytesRead; }
    if (length > limit) unavailable(); return buffer.subarray(0, length);
}

export class SecureEditorDocument implements vscode.CustomDocument {
    readonly views = new Set<View>();
    disposed = false;
    busy = false;
    epoch = 0;
    activeEpoch?: number;
    ownedPending = false;
    recovered = false;
    implicit?: vscode.CustomDocumentBackup;
    constructor(readonly uri: vscode.Uri, readonly model: SecureEditorModel, public basis: FileBasis, public savedText: string,
        public savedIdentity: string, private readonly remove: () => void) {}
    toJSON(): { uri: string } { return { uri: this.uri.toString() }; }
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        for (const view of this.views) { view.disposed = true; if (view.timer) clearTimeout(view.timer); view.panel.webview.html = ""; view.subscriptions.forEach(item => item.dispose()); }
        this.views.clear(); this.remove();
    }
}

/** Private owner editor. No plaintext TextDocument, tool endpoint, or plaintext recovery file. */
export class SecureEditorProvider implements vscode.CustomEditorProvider<SecureEditorDocument>, vscode.Disposable {
    private readonly documents = new Set<SecureEditorDocument>();
    private readonly changed = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<SecureEditorDocument>>();
    readonly onDidChangeCustomDocument = this.changed.event;
    constructor(private readonly context: vscode.ExtensionContext) {}
    dispose(): void { for (const document of [...this.documents]) document.dispose(); this.changed.dispose(); }
    clearViews(revoke = true): void { for (const document of this.documents) { if (revoke) document.epoch++; this.mask(document); } }
    sourceChanged(uri: vscode.Uri): void {
        if (!(uri instanceof vscode.Uri) || uri.scheme !== "file") { this.clearViews(false); return; }
        for (const document of this.documents) {
            const descendant = path.relative(uri.fsPath, document.uri.fsPath);
            if (samePath(uri.fsPath, document.uri.fsPath) || descendant && !path.isAbsolute(descendant)
                && descendant !== ".." && !descendant.startsWith(".." + path.sep)) this.mask(document);
        }
    }
    ownerSessionChanged(root: string): void {
        for (const document of this.documents) {
            // Generic pending writes still revoke F03 grants. Only this owner's
            // own save bracket may continue, with fresh file/policy checks.
            if (document.basis.root === root && !(document.ownedPending && !manualRestrictionIntentPending(root))) document.epoch++;
            this.mask(document);
        }
    }
    private async pendingWrite<T>(document: SecureEditorDocument, operation: () => Promise<T>, pattern: string): Promise<T> {
        document.ownedPending = true;
        try { return await withPendingRestriction(document.basis.root, operation, { kind: "file", pattern }); }
        finally { document.ownedPending = false; }
    }
    private alive(document?: SecureEditorDocument, token?: vscode.CancellationToken): void {
        if (!secureEditorEnabled() || token?.isCancellationRequested || document?.disposed) unavailable();
        if (document && !this.documents.has(document)) unavailable();
        if (document?.busy && document.activeEpoch !== document.epoch) unavailable();
    }
    private async inspect(uri: vscode.Uri): Promise<FileBasis> {
        this.alive();
        if (!(uri instanceof vscode.Uri) || uri.scheme !== "file" || uri.query || uri.fragment || uri.authority) unavailable();
        const folder = vscode.workspace.getWorkspaceFolder(uri); if (!folder || folder.uri.scheme !== "file") unavailable();
        const canonical = await assertWorkspaceFileUri(uri); if (!samePath(canonical, uri.fsPath)) unavailable();
        const boundary = await BoundarySnapshot.load(), policy = boundary.accessRevision(uri);
        if (!policy || !(ENV.test(path.basename(uri.fsPath)) || boundary.isSensitive(uri))) unavailable();
        const stat = await lstat(uri.fsPath); if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 65536) unavailable();
        const handle = await open(uri.fsPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
        try {
            const before = await handle.stat(); if (identity(before) !== identity(stat)) unavailable();
            const bytes = await boundedRead(handle, 65536); const after = await handle.stat();
            if (bytes.length > 65536 || identity(before) !== identity(after) || identity(await lstat(uri.fsPath)) !== identity(after)) unavailable();
            if (!samePath(await assertWorkspaceFileUri(uri), uri.fsPath) || (await BoundarySnapshot.load()).accessRevision(uri) !== policy) unavailable();
            this.alive(); return { root: folder.uri.toString(), policy, identity: identity(after), digest: digest(bytes), bytes };
        } finally { await handle.close(); }
    }
    private async current(document: SecureEditorDocument): Promise<FileBasis> {
        this.alive(document); const basis = await this.inspect(document.uri);
        if (basis.root !== document.basis.root || basis.policy !== document.basis.policy) unavailable(); return basis;
    }
    async validate(uri: vscode.Uri): Promise<void> { await this.inspect(uri); }
    async openCustomDocument(uri: vscode.Uri, context: vscode.CustomDocumentOpenContext, token: vscode.CancellationToken): Promise<SecureEditorDocument> {
        this.alive(undefined, token); if (this.documents.size >= 32 || context.untitledDocumentData) unavailable();
        const basis = await this.inspect(uri);
        let text: string, saved: string, savedIdentity: string;
        let backupId = context.backupId;
        if (!backupId) {
            const candidate = this.records(uri, basis.root).filter(record => record.kind === "implicit").sort((a, b) => b.createdAt - a.createdAt)[0];
            if (candidate && await vscode.window.showWarningMessage("An encrypted private draft is available for this file. Recover it into the masked editor? The original will only change after a separate Save command.", { modal: true }, "Recover encrypted draft") === "Recover encrypted draft") backupId = candidate.id;
        }
        if (backupId) {
            const data = await this.restore(backupId, uri, basis.root);
            text = data.draftText; saved = data.savedText; savedIdentity = data.fileIdentity;
        } else { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(basis.bytes); saved = text; savedIdentity = JSON.stringify([basis.identity, basis.digest]); }
        const fresh = await this.inspect(uri); if (fresh.root !== basis.root || fresh.policy !== basis.policy || fresh.identity !== basis.identity || fresh.digest !== basis.digest) unavailable();
        const document = new SecureEditorDocument(uri, new SecureEditorModel(text, ENV.test(path.basename(uri.fsPath))), basis, saved, savedIdentity, () => this.documents.delete(document));
        document.recovered = !!backupId;
        if (backupId && !context.backupId) document.implicit = { id: backupId, delete: () => this.release(backupId) };
        this.alive(undefined, token); this.documents.add(document); return document;
    }
    async resolveCustomEditor(document: SecureEditorDocument, panel: vscode.WebviewPanel, token: vscode.CancellationToken): Promise<void> {
        this.alive(document, token); if (document.views.size >= 16) unavailable();
        const view: View = { panel, session: randomUUID(), disposed: false, subscriptions: [] }; document.views.add(view);
        panel.webview.options = { enableScripts: true, localResourceRoots: [] };
        view.subscriptions.push(panel.webview.onDidReceiveMessage(message => this.receive(document, view, message)),
            panel.onDidChangeViewState(() => { if (!panel.visible) this.mask(document); }),
            panel.onDidDispose(() => { view.disposed = true; if (view.timer) clearTimeout(view.timer); document.views.delete(view); this.mask(document); view.subscriptions.forEach(item => item.dispose()); }));
        this.mask(document);
    }
    private mask(document: SecureEditorDocument): void { for (const view of document.views) this.maskView(document, view); }
    private maskView(document: SecureEditorDocument, view: View): void {
        if (view.timer) { clearTimeout(view.timer); view.timer = undefined; }
        if (view.disposed) return;
        view.session = randomUUID();
        const nonce = randomBytes(18).toString("base64"), metadata = document.model.metadata();
        const rows = metadata.fields.map(field => `<section class="field" data-field="${escape(field.id)}"><strong>${escape(field.name)}</strong><pre class="value">[MASKED]</pre><div><button data-action="reveal">Reveal for 10 seconds</button>${field.editable ? '<button data-action="edit">Change value</button>' : ""}<button data-action="hide">Hide</button></div></section>`).join("");
        view.panel.webview.html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';"><meta name="viewport" content="width=device-width, initial-scale=1"><style nonce="${nonce}">body{font:var(--vscode-font-size) var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);max-width:850px;margin:32px auto;padding:0 24px}h1{font-size:24px}.field{border:1px solid var(--vscode-panel-border);border-radius:6px;padding:16px;margin:12px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere}button{font:inherit;background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);border:1px solid transparent;padding:8px 12px;margin:4px;cursor:pointer}button:focus-visible{outline:2px solid var(--vscode-focusBorder)}</style></head><body data-session="${view.session}" data-revision="${metadata.revision}"><h1>Secure environment editor</h1><p>Values stay masked. Reveal requires a separate owner confirmation and expires after 10 seconds. Changes use a private input and encrypted recovery. Save with the editor's normal Save command.</p>${rows || "<p>No supported fields.</p>"}<p>Original files remain available to other tools with direct filesystem access.</p><script nonce="${nonce}">const api=acquireVsCodeApi();document.addEventListener('click',event=>{const button=event.target.closest('button[data-action]');if(!button)return;api.postMessage({type:button.dataset.action,session:document.body.dataset.session,revision:Number(document.body.dataset.revision),field:button.closest('[data-field]').dataset.field});});window.addEventListener('message',event=>{const message=event.data;if(message&&message.type==='owner-value'&&message.session===document.body.dataset.session&&Number.isSafeInteger(message.revision)&&message.revision===Number(document.body.dataset.revision)&&typeof message.value==='string'){const field=[...document.querySelectorAll('[data-field]')].find(item=>item.dataset.field===message.field);if(field)field.querySelector('.value').textContent=message.value;}});</script></body></html>`;
    }
    private binding(document: SecureEditorDocument, view: View, message: unknown): message is { type: "reveal" | "edit" | "hide"; session: string; revision: number; field: string } {
        if (!message || typeof message !== "object" || Array.isArray(message) || Object.getPrototypeOf(message) !== Object.prototype) return false;
        const value = message as Record<string, unknown>;
        return !view.disposed && !document.disposed && view.panel.visible && secureEditorEnabled() && !document.busy
            && Object.keys(value).length === 4 && Object.keys(value).every(key => ["type", "session", "revision", "field"].includes(key))
            && ["reveal", "edit", "hide"].includes(value.type as string) && value.session === view.session
            && value.revision === document.model.metadata().revision && document.model.metadata().fields.some(field => field.id === value.field);
    }
    private async receive(document: SecureEditorDocument, view: View, message: unknown): Promise<void> {
        if (!this.binding(document, view, message)) return;
        if (message.type === "hide") { this.maskView(document, view); return; }
        document.busy = true; document.activeEpoch = document.epoch;
        try {
            const before = await this.current(document); if (before.identity !== document.basis.identity || before.digest !== document.basis.digest) unavailable();
            const revision = document.model.metadata().revision, session = message.session, field = document.model.metadata().fields.find(item => item.id === message.field)!;
            const live = () => { if (view.disposed || !view.panel.visible || view.session !== session || revision !== document.model.metadata().revision) unavailable(); this.alive(document); };
            live();
            if (message.type === "reveal") {
                const accepted = await vscode.window.showWarningMessage(`Reveal the private value of ${field.name} in this owner editor for 10 seconds? Other tools can still read the original file directly.`, { modal: true }, "Reveal value");
                if (accepted !== "Reveal value") return;
                const after = await this.current(document);
                live(); if (after.identity !== before.identity || after.digest !== before.digest) unavailable();
                this.maskView(document, view);
                const deliverySession = view.session;
                await view.panel.webview.postMessage({ type: "owner-value", session: deliverySession, revision, field: field.id, value: document.model.readOwnerValue(field.id) });
                if (view.disposed || !view.panel.visible || deliverySession !== view.session || !secureEditorEnabled()) { this.maskView(document, view); return; }
                view.timer = setTimeout(() => this.maskView(document, view), 10000);
            } else {
                if (!field.editable) return;
                const value = await vscode.window.showInputBox({ title: `Change ${field.name}`, prompt: "Enter a replacement value. The previous value stays withheld.", password: true, ignoreFocusOut: false });
                if (value === undefined) return;
                const after = await this.current(document);
                live(); if (after.identity !== before.identity || after.digest !== before.digest) unavailable();
                const oldText = document.model.snapshotForStorage(), candidate = new SecureEditorModel(oldText, ENV.test(path.basename(document.uri.fsPath)));
                candidate.applyOwnerValue(field.id, value); const nextText = candidate.snapshotForStorage();
                const previous = document.implicit, recovery = await this.createBackup(document, nextText, "implicit");
                try { const final = await this.current(document); live(); if (final.identity !== before.identity || final.digest !== before.digest) unavailable(); }
                catch (error) { await recovery.delete(); throw error; }
                document.implicit = recovery;
                document.model.restoreFromStorage(nextText); this.mask(document);
                this.changed.fire({ document, label: "Change secure field", undo: () => this.history(document, oldText), redo: () => this.history(document, nextText) });
                if (previous) { try { await previous.delete(); } catch { /* Retain the exact old issued record if release fails. */ } }
            }
        } catch { this.mask(document); void vscode.window.showWarningMessage("Secure editor operation was withheld. Check workspace trust, saved-file changes and encrypted recovery availability."); }
        finally { document.busy = false; document.activeEpoch = undefined; }
    }
    private async locked<T>(document: SecureEditorDocument, token: vscode.CancellationToken | undefined, action: () => Promise<T>): Promise<T> {
        this.alive(document, token); if (document.busy) unavailable(); document.busy = true; document.activeEpoch = document.epoch;
        try { return await action(); } finally { document.busy = false; document.activeEpoch = undefined; }
    }
    private async history(document: SecureEditorDocument, text: string): Promise<void> {
        await this.locked(document, undefined, async () => {
            const before = await this.current(document), previous = document.implicit, recovery = await this.createBackup(document, text, "implicit");
            try { const final = await this.current(document); if (final.identity !== before.identity || final.digest !== before.digest) unavailable(); this.alive(document); }
            catch (error) { await recovery.delete(); throw error; }
            document.implicit = recovery; document.model.restoreFromStorage(text); this.mask(document);
            if (previous) { try { await previous.delete(); } catch { /* Retain issued recovery on cleanup failure. */ } }
        });
    }
    async saveCustomDocument(document: SecureEditorDocument, token: vscode.CancellationToken): Promise<void> {
        await this.locked(document, token, async () => {
            let before = await this.current(document);
            if (JSON.stringify([before.identity, before.digest]) !== document.savedIdentity) {
                if (!document.recovered) unavailable();
                const accepted = await vscode.window.showWarningMessage("The original file differs from this encrypted recovery. Replace it with the recovered private draft? Review the saved-file conflict before continuing.", { modal: true }, "Save recovered draft");
                if (accepted !== "Save recovered draft") unavailable();
                const after = await this.current(document); if (after.identity !== before.identity || after.digest !== before.digest) unavailable(); before = after;
            }
            const text = document.model.snapshotForStorage(), revision = document.model.metadata().revision;
            await this.implicitBackup(document, text); this.alive(document, token);
            await this.pendingWrite(document, async () => {
                const fresh = await this.current(document); if (fresh.identity !== before.identity || fresh.digest !== before.digest) unavailable();
                const handle = await open(document.uri.fsPath, constants.O_RDWR | (constants.O_NOFOLLOW ?? 0));
                try {
                    if (identity(await handle.stat()) !== before.identity) unavailable();
                    this.alive(document, token); if (revision !== document.model.metadata().revision) unavailable();
                    await handle.writeFile(text, "utf8"); await handle.truncate(Buffer.byteLength(text)); await handle.sync();
                    if (identity(await lstat(document.uri.fsPath)) !== identity(await handle.stat())) unavailable();
                } finally { await handle.close(); }
            }, path.relative(vscode.Uri.parse(before.root).fsPath, document.uri.fsPath).replace(/\\/g, "/"));
            const after = await this.current(document); if (after.digest !== digest(text) || revision !== document.model.metadata().revision) unavailable();
            this.alive(document, token);
            document.savedText = text; document.basis = after; document.savedIdentity = JSON.stringify([after.identity, after.digest]); document.recovered = false; this.mask(document);
            await this.clearImplicit(document);
        });
    }
    async revertCustomDocument(document: SecureEditorDocument, token: vscode.CancellationToken): Promise<void> {
        await this.locked(document, token, async () => { const basis = await this.current(document), text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(basis.bytes);
            const candidate = new SecureEditorModel(text, ENV.test(path.basename(document.uri.fsPath))); this.alive(document, token);
            document.model.restoreFromStorage(candidate.snapshotForStorage()); document.basis = basis; document.savedText = text;
            document.savedIdentity = JSON.stringify([basis.identity, basis.digest]); document.recovered = false; this.mask(document); await this.clearImplicit(document); });
    }
    async saveCustomDocumentAs(document: SecureEditorDocument, destination: vscode.Uri, token: vscode.CancellationToken): Promise<void> {
        await this.locked(document, token, async () => {
            const before = await this.current(document), revision = document.model.metadata().revision;
            if (before.identity !== document.basis.identity || before.digest !== document.basis.digest) unavailable();
            const folder = vscode.workspace.getWorkspaceFolder(destination);
            if (!(destination instanceof vscode.Uri) || destination.scheme !== "file" || destination.query || destination.fragment || !folder || folder.uri.toString() !== document.basis.root || !ENV.test(path.basename(destination.fsPath))) unavailable();
            const target = await assertWorkspaceOutputUri(destination); if (!samePath(target, destination.fsPath)) unavailable();
            if (await lstat(target).then(() => true, error => { if (error.code === "ENOENT") return false; throw error; })) unavailable();
            const accepted = await vscode.window.showWarningMessage("Create a new sensitive environment file in this project using the private draft? The original file remains saved separately.", { modal: true }, "Create sensitive copy");
            if (accepted !== "Create sensitive copy") unavailable();
            const afterReview = await this.current(document); if (afterReview.identity !== before.identity || afterReview.digest !== before.digest || revision !== document.model.metadata().revision) unavailable();
            const text = document.model.snapshotForStorage(); await this.implicitBackup(document, text); this.alive(document, token);
            const fresh = await this.current(document); if (fresh.identity !== before.identity || fresh.digest !== before.digest) unavailable();
            if (!samePath(await assertWorkspaceOutputUri(destination), target)) unavailable();
            await this.pendingWrite(document, async () => {
                this.alive(document, token);
                const handle = await open(target, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
                try { this.alive(document, token); await handle.writeFile(text, "utf8"); await handle.sync(); } finally { await handle.close(); }
            }, path.relative(folder.uri.fsPath, target).replace(/\\/g, "/"));
            this.alive(document, token); const created = await this.inspect(destination), source = await this.current(document);
            if (created.root !== before.root || created.digest !== digest(text) || source.identity !== before.identity || source.digest !== before.digest || revision !== document.model.metadata().revision) unavailable(); this.mask(document);
        });
    }
    private records(source: vscode.Uri, root: string): BackupRecord[] {
        return this.context.workspaceState.keys().filter(key => key.startsWith(RECORD_PREFIX)).slice(0, 4096)
            .map(key => this.context.workspaceState.get<BackupRecord>(key)).filter((record): record is BackupRecord => !!record && record.source === source.toString() && record.root === root);
    }
    private async clearImplicit(document: SecureEditorDocument): Promise<void> { const previous = document.implicit; if (previous) { await previous.delete(); document.implicit = undefined; } }
    private async implicitBackup(document: SecureEditorDocument, draft: string): Promise<void> {
        const previous = document.implicit, next = await this.createBackup(document, draft, "implicit"); document.implicit = next;
        if (previous) await previous.delete();
    }
    private async createBackup(document: SecureEditorDocument, draftText: string, kind: "implicit" | "native" = "native"): Promise<vscode.CustomDocumentBackup> {
        this.alive(document); const storage = this.context.storageUri;
        if (!storage || storage.scheme !== "file") unavailable();
        if (this.records(document.uri, document.basis.root).length >= 128) unavailable();
        const generation = randomUUID(), keyId = KEY_PREFIX + generation, key = randomBytes(32), encoded = key.toString("base64");
        try {
            await this.context.secrets.store(keyId, encoded); if (await this.context.secrets.get(keyId) !== encoded) unavailable();
            this.alive(document);
            await mkdir(storage.fsPath, { recursive: true });
            const id = path.join(storage.fsPath, "secure-editor-" + generation + ".json");
            await verifyOutputPath(storage.fsPath, id);
            const envelope = encryptEditorRecovery({ schemaVersion: 1, source: document.uri.toString(), root: document.basis.root,
                savedText: document.savedText, draftText, fileIdentity: document.savedIdentity }, key, { keyId });
            const handle = await open(id, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
            try { await handle.writeFile(envelope, "utf8"); await handle.sync(); } finally { await handle.close(); }
            const record: BackupRecord = { schemaVersion: 1, id, source: document.uri.toString(), root: document.basis.root, digest: digest(envelope), keyId, kind, createdAt: Date.now() };
            await this.context.workspaceState.update(RECORD_PREFIX + generation, record);
            if (JSON.stringify(this.context.workspaceState.get(RECORD_PREFIX + generation)) !== JSON.stringify(record)) unavailable();
            return { id, delete: () => this.release(id) };
        } finally { key.fill(0); }
    }
    async backupCustomDocument(document: SecureEditorDocument, _context: vscode.CustomDocumentBackupContext, token: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
        return this.locked(document, token, async () => { await this.current(document); this.alive(document, token); return this.createBackup(document, document.model.snapshotForStorage()); });
    }
    private async restore(id: string, source: vscode.Uri, root: string) {
        const storage = this.context.storageUri; if (!storage || typeof id !== "string" || !path.isAbsolute(id) || !samePath(path.dirname(id), storage.fsPath)) unavailable();
        const generation = /^secure-editor-(.+)\.json$/.exec(path.basename(id))?.[1]; if (!generation || !UUID.test(generation)) unavailable();
        const record = this.context.workspaceState.get<BackupRecord>(RECORD_PREFIX + generation);
        if (!record || Object.keys(record).sort().join() !== ["schemaVersion", "id", "source", "root", "digest", "keyId", "kind", "createdAt"].sort().join()
            || record.schemaVersion !== 1 || record.id !== id || record.source !== source.toString() || record.root !== root
            || record.keyId !== KEY_PREFIX + generation || !/^[a-f0-9]{64}$/.test(record.digest) || !["implicit", "native"].includes(record.kind) || !Number.isSafeInteger(record.createdAt)) unavailable();
        await verifyExistingPath(storage.fsPath, id); const stat = await lstat(id);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 524288) unavailable();
        const handle = await open(id, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)); let bytes: Buffer;
        try { if (identity(await handle.stat()) !== identity(stat)) unavailable(); bytes = await boundedRead(handle, 524288); if (identity(await handle.stat()) !== identity(stat) || identity(await lstat(id)) !== identity(stat)) unavailable(); }
        finally { await handle.close(); }
        if (digest(bytes) !== record.digest) unavailable();
        const encoded = await this.context.secrets.get(record.keyId);
        if (!encoded || !/^[A-Za-z0-9+/]{43}=$/.test(encoded)) unavailable(); const key = Buffer.from(encoded, "base64");
        try { return decryptEditorRecovery(new TextDecoder("utf-8", { fatal: true }).decode(bytes), key, { source: source.toString(), root, keyId: record.keyId }); }
        finally { key.fill(0); }
    }
    private async release(id: string): Promise<void> {
        const storage = this.context.storageUri, generation = /^secure-editor-(.+)\.json$/.exec(path.basename(id))?.[1];
        if (!storage || !generation || !UUID.test(generation) || !samePath(path.dirname(id), storage.fsPath)) unavailable();
        const record = this.context.workspaceState.get<BackupRecord>(RECORD_PREFIX + generation);
        if (!record || record.id !== id || record.keyId !== KEY_PREFIX + generation) unavailable();
        await this.restore(id, vscode.Uri.parse(record.source), record.root);
        await verifyExistingPath(storage.fsPath, id); await unlink(id); await this.context.secrets.delete(record.keyId); await this.context.workspaceState.update(RECORD_PREFIX + generation, undefined);
    }
}

export function registerSecureEditor(context: vscode.ExtensionContext): void {
    // Older test/API hosts may omit this API; managed readers keep their own independent gates.
    if (typeof vscode.window.registerCustomEditorProvider !== "function") return;
    const provider = new SecureEditorProvider(context), metadata = new Map<string, string>();
    const watcher = vscode.workspace.createFileSystemWatcher("**/*");
    context.subscriptions.push(watcher, watcher.onDidChange(uri => provider.sourceChanged(uri)), watcher.onDidDelete(uri => provider.sourceChanged(uri)), watcher.onDidCreate(uri => provider.sourceChanged(uri)));
    const uriFor = (value: unknown) => { const uri = vscode.Uri.parse("soterai-editor-settings:/" + randomUUID() + ".json"); metadata.set(uri.toString(), JSON.stringify(value, null, 2)); return uri; };
    context.subscriptions.push(provider, vscode.window.registerCustomEditorProvider(SECURE_EDITOR_VIEW_TYPE, provider, { supportsMultipleEditorsPerDocument: true }),
        vscode.workspace.registerTextDocumentContentProvider("soterai-editor-settings", { provideTextDocumentContent: uri => metadata.get(uri.toString()) ?? "Settings preview expired." }),
        onDidChangeBoundaryRules(() => provider.clearViews()), onDidChangeOwnerPolicySession(root => provider.ownerSessionChanged(root)), onDidChangeManualRestriction(() => provider.clearViews(false)),
        vscode.workspace.onDidChangeWorkspaceFolders(() => provider.clearViews()),
        vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration("soterai")) provider.clearViews(); }),
        vscode.window.onDidChangeWindowState(event => { if (!event.focused) provider.clearViews(); }),
        vscode.workspace.onDidOpenTextDocument(async document => {
            if (!secureEditorEnabled() || document.uri.scheme !== "file" || !vscode.workspace.getWorkspaceFolder(document.uri)) return;
            const boundary = await BoundarySnapshot.load(); if (!ENV.test(path.basename(document.uri.fsPath)) && !boundary.isSensitive(document.uri)) return;
            const selected = await vscode.window.showWarningMessage("A sensitive environment file is open as a plaintext editor buffer. Use the masked owner editor to keep values out of its default view. Direct filesystem tools can still read the original.", "Open masked editor");
            if (selected === "Open masked editor") { try { await provider.validate(document.uri); await vscode.commands.executeCommand("vscode.openWith", document.uri, SECURE_EDITOR_VIEW_TYPE); } catch { /* No plaintext read for this warning. */ } }
        }));
    const reg = (id: string, handler: (...args: unknown[]) => unknown) => context.subscriptions.push(vscode.commands.registerCommand(id, handler));
    reg("soterai.openSecureEditor", async (argument?: unknown) => {
        if (!secureEditorEnabled()) return { status: "UNAVAILABLE" };
        const uri = argument instanceof vscode.Uri ? argument : (await vscode.window.showOpenDialog({ canSelectFiles: true, canSelectMany: false, openLabel: "Open masked editor" }))?.[0];
        if (!uri) return { status: "CANCELLED" };
        try { await provider.validate(uri); await vscode.commands.executeCommand("vscode.openWith", uri, SECURE_EDITOR_VIEW_TYPE); return { status: "OPENED" }; } catch { return { status: "FAILED" }; }
    });
    let associationBusy = false;
    const association = async (undo: boolean) => {
        if (!secureEditorEnabled()) return { status: "UNAVAILABLE" };
        if (associationBusy) return { status: "FAILED" }; associationBusy = true;
        try {
            const folder = await vscode.window.showWorkspaceFolderPick({ placeHolder: "Choose the project for masked environment editors" }); if (!folder) return { status: "CANCELLED" };
            const root = folder.uri.toString(); if (folder.uri.scheme !== "file") unavailable(); await BoundarySnapshot.load();
            const config = vscode.workspace.getConfiguration("workbench", folder.uri), target = (vscode.workspace.workspaceFolders?.length ?? 0) > 1 ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace;
            const inspected = config.inspect<Record<string, string>>("editorAssociations");
            const before = { ...(target === vscode.ConfigurationTarget.WorkspaceFolder ? inspected?.workspaceFolderValue : inspected?.workspaceValue) ?? {} };
            const patterns = SENSITIVE_FILE_GLOBS.filter(pattern => pattern.endsWith("/.env") || pattern.endsWith("/.env.*")), next = { ...before }, key = ASSOCIATIONS + ":" + root;
            if (patterns.length !== 2) unavailable();
            const old = context.workspaceState.get<{ schemaVersion: number; root: string; target: number; before: Record<string, string | null> }>(key);
            if (undo) {
                if (!old || old.schemaVersion !== 1 || old.root !== root || old.target !== target || patterns.some(pattern => before[pattern] !== SECURE_EDITOR_VIEW_TYPE)) unavailable();
                for (const pattern of patterns) { if (old.before[pattern] === null) delete next[pattern]; else next[pattern] = old.before[pattern]; }
            } else {
                if (old && patterns.some(pattern => before[pattern] !== old.before[pattern] && !(before[pattern] === undefined && old.before[pattern] === null))) unavailable();
                for (const pattern of patterns) next[pattern] = SECURE_EDITOR_VIEW_TYPE;
            }
            await vscode.commands.executeCommand("vscode.diff", uriFor(before), uriFor(next), "Review project editor associations");
            const action = undo ? "Restore project associations" : "Use masked environment editor";
            if (await vscode.window.showWarningMessage("Apply these reviewed editor associations only to the selected project? Unrelated editor mappings remain.", { modal: true }, action) !== action) return { status: "CANCELLED" };
            if (!secureEditorEnabled() || !vscode.workspace.workspaceFolders?.some(value => value.uri.toString() === root)
                || JSON.stringify((target === vscode.ConfigurationTarget.WorkspaceFolder ? config.inspect<Record<string, string>>("editorAssociations")?.workspaceFolderValue : config.inspect<Record<string, string>>("editorAssociations")?.workspaceValue) ?? {}) !== JSON.stringify(before)) unavailable();
            if (!undo) await context.workspaceState.update(key, { schemaVersion: 1, root, target, before: Object.fromEntries(patterns.map(pattern => [pattern, before[pattern] ?? null])) });
            await config.update("editorAssociations", next, target);
            const actual = (target === vscode.ConfigurationTarget.WorkspaceFolder ? config.inspect<Record<string, string>>("editorAssociations")?.workspaceFolderValue : config.inspect<Record<string, string>>("editorAssociations")?.workspaceValue) ?? {};
            if (patterns.some(pattern => actual[pattern] !== next[pattern]) || !secureEditorEnabled() || !vscode.workspace.workspaceFolders?.some(value => value.uri.toString() === root)) unavailable();
            if (undo) await context.workspaceState.update(key, undefined);
            return { status: "SAVED" };
        } catch { return { status: "FAILED" }; } finally { associationBusy = false; }
    };
    reg("soterai.configureSecureEditorAssociation", () => association(false)); reg("soterai.undoSecureEditorAssociation", () => association(true));
}
