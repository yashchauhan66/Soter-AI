import * as vscode from "vscode";
import * as path from "node:path";
import { lstat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { BoundarySnapshot } from "../ai-boundary/BoundarySnapshot";
import { readBoundaryFile } from "../ai-boundary/readFile";
import { assertWorkspaceFileUri } from "../security/WorkspacePathGuard";
import { fileIdentity } from "../firewall/VaultStorage";
import { managedRootIdentity, managedPolicyBinding, managedPathIdentity } from "../terminal/ManagedOutputBinding";
import { runtimePolicyBinding } from "../vault-runtime/RuntimeBinding";
import { HygieneExposureLedger, HYGIENE_LEDGER_KEY } from "../hygiene/HygieneExposureLedger";
import { hygieneAssistantEnabled } from "../hygiene/HygieneFlags";
import type { HygieneFinding } from "../hygiene/HygieneAnalysis";
import { publicationRelativePath } from "../project-privacy/publication/PublicationPaths";
import { artifactViews, ARTIFACT_LIMITS, ARTIFACT_SCOPE } from "./ArtifactContent";
import { artifactScannerEnabled } from "./ArtifactFlags";

type Analyzer = Awaited<ReturnType<HygieneExposureLedger["createAnalyzer"]>>;
interface Stamp { uri: vscode.Uri; relative: string; identity: string; size: number }
export interface ArtifactScanResult { readonly status: "ANALYZED" | "PARTIAL"; readonly files: number;
    readonly skipped: number; readonly findings: readonly HygieneFinding[]; readonly scope: string }
const unavailable = () => Object.freeze({ status: "UNAVAILABLE" as const });
const digest = (text: string) => createHash("sha256").update(text).digest("hex");

/** Owner-reviewed bounded saved-file scanning. No cleanup, migration,
 * original-document UI, build, reference resolution or process launch. */
export class ArtifactController implements vscode.Disposable {
    #ledger: HygieneExposureLedger; #listeners: vscode.Disposable[];
    #epoch = 0; #disposed = false; #busy = false; #analyzer?: Analyzer;
    #published?: Readonly<ArtifactScanResult>; #check?: () => boolean;
    constructor(context: vscode.ExtensionContext, private readonly options: { now?: () => number } = {}) {
        this.#ledger = new HygieneExposureLedger(context.globalState, context.secrets);
        this.#listeners = [vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration("soterai")) this.withdraw();
        }), vscode.workspace.onDidChangeWorkspaceFolders(() => this.withdraw()), context.secrets.onDidChange(event => {
            if (event.key !== HYGIENE_LEDGER_KEY) return;
            this.#published = undefined; this.#check = undefined;
            const captured = this.#analyzer;
            if (captured) void captured.current().then(current => {
                if (!current && this.#analyzer === captured) this.withdraw();
            }, () => { if (this.#analyzer === captured) this.withdraw(); });
        })];
    }
    #root(): vscode.Uri {
        const folders = vscode.workspace.workspaceFolders;
        if (!vscode.workspace.isTrusted || vscode.env.remoteName || folders?.length !== 1) throw Error();
        const root = folders[0].uri;
        if (!(root instanceof vscode.Uri) || root.scheme !== "file" || root.authority || root.query || root.fragment) throw Error();
        return root;
    }
    #available(): boolean {
        try { this.#root(); return !this.#disposed && process.platform === "win32" && artifactScannerEnabled() && hygieneAssistantEnabled(); }
        catch { return false; }
    }
    status() { return { status: this.#available() ? "OWNER_REVIEW_REQUIRED" as const : "UNAVAILABLE" as const,
        busy: this.#busy, scope: ARTIFACT_SCOPE }; }
    withdraw(): void {
        this.#epoch++; this.#published = undefined; this.#check = undefined;
        this.#analyzer?.dispose(); this.#analyzer = undefined;
    }
    current(value: unknown): boolean {
        if (value === undefined || value !== this.#published || !this.#check) return false;
        try { if (this.#check()) return true; } catch { /* Generic withholding. */ }
        this.withdraw(); return false;
    }
    dispose(): void { this.#disposed = true; this.withdraw(); this.#listeners.forEach(item => item.dispose()); }
    async #stamp(root: vscode.Uri, uri: vscode.Uri): Promise<Stamp> {
        if (!(uri instanceof vscode.Uri) || uri.scheme !== "file" || uri.authority || uri.query || uri.fragment
            || vscode.workspace.getWorkspaceFolder(uri)?.uri.toString() !== root.toString()) throw Error();
        const relative = publicationRelativePath(path.relative(root.fsPath, uri.fsPath).replaceAll("\\", "/"));
        const canonical = await assertWorkspaceFileUri(uri);
        const spelling = (name: string) => path.resolve(name).replace(/^[a-z]:/i, drive => drive.toUpperCase());
        if (spelling(canonical) !== spelling(uri.fsPath)) throw Error();
        const stat = await lstat(uri.fsPath);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || !Number.isSafeInteger(stat.size)) throw Error();
        return { uri, relative, identity: fileIdentity(stat), size: stat.size };
    }
    review(): Promise<Readonly<ArtifactScanResult> | { status: "CANCELLED" | "UNAVAILABLE" }> {
        if (this.#busy || !this.#available()) return Promise.resolve(unavailable());
        this.withdraw(); this.#busy = true; let timer: ReturnType<typeof setTimeout> | undefined;
        const operation = this.#review().catch(() => { this.withdraw(); return unavailable(); })
            .finally(() => { clearTimeout(timer); this.#busy = false; });
        const expiry = new Promise<ReturnType<typeof unavailable>>(resolve => {
            timer = setTimeout(() => { this.withdraw(); resolve(unavailable()); }, ARTIFACT_LIMITS.milliseconds); timer.unref?.();
        });
        return Promise.race([operation, expiry]);
    }
    async #review(): Promise<Readonly<ArtifactScanResult> | { status: "CANCELLED" | "UNAVAILABLE" }> {
        const root = this.#root(), epoch = this.#epoch, clock = this.options.now ?? (() => performance.now());
        const start = clock(), deadline = start + ARTIFACT_LIMITS.milliseconds;
        const rootIdentity = managedRootIdentity(root), approvalPolicy = managedPolicyBinding(root), sourcePolicy = runtimePolicyBinding(root.fsPath);
        let policy: string | undefined, last = start, alive = Number.isFinite(start);
        const admitted: Array<{ stamp: Stamp; hash: string }> = [];
        const valid = () => {
            if (!alive) return false;
            try {
                const now = clock(); alive = Number.isFinite(now) && now >= last && now >= start && now < deadline
                    && this.#available() && this.#epoch === epoch && this.#root().toString() === root.toString()
                    && managedRootIdentity(root) === rootIdentity && runtimePolicyBinding(root.fsPath) === sourcePolicy
                    && (policy === undefined || managedPolicyBinding(root) === policy)
                    && admitted.every(row => managedPathIdentity(root.fsPath, row.stamp.uri.fsPath, false) === row.stamp.identity);
                last = now;
            } catch { alive = false; }
            return alive;
        };
        const check = () => { if (!valid()) throw Error(); };
        check();
        const discovered = await vscode.workspace.findFiles(new vscode.RelativePattern(root.fsPath, "**/*"), "**/{.git,node_modules}/**", ARTIFACT_LIMITS.files + 1);
        check();
        const unique = [...new Map(discovered.map(uri => [uri.toString(), uri])).values()];
        let skipped = unique.length > ARTIFACT_LIMITS.files ? 1 : 0;
        const stamps: Stamp[] = [];
        for (const uri of unique.slice(0, ARTIFACT_LIMITS.files)) { stamps.push(await this.#stamp(root, uri)); check(); }
        const action = "Analyze local artifacts";
        const choice = await vscode.window.showWarningMessage("Analyze saved local artifacts and copies?", { modal: true,
            detail: "Review up to128 regular saved files including generated folders/copies,64KiB each and1MiB within60seconds. Finite v3 embedded source-map content is parsed locally; no reference, build, script or provider is executed. Unsupported inputs/caps remain partial. Findings contain keyed possible-exposure metadata only. Review cleanup/exclusion and rotation manually; copies cannot be recalled. Maps and mapping-URL files are withheld from public release." }, action);
        check(); if (managedPolicyBinding(root) !== approvalPolicy) throw Error();
        if (choice !== action) return { status: "CANCELLED" };
        await BoundarySnapshot.load(); check(); policy = managedPolicyBinding(root); check();
        for (const stamp of stamps) { if ((await this.#stamp(root, stamp.uri)).identity !== stamp.identity) throw Error(); check(); }
        const analyzer = await this.#ledger.createAnalyzer(root.toString(), "artifact-v1"); this.#analyzer = analyzer;
        check(); if (!await analyzer.current()) throw Error(); check();
        const findings: HygieneFinding[] = []; let files = 0, bytes = 0;
        for (const stamp of stamps) {
            check();
            if (stamp.size > ARTIFACT_LIMITS.fileBytes || bytes + stamp.size > ARTIFACT_LIMITS.totalBytes) { skipped++; continue; }
            if ((await this.#stamp(root, stamp.uri)).identity !== stamp.identity) throw Error(); check();
            let text: string;
            try { text = await readBoundaryFile(root.fsPath, stamp.uri.fsPath, ARTIFACT_LIMITS.fileBytes); }
            catch { check(); if ((await this.#stamp(root, stamp.uri)).identity !== stamp.identity) throw Error(); check(); skipped++; continue; }
            check(); if (!await analyzer.current()) throw Error(); check();
            if ((await this.#stamp(root, stamp.uri)).identity !== stamp.identity) throw Error(); check();
            bytes += Buffer.byteLength(text); admitted.push({ stamp, hash: digest(text) });
            let parsed: ReturnType<typeof artifactViews>;
            try { parsed = artifactViews(stamp.relative, text); }
            catch { skipped++; continue; }
            const pending: HygieneFinding[] = [];
            try {
                for (const view of parsed.views) {
                    check(); const input = { source: view.source, text: view.text, environment: false };
                    const analysis = view.mode === "source" ? analyzer.analyzeSource(input) : analyzer.analyze(input);
                    pending.push(...analysis.findings); check();
                    if (pending.length + findings.length > 128) throw Error();
                }
            } catch { check(); skipped++; continue; }
            findings.push(...pending); files++;
        }
        for (const row of admitted) {
            check(); const fresh = await readBoundaryFile(root.fsPath, row.stamp.uri.fsPath, ARTIFACT_LIMITS.fileBytes); check();
            if (digest(fresh) !== row.hash || (await this.#stamp(root, row.stamp.uri)).identity !== row.stamp.identity) throw Error(); check();
        }
        if (!await analyzer.current()) throw Error(); check();
        await this.#ledger.record(root.toString(), findings, "possible-project-exposure"); check();
        if (!await analyzer.current()) throw Error(); check();
        const result: Readonly<ArtifactScanResult> = Object.freeze({ status: skipped ? "PARTIAL" : "ANALYZED", files, skipped,
            findings: Object.freeze(findings), scope: ARTIFACT_SCOPE });
        this.#published = result; this.#check = valid; return result;
    }
}
