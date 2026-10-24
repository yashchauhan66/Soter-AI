import * as vscode from "vscode";
import { BoundarySnapshot } from "../ai-boundary/BoundarySnapshot";
import { managedRootIdentity, managedPolicyBinding } from "../terminal/ManagedOutputBinding";
import { runtimePolicyBinding } from "../vault-runtime/RuntimeBinding";
import { prepareCheckedGitMetadata, type CheckedGitMetadata } from "../terminal/CheckedGitMetadata";
import { hygieneAssistantEnabled } from "../hygiene/HygieneFlags";
import { HygieneExposureLedger, HYGIENE_LEDGER_KEY } from "../hygiene/HygieneExposureLedger";
import { historyScannerEnabled } from "./HistoryFlags";
import { HistoryGitProcess } from "./HistoryGitProcess";
import { scanGitHistory, HISTORY_SCOPE, type HistoryScanResult } from "./HistoryScanner";
import { HISTORY_LIMITS } from "./GitHistoryProtocol";

type Analyzer = Awaited<ReturnType<HygieneExposureLedger["createAnalyzer"]>>;
const unavailable = () => Object.freeze({ status: "UNAVAILABLE" as const });

/** Native owner consent for bounded private history analysis. Public commands
 * cannot supply a root, descriptor, ref, object, analyzer or approval. */
