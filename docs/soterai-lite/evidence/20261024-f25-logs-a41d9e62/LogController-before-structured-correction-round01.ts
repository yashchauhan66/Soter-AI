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
import { logContentViews, LOG_LIMITS, LOG_SCOPE } from "./LogContent";
import { logProtectionEnabled } from "./LogFlags";

type Analyzer = Awaited<ReturnType<HygieneExposureLedger["createAnalyzer"]>>;
interface Stamp { uri: vscode.Uri; relative: string; identity: string; size: number }
export interface LogScanResult { readonly status: "ANALYZED" | "PARTIAL"; readonly files: number;
    readonly skipped: number; readonly findings: readonly HygieneFinding[]; readonly scope: string }
const unavailable = () => Object.freeze({ status: "UNAVAILABLE" as const });
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
// These are policy/editor/store surfaces handled by their own reviewed flows.
// Count omissions explicitly; publication keeps its separate strict deny list.
const excluded = /(?:^|\/)(?:\.git|node_modules|\.soterai|\.codex|\.claude|\.cline|\.ssh|\.aws|\.azure|\.gnupg|\.docker|\.kube|\.vscode|\.history)(?:\/|$)|(?:^|\/)(?:\.aiignore|\.soterai-policy\.json|\.npmrc|\.yarnrc|\.netrc|\.gitconfig|\.git-credentials|\.bash_history|\.zsh_history|\.python_history|\.pgpass|\.pypirc|auth-token|control-auth-token|credentials|credentials\.json)$/i;

/** Owner-reviewed bounded saved-file scanning. No cleanup, migration,
 * original-document UI, build, reference resolution or process launch. */
