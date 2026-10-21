import * as vscode from "vscode";
import * as path from "node:path";
import { lstat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { RegisteredSecretMatcher } from "../../../core/src/RegisteredSecretMatcher";
import { VaultManager, vaultModeEnabled, type VaultHygieneSnapshot } from "../firewall/VaultManager";
import { VaultStorage, fileIdentity } from "../firewall/VaultStorage";
import { createVaultMigrationPlan } from "../firewall/VaultMigrationPlan";
import { assertWorkspaceFileUri } from "../security/WorkspacePathGuard";
import { BoundarySnapshot, ownerPolicyRevision } from "../ai-boundary/BoundarySnapshot";
import { hygieneAssistantEnabled } from "./HygieneFlags";
import { HygieneExposureLedger, HYGIENE_LEDGER_KEY } from "./HygieneExposureLedger";
import { type HygieneAnalysis, type HygieneFinding } from "./HygieneAnalysis";
import { sourceSyntaxForPath } from "../config-scanners/SourceSecretPlan";
import { sourceScannerEnabled } from "../config-scanners/SourceScannerFlags";
import { containerFormatForPath, CONTAINER_WORKSPACE_GLOBS } from "../config-scanners/ContainerSecretPlan";
import { containerScannerEnabled } from "../config-scanners/ContainerScannerFlags";
import { terraformFormatForPath, TERRAFORM_WORKSPACE_GLOBS } from "../config-scanners/TerraformSecretPlan";
import { terraformScannerEnabled } from "../config-scanners/TerraformScannerFlags";
type Analyzer = Awaited<ReturnType<HygieneExposureLedger["createAnalyzer"]>>;
interface Binding { uri: vscode.Uri; environment: boolean; identity: string; policy: string; analysis: Readonly<HygieneAnalysis>; findings: readonly HygieneFinding[]; safeLabels: boolean; vaulted: boolean; checkpoint: boolean }
class Changed extends Error {}
export class HygieneController implements vscode.Disposable {
    #vault: VaultManager; #ledger: HygieneExposureLedger; #bindings = new Map<string, Binding>(); #busy = false; #disposed = false; #epoch = 0;
    #analyzer?: Analyzer; #listeners: vscode.Disposable[];
    constructor(private readonly context: vscode.ExtensionContext, private readonly options: { now?: () => number; family?: "source" | "dockerKubernetes" | "terraform" } = {}) {
        this.#vault = new VaultManager(context); this.#ledger = new HygieneExposureLedger(context.globalState, context.secrets);
        this.#listeners = [vscode.workspace.onDidChangeConfiguration(e => { if (e.affectsConfiguration("soterai")) this.withdraw(); }),
            vscode.workspace.onDidChangeWorkspaceFolders(() => this.withdraw()), context.secrets.onDidChange(e => {
                const captured = this.#analyzer;
                if (e.key === HYGIENE_LEDGER_KEY && captured) void captured.current().then(current => { if (!current && this.#analyzer === captured) this.withdraw(); });
            })];
    }
    #root(): vscode.Uri {
        const folders = vscode.workspace.workspaceFolders; if (!vscode.workspace.isTrusted || vscode.env.remoteName || folders?.length !== 1) throw Error();
        const uri = folders[0].uri; if (uri.scheme !== "file" || uri.authority || uri.query || uri.fragment) throw Error(); return uri;
    }
    #available(): boolean { try { this.#root(); return !this.#disposed && process.platform === "win32" && hygieneAssistantEnabled() && vaultModeEnabled() && (this.options.family !== "source" || sourceScannerEnabled())
        && (this.options.family !== "dockerKubernetes" || containerScannerEnabled()) && (this.options.family !== "terraform" || terraformScannerEnabled()); } catch { return false; } }
    status(): object { return { status: this.#available() ? "OWNER_REVIEW_REQUIRED" : "UNAVAILABLE", busy: this.#busy, scope: this.options.family === "source"
        ? "Saved JS/JSX/TS/TSX/MJS/CJS static strings only. Dynamic credentials and unsupported syntax withhold analysis. Heuristic possible-exposure metadata; no credential validity or AI-access verification."
        : this.options.family === "dockerKubernetes" ? "Saved static Docker ENV/ARG and Compose/Kubernetes YAML only. Unsupported syntax/expressions withhold analysis; no config execution, build, deployment, credential-validity or AI-access verification. YAML restoration uses the reviewed encrypted whole-file checkpoint."
        : this.options.family === "terraform" ? "Saved static Terraform/tfvars literals and strict JSON only. Unsupported templates/expressions withhold analysis; no config execution, Terraform plan, provider/schema or AI-access verification. Restoration uses the reviewed encrypted whole-file checkpoint."
        : "Local heuristic findings and possible-exposure metadata; AI access, key validity and manual rotation are unverified." }; }
    withdraw(): void { this.#epoch++; this.#analyzer?.dispose(); this.#analyzer = undefined; this.#bindings.clear(); this.#vault.withdrawHygiene(); }
    dispose(): void { this.#disposed = true; this.withdraw(); this.#listeners.forEach(d => d.dispose()); }
    async #run(operation: (valid: () => boolean, root: vscode.Uri) => Promise<any>): Promise<any> {
        if (this.#busy || !this.#available()) return { status: "UNAVAILABLE" }; this.#busy = true;
        const root = this.#root(), epoch = this.#epoch, start = (this.options.now ?? (() => performance.now()))();
        const valid = () => { const now = (this.options.now ?? (() => performance.now()))(); return this.#available() && this.#epoch === epoch && this.#root().toString() === root.toString()
            && Number.isFinite(start) && Number.isFinite(now) && now >= start && now - start < 60000; };
        let timer: ReturnType<typeof setTimeout> | undefined, completed = false;
        const cleanup = () => { this.#analyzer?.dispose(); this.#analyzer = undefined; this.#busy = false; };
        const work = Promise.resolve().then(() => operation(valid, root)).catch(e => ({ status: e instanceof Changed ? "CHANGED" : "UNAVAILABLE" })).then(value => { completed = true; return value; });
        try { return await Promise.race([work, new Promise(resolve => { timer = setTimeout(() => { this.withdraw(); resolve({ status: "UNAVAILABLE" }); }, 60000); timer.unref?.(); })]); }
        finally { clearTimeout(timer); if (completed) cleanup(); else void work.then(cleanup, cleanup); }
    }
    async #confirm(message: string, action: string, detail: string, valid: () => boolean): Promise<boolean> {
        const choice = await vscode.window.showWarningMessage(message, { modal: true, detail }, action); return choice === action && valid();
    }
    async #stamp(uri: vscode.Uri): Promise<{ identity: string; size: number }> {
        if (!(uri instanceof vscode.Uri) || uri.scheme !== "file" || uri.authority || uri.query || uri.fragment || vscode.workspace.getWorkspaceFolder(uri)?.uri.toString() !== this.#root().toString()) throw Error();
        await assertWorkspaceFileUri(uri); const s = await lstat(uri.fsPath); if (!s.isFile() || s.isSymbolicLink() || s.nlink !== 1) throw Error(); return { identity: fileIdentity(s), size: s.size };
    }
    #snapshot(uri: vscode.Uri, s: Readonly<VaultHygieneSnapshot>, analyzer: Analyzer): Binding {
        const sourceMode = this.options.family === "source", containerMode = this.options.family === "dockerKubernetes", terraformMode = this.options.family === "terraform", environment = !sourceMode && !containerMode && !terraformMode && /^\.env(?:\..*)?$/i.test(path.basename(uri.fsPath)), source = path.relative(this.#root().fsPath, uri.fsPath).replaceAll("\\", "/");
        const syntax = sourceMode ? sourceSyntaxForPath(source) : containerMode ? containerFormatForPath(source) : terraformMode ? terraformFormatForPath(source) : undefined;
        if ((sourceMode || containerMode || terraformMode) && !syntax) throw Error();
        const input = { source, text: s.text, environment }, analysis = sourceMode ? analyzer.analyzeSource(input) : containerMode ? analyzer.analyzeContainer(input) : terraformMode ? analyzer.analyzeTerraform(input) : analyzer.analyze(input), plan = createVaultMigrationPlan(s.text, environment, randomUUID(), syntax);
        const matcher = new RegisteredSecretMatcher(plan.candidates.map(c => c.rawValue));
        return { uri, environment, identity: s.identity, policy: s.policy, analysis, findings: analysis.findings,
            safeLabels: matcher.inspectRequest([s.source, uri.fsPath]).status === "CLEAN", vaulted: false, checkpoint: plan.restoreMode === "checkpoint" };
    }
    async #read(uri: vscode.Uri, analyzer: Analyzer, valid: () => boolean): Promise<Binding> {
        if (!valid() || !await analyzer.current()) throw Error(); const result = await this.#vault.withHygieneSnapshot(uri, s => this.#snapshot(uri, s, analyzer), valid);
        if (!valid() || !await analyzer.current()) throw Error(); return result;
    }
    reviewFile(uri: vscode.Uri): Promise<any> { return this.#review(uri); }
    reviewWorkspace(): Promise<any> { return this.#review(); }
    async #discover(root: vscode.Uri, valid: () => boolean): Promise<{ files: vscode.Uri[]; capped: boolean }> {
        const patterns = this.options.family === "dockerKubernetes" ? CONTAINER_WORKSPACE_GLOBS : this.options.family === "terraform" ? TERRAFORM_WORKSPACE_GLOBS : [this.options.family === "source"
            ? "**/*.{[jJ][sS],[jJ][sS][xX],[tT][sS],[tT][sS][xX],[mM][jJ][sS],[cC][jJ][sS]}" : "**/*"];
        const found = new Map<string, vscode.Uri>(); let capped = false;
        for (const pattern of patterns) {
            if (!valid()) throw Error();
            const batch = await vscode.workspace.findFiles(new vscode.RelativePattern(root.fsPath, pattern), "**/{.git,node_modules,dist,build,coverage}/**", 129);
            if (!valid()) throw Error(); if (batch.length > 128) capped = true;
            for (const uri of batch) { found.set(uri.toString(), uri); if (found.size > 128) { capped = true; break; } }
            if (found.size > 128) break;
        }
        return { files: [...found.values()], capped };
    }
    #review(selected?: vscode.Uri): Promise<any> {
        return this.#run(async (valid, root) => {
            // Canonical additive policy enrollment must precede the review's
            // policy basis. It reads policy sources, never candidate originals.
            // Later owner/source changes still invalidate this exact review.
            await BoundarySnapshot.load(); if (!valid()) throw Error();
            const sourceMode = this.options.family === "source", containerMode = this.options.family === "dockerKubernetes", terraformMode = this.options.family === "terraform", syntaxOf = (uri: vscode.Uri) => {
                const relative = path.relative(root.fsPath, uri.fsPath).replaceAll("\\", "/"); return containerMode ? containerFormatForPath(relative) : terraformMode ? terraformFormatForPath(relative) : sourceSyntaxForPath(relative);
            };
            if ((sourceMode || containerMode || terraformMode) && selected && !syntaxOf(selected)) return { status: containerMode ? "UNSUPPORTED_CONTAINER_CONFIG" : terraformMode ? "UNSUPPORTED_TERRAFORM_CONFIG" : "UNSUPPORTED_SOURCE" };
            const discovery = selected ? { files: [selected], capped: false } : await this.#discover(root, valid);
            let files = discovery.files; const discoveryCapped = discovery.capped; let unsupportedFormats = 0;
            if (sourceMode || containerMode || terraformMode) { const admitted = files.filter(uri => !!syntaxOf(uri));
                // Dockerfile.* discovery deliberately includes ambiguous suffixes;
                // report those omissions. The source glob declares exact suffixes.
                if (containerMode || terraformMode) unsupportedFormats = files.length - admitted.length; files = admitted; }
            files = [...new Map(files.map(uri => [uri.toString(), uri])).values()]; const capped = discoveryCapped || files.length > 128; files = files.slice(0, 128);
            const stamps = await Promise.all(files.map(uri => this.#stamp(uri))), policy = await ownerPolicyRevision(root.toString()); if (!valid()) throw Error();
            const accepted = await this.#confirm(sourceMode ? "Analyze saved source files locally?" : containerMode ? "Analyze saved Docker/Kubernetes configs locally?" : terraformMode ? "Analyze saved Terraform/tfvars configs locally?" : "Analyze saved project files locally?", "Analyze saved project files", sourceMode
                ? "Review up to128 saved JS/JSX/TS/TSX/MJS/CJS files/64KiB each/1MiB analyzed text. Static strings only; dynamic credentials and unsupported syntax withhold analysis. Local processing, no execution or provider request. A reviewed vault fix replaces values with placeholders; configure application env or owner secret storage manually before applying. No code or imports are rewritten automatically."
                : containerMode ? "Review up to128 saved Docker/Compose/Kubernetes files/64KiB each/1MiB analyzed text. Static declared grammar only; unsupported inputs withhold analysis. No config execution, build, deployment or provider request. A separate reviewed vault migration replaces values; configure application secret loading manually. YAML disclosure restores the whole encrypted original checkpoint and keeps saved denies. No value-bearing env file is generated."
                : terraformMode ? "Review up to128 saved .tf/.tfvars/.tf.json/.tfvars.json files/64KiB each/1MiB analyzed text. Static declared grammar only; dynamic templates, function calls and unsupported syntax withhold analysis. No Terraform execution, plan, provider request or schema validation. A separate reviewed vault migration replaces values; configure application secret loading manually. Disclosure restores the entire encrypted original checkpoint and keeps saved denies. No value-bearing env file is generated."
                : "Review up to128 saved files/64KiB each/1MiB analyzed text. Values stay in bounded local processing. Findings are heuristic metadata; no AI-read or credential-validity verification. No provider request is sent.", valid);
            if (!accepted) return { status: valid() ? "CANCELLED" : "UNAVAILABLE" };
            if (await ownerPolicyRevision(root.toString()) !== policy) throw new Changed();
            for (let n = 0; n < files.length; n++) if ((await this.#stamp(files[n])).identity !== stamps[n].identity) throw new Changed();
            const analyzer = await this.#ledger.createAnalyzer(root.toString()); this.#analyzer = analyzer; const bindings: Binding[] = []; let bytes = 0, skipped = unsupportedFormats;
            for (let n = 0; n < files.length; n++) { if (!valid()) throw Error(); if (stamps[n].size > 65536 || bytes + stamps[n].size > 1048576) { skipped++; continue; }
                const binding = await this.#read(files[n], analyzer, valid); bytes += stamps[n].size; bindings.push(binding); if (bindings.reduce((sum, b) => sum + b.findings.length, 0) > 128) throw Error(); }
            for (const binding of bindings) { const fresh = await this.#read(binding.uri, analyzer, valid); if (fresh.identity !== binding.identity || fresh.policy !== binding.policy || fresh.analysis.revision !== binding.analysis.revision) throw new Changed(); }
            if (!valid() || await ownerPolicyRevision(root.toString()) !== policy || !await analyzer.current()) throw new Changed();
            const findings = bindings.flatMap(b => [...b.findings]); await this.#ledger.record(root.toString(), findings, "possible-project-exposure"); if (!valid() || !await analyzer.current()) throw Error();
            this.#bindings.clear(); for (const b of bindings) for (const f of b.findings) this.#bindings.set(f.id, b);
            return { status: capped || skipped ? "PARTIAL" : "ANALYZED", files: bindings.length, findings, skipped, capped, assessment: "Heuristic candidates; possible exposure only, no confirmed AI access or key validity." };
        });
    }
    #action(id: string, operation: "vault" | "restore" | "example"): Promise<any> {
        return this.#run(async (valid, root) => {
            const binding = typeof id === "string" && /^[a-f0-9]{64}$/.test(id) ? this.#bindings.get(id) : undefined;
            if (!binding || !binding.safeLabels || operation === "example" && !binding.environment || operation === "restore" && !binding.vaulted) return { status: "UNAVAILABLE" };
            const analyzer = await this.#ledger.createAnalyzer(root.toString()); this.#analyzer = analyzer;
            const before = await this.#read(binding.uri, analyzer, valid);
            if (before.identity !== binding.identity || before.policy !== binding.policy || before.analysis.revision !== binding.analysis.revision) throw new Changed();
            if (!before.safeLabels || !valid()) return { status: "UNAVAILABLE" };
            let committed = false;
            try {
                let count = 0;
                if (operation === "example") {
                    if (!await this.#confirm("Create a safe environment example?", "Write empty example values", "The canonical vault writer creates only parsed names and empty values. A conflicting existing example is preserved. No source editor is opened.", valid)) return { status: valid() ? "CANCELLED" : "UNAVAILABLE" };
                    await this.#vault.writeEnvExample(binding.uri, valid); committed = true;
                } else {
                    if (operation === "vault") count = this.options.family === "source" ? await this.#vault.migrateSource(binding.uri, valid) : this.options.family === "dockerKubernetes" ? await this.#vault.migrateContainer(binding.uri, valid) : this.options.family === "terraform" ? await this.#vault.migrateTerraform(binding.uri, valid) : await this.#vault.migrate(binding.uri, valid);
                    else count = binding.checkpoint ? await this.#vault.restoreFromBackup(binding.uri, valid) ? binding.findings.length : 0 : await this.#vault.restore(binding.uri, valid);
                    committed = count > 0; if (!valid()) throw Error(); if (!count) return { status: "CANCELLED" };
                }
                if (!valid() || !await analyzer.current()) throw Error(); const fresh = await this.#read(binding.uri, analyzer, valid);
                const next: Binding = { ...fresh, findings: binding.findings, safeLabels: binding.safeLabels && fresh.safeLabels, vaulted: operation === "vault" || operation === "example" && binding.vaulted };
                if (operation !== "example") await this.#ledger.record(root.toString(), binding.findings, operation === "vault" ? "vaulted" : "restored-after-owner-disclosure");
                if (!valid() || !await analyzer.current()) throw Error(); for (const finding of binding.findings) this.#bindings.set(finding.id, next);
                return { status: operation === "restore" ? "RESTORED" : "APPLIED", count, fileRef: binding.analysis.fileRef };
            } catch (e) {
                if (committed) return { status: "INCOMPLETE" }; throw e;
            }
        });
    }
    vaultFinding(id: string): Promise<any> { return this.#action(id, "vault"); }
    restoreFinding(id: string): Promise<any> { return this.#action(id, "restore"); }
    writeExample(id: string): Promise<any> { return this.#action(id, "example"); }
    /** Fixed safe menu metadata only; the actual URI/identity remains private. */
    selections(): ReadonlyArray<Readonly<{ id: string; label: string; provider: HygieneFinding["provider"] }>> {
        return Object.freeze([...this.#bindings.entries()].map(([id, binding], ordinal) => Object.freeze({ id, label: "Finding " + (ordinal + 1) + " · " + binding.findings.find(f => f.id === id)!.kind, provider: binding.findings.find(f => f.id === id)!.provider })));
    }
    async exposures(): Promise<any> { try { return await this.#ledger.view(this.#root().toString()); } catch { return { status: "UNAVAILABLE", rows: [] }; } }
    exportLedger(): Promise<any> {
        return this.#run(async (valid, root) => {
            if (!await this.#confirm("Export possible-exposure metadata?", "Create metadata export", "A new JSON file contains only keyed references, fixed candidate labels and observation metadata. This does not verify that an AI read a key or that a provider credential was rotated.", valid)) return { status: valid() ? "CANCELLED" : "UNAVAILABLE" };
            const view = await this.#ledger.view(root.toString());
            if (!valid()) throw Error(); const directory = path.join(this.context.globalStorageUri.fsPath, "hygiene-exports"), name = "exposure-" + randomUUID() + ".json";
            await new VaultStorage(directory).write(name, JSON.stringify(view, null, 2) + "\n", true); if (!valid()) return { status: "INCOMPLETE" };
            return { status: "EXPORTED", rows: view.rows.length };
        });
    }
}