export class HistoryController implements vscode.Disposable {
    #ledger: HygieneExposureLedger; #listeners: vscode.Disposable[];
    #epoch = 0; #disposed = false; #busy = false; #worker?: HistoryGitProcess;
    #analyzer?: Analyzer; #published?: Readonly<HistoryScanResult>; #check?: () => boolean;
    constructor(context: vscode.ExtensionContext, private readonly options: { now?: () => number } = {}) {
        this.#ledger = new HygieneExposureLedger(context.globalState, context.secrets);
        this.#listeners = [vscode.workspace.onDidChangeConfiguration(e => { if (e.affectsConfiguration("soterai")) this.withdraw(); }),
            vscode.workspace.onDidChangeWorkspaceFolders(() => this.withdraw()), context.secrets.onDidChange(e => {
                const captured = this.#analyzer;
                if (e.key === HYGIENE_LEDGER_KEY && captured) void captured.current().then(current => {
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
        try { this.#root(); return !this.#disposed && process.platform === "win32" && historyScannerEnabled() && hygieneAssistantEnabled(); }
        catch { return false; }
    }
    status(): { status: "OWNER_REVIEW_REQUIRED" | "UNAVAILABLE"; busy: boolean; scope: string } {
        return { status: this.#available() ? "OWNER_REVIEW_REQUIRED" : "UNAVAILABLE", busy: this.#busy, scope: HISTORY_SCOPE };
    }
    current(value: unknown): boolean {
        if (value === undefined || value !== this.#published || !this.#check) return false;
        try { if (this.#check()) return true; } catch { /* Generic withholding below. */ }
        this.withdraw(); return false;
    }
    withdraw(): void {
        this.#epoch++; this.#published = undefined; this.#check = undefined;
        this.#analyzer?.dispose(); this.#analyzer = undefined; this.#worker?.withdraw();
    }
    dispose(): void { this.#disposed = true; this.withdraw(); this.#listeners.forEach(listener => listener.dispose()); }
    #finish(): void {
        const worker = this.#worker;
        if (worker?.busy) {
            void worker.closed.then(() => { if (this.#worker === worker) { this.#worker = undefined; this.#busy = false; } });
        } else { this.#worker = undefined; this.#busy = false; }
    }
    review(): Promise<Readonly<HistoryScanResult> | { status: "CANCELLED" | "UNAVAILABLE" }> {
        if (this.#busy || !this.#available()) return Promise.resolve(unavailable());
        this.withdraw(); this.#busy = true;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const work = this.#review().catch(() => { this.withdraw(); return unavailable(); }).finally(() => { clearTimeout(timer); this.#finish(); });
        const timeout = new Promise<ReturnType<typeof unavailable>>(resolve => {
            timer = setTimeout(() => { this.withdraw(); resolve(unavailable()); }, HISTORY_LIMITS.milliseconds); timer.unref?.();
        });
        return Promise.race([work, timeout]);
    }
    async #review(): Promise<Readonly<HistoryScanResult> | { status: "CANCELLED" | "UNAVAILABLE" }> {
        const root = this.#root(), epoch = this.#epoch, clock = this.options.now ?? (() => performance.now());
        const start = clock(), deadline = start + HISTORY_LIMITS.milliseconds;
        const identity = managedRootIdentity(root), approvalPolicy = managedPolicyBinding(root), sourcePolicy = runtimePolicyBinding(root.fsPath);
        let last = start, alive = Number.isFinite(start), policy: string | undefined, descriptor: CheckedGitMetadata | undefined;
        const valid = (checkDescriptor = true): boolean => {
            if (!alive) return false;
            try {
                const now = clock();
                alive = Number.isFinite(now) && now >= last && now >= start && now < deadline
                    && this.#available() && this.#epoch === epoch && this.#root().toString() === root.toString()
                    && managedRootIdentity(root) === identity && runtimePolicyBinding(root.fsPath) === sourcePolicy
                    && (policy === undefined || managedPolicyBinding(root) === policy)
                    && (!checkDescriptor || descriptor === undefined || descriptor.available());
                last = now;
            } catch { alive = false; }
            return alive;
        };
        if (!valid()) return unavailable();
        const action = "Analyze local Git history";
        const choice = await vscode.window.showWarningMessage("Analyze reachable local Git history?", { modal: true,
            detail: "Read up to32 commits,128 unique regular blobs,64KiB each and1MiB body content within60seconds. Local processing only; results contain keyed references and possible-exposure metadata. Caps, binaries and unsupported data remain partial. Manual rotation/removal guidance only; historical objects and other copies remain readable. No history rewrite or credential-validity/AI-access verification." }, action);
        if (!valid() || managedPolicyBinding(root) !== approvalPolicy) return unavailable();
        if (choice !== action) return { status: "CANCELLED" };
        await BoundarySnapshot.load(); if (!valid()) return unavailable();
        policy = managedPolicyBinding(root); if (!valid()) return unavailable();
        descriptor = await prepareCheckedGitMetadata(root.fsPath, process.env, () => valid(false));
        if (!descriptor || !valid()) return unavailable();
        const analyzer = await this.#ledger.createAnalyzer(root.toString(), "history-v1"); this.#analyzer = analyzer;
        if (!valid() || !await analyzer.current()) { this.withdraw(); return unavailable(); }
        const result = await scanGitHistory({ valid, deadline, now: clock, analyze: input => analyzer.analyze(input), run: async (operation, end) => {
            if (!valid() || !await analyzer.current() || !valid() || this.#worker?.busy) return unavailable();
            // The descriptor was prepared for this exact captured canonical root.
            const worker = new HistoryGitProcess({ root: root.fsPath, descriptor: descriptor!, operation, valid, deadline: end, now: clock }); this.#worker = worker;
            const outcome = await worker.start();
            if (outcome.status === "STOP_UNCONFIRMED") { this.withdraw(); return outcome; }
            await worker.closed; if (this.#worker === worker) this.#worker = undefined;
            if (!valid() || !await analyzer.current() || !valid()) return unavailable();
            return outcome;
        } });
        if (result.status === "UNAVAILABLE" || !valid() || !await analyzer.current() || !valid()) { this.withdraw(); return unavailable(); }
        await this.#ledger.record(root.toString(), result.findings, "possible-project-exposure");
        if (!valid() || !await analyzer.current() || !valid()) { this.withdraw(); return unavailable(); }
        this.#published = result; this.#check = valid; return result;
    }
}