export class LogController implements vscode.Disposable {
    #ledger: HygieneExposureLedger; #listeners: vscode.Disposable[];
    #epoch = 0; #disposed = false; #busy = false; #analyzer?: Analyzer;
    #published?: Readonly<LogScanResult>; #check?: () => boolean;
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
        try { this.#root(); return !this.#disposed && process.platform === "win32" && logProtectionEnabled() && hygieneAssistantEnabled(); }
        catch { return false; }
    }
    status() { return { status: this.#available() ? "OWNER_REVIEW_REQUIRED" as const : "UNAVAILABLE" as const,
        busy: this.#busy, scope: LOG_SCOPE }; }
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
    review(): Promise<Readonly<LogScanResult> | { status: "CANCELLED" | "UNAVAILABLE" }> {
        if (this.#busy || !this.#available()) return Promise.resolve(unavailable());
        this.withdraw(); this.#busy = true; let timer: ReturnType<typeof setTimeout> | undefined;
        const operation = this.#review().catch(() => { this.withdraw(); return unavailable(); })
            .finally(() => { clearTimeout(timer); this.#busy = false; });
        const expiry = new Promise<ReturnType<typeof unavailable>>(resolve => {
            timer = setTimeout(() => { this.withdraw(); resolve(unavailable()); }, LOG_LIMITS.milliseconds); timer.unref?.();
        });
        return Promise.race([operation, expiry]);
    }
    async #review(): Promise<Readonly<LogScanResult> | { status: "CANCELLED" | "UNAVAILABLE" }> {
        const root = this.#root(), epoch = this.#epoch, clock = this.options.now ?? (() => performance.now());
        const start = clock(), deadline = start + LOG_LIMITS.milliseconds;
        const rootIdentity = managedRootIdentity(root), approvalPolicy = managedPolicyBinding(root), sourcePolicy = runtimePolicyBinding(root.fsPath);
        let policy: string | undefined, last = start, alive = Number.isFinite(start), publishing = false;
        const admitted: Array<{ stamp: Stamp; hash: string }> = [];
        const valid = () => {
            if (!alive) return false;
            try {
                const now = clock(); alive = Number.isFinite(now) && now >= last && now >= start && now < deadline
                    && this.#available() && this.#epoch === epoch && this.#root().toString() === root.toString()
                    && managedRootIdentity(root) === rootIdentity && runtimePolicyBinding(root.fsPath) === sourcePolicy
                    && (policy === undefined || managedPolicyBinding(root) === policy)
                    && (!publishing || admitted.every(row => managedPathIdentity(root.fsPath, row.stamp.uri.fsPath, false) === row.stamp.identity));
                last = now;
            } catch { alive = false; }
            return alive;
        };
        const check = () => { if (!valid()) throw Error(); };
        check();
        const action = "Analyze saved logs";
        const choice = await vscode.window.showWarningMessage("Analyze saved local logs and test reports?", { modal: true,
            detail: "Review up to128 regular saved files,64KiB each and1MiB within60seconds. Plain failures and strict bounded JSON/JSONL are analyzed locally. No log, script, reference, test or provider is executed. Keyed possible-exposure metadata only; caps and unsupported inputs stay partial. Review cleanup and rotation manually. Original logs and earlier disclosures remain reachable." }, action);
        check(); if (managedPolicyBinding(root) !== approvalPolicy) throw Error();
        if (choice !== action) return { status: "CANCELLED" };
        const discovered = await vscode.workspace.findFiles(new vscode.RelativePattern(root.fsPath, "**/*"), "**/{.git,node_modules}/**", LOG_LIMITS.files + 1);
        check();
        const unique = [...new Map(discovered.map(uri => [uri.toString(), uri])).values()];
        let skipped = unique.length > LOG_LIMITS.files ? 1 : 0;
        const stamps: Stamp[] = [];
        for (const uri of unique.slice(0, LOG_LIMITS.files)) {
            if (!(uri instanceof vscode.Uri) || uri.scheme !== "file" || uri.authority || uri.query || uri.fragment
                || vscode.workspace.getWorkspaceFolder(uri)?.uri.toString() !== root.toString()) throw Error();
            const relative = path.relative(root.fsPath, uri.fsPath).replaceAll("\\", "/");
            if (excluded.test(relative)) { skipped++; continue; }
            stamps.push(await this.#stamp(root, uri)); check();
        }
        await BoundarySnapshot.load(); check(); policy = managedPolicyBinding(root); check();
        for (const stamp of stamps) { if ((await this.#stamp(root, stamp.uri)).identity !== stamp.identity) throw Error(); check(); }
        const analyzer = await this.#ledger.createAnalyzer(root.toString(), "logs-v1"); this.#analyzer = analyzer;
        check(); if (!await analyzer.current()) throw Error(); check();
        const findings: HygieneFinding[] = []; let files = 0, bytes = 0;
        for (const stamp of stamps) {
            check();
            if (stamp.size > LOG_LIMITS.fileBytes || bytes + stamp.size > LOG_LIMITS.totalBytes) { skipped++; continue; }
            if ((await this.#stamp(root, stamp.uri)).identity !== stamp.identity) throw Error(); check();
            let text: string;
            try { text = await readBoundaryFile(root.fsPath, stamp.uri.fsPath, LOG_LIMITS.fileBytes); }
            catch { check(); if ((await this.#stamp(root, stamp.uri)).identity !== stamp.identity) throw Error(); check(); skipped++; continue; }
            check(); if (!await analyzer.current()) throw Error(); check();
            if ((await this.#stamp(root, stamp.uri)).identity !== stamp.identity) throw Error(); check();
            bytes += Buffer.byteLength(text); admitted.push({ stamp, hash: digest(text) });
            let parsed: ReturnType<typeof logContentViews>;
            try { parsed = logContentViews(stamp.relative, text); }
            catch { skipped++; continue; }
            if (parsed.status !== "ANALYZED") { skipped++; continue; }
            const pending: HygieneFinding[] = [], seenValues = new Set<string>();
            try {
                const views = parsed.kind === "TEXT" ? parsed.views : [
                    { relativePath: stamp.relative + "/raw.txt", text, language: "text" as const }, ...parsed.views,
                    ...(parsed.views.length > 1 ? [{ relativePath: stamp.relative + "/joined.txt", text: parsed.views.map(view => view.text).join(""), language: "text" as const }] : []),
                ];
                for (const view of views) {
                    check(); const analysis = analyzer.analyze({ source: view.relativePath, text: view.text, environment: false });
                    for (const finding of analysis.findings) {
                        if (seenValues.has(finding.valueRef)) continue;
                        seenValues.add(finding.valueRef); pending.push(finding);
                    }
                    check(); if (pending.length + findings.length > 128) throw Error();
                }
            } catch { check(); skipped++; continue; }
            findings.push(...pending); files++;
        }
        for (const row of admitted) {
            check(); const fresh = await readBoundaryFile(root.fsPath, row.stamp.uri.fsPath, LOG_LIMITS.fileBytes); check();
            if (digest(fresh) !== row.hash || (await this.#stamp(root, row.stamp.uri)).identity !== row.stamp.identity) throw Error(); check();
        }
        // Individual files are guarded around their private reads. Verify the
        // whole captured set at the publication boundary, rather than doing
        // a quadratic number of canonical ancestor walks during every read.
        publishing = true; check();
        if (!await analyzer.current()) throw Error(); check();
        await this.#ledger.record(root.toString(), findings, "possible-project-exposure"); check();
        if (!await analyzer.current()) throw Error(); check();
        const result: Readonly<LogScanResult> = Object.freeze({ status: skipped ? "PARTIAL" : "ANALYZED", files, skipped,
            findings: Object.freeze(findings), scope: LOG_SCOPE });
        this.#published = result; this.#check = valid; return result;
    }
}
