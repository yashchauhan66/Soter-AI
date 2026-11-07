import * as vscode from "vscode";
import { SENSITIVE_FILE_GLOBS, isSensitiveFilePath } from "@soterai/guard-core";
import { ownedSinkMetadata } from "../../../core/src/OwnedSinkMetadata";
import { selfHygieneEnabled } from "../self-hygiene/SelfHygieneFlags";

export interface SentinelEvent {
    id: string;
    timestamp: number;
    type: "file_change" | "protected_access" | "mcp_config_change" | "repo_instruction_change" | "canary_hit" | "extension_change" | "config_change" | "terminal_command";
    risk: "low" | "medium" | "high" | "critical";
    source: string;
    filePath?: string;
    decision: string;
    redactedEvidence: string;
}

// Secret-bearing files are classified via the canonical guard-core predicate
// (isSensitiveFilePath) in onFileChange — shared with every other proactive
// guard and now covering agent credential configs. The globs below are the
// sentinel's OWN additional concern: instruction-poisoning files and dependency
// manifests, which are not secrets but are worth watching for change.
const INSTRUCTION_AND_MANIFEST_GLOBS = [
    "**/CLAUDE.md",
    "**/.cursorrules",
    "**/.cursor/rules/**",
    "**/.github/copilot-instructions.md",
    "**/.windsurfrules",
    "**/.clinerules",
    "**/package.json",
    "**/package-lock.json",
    "**/yarn.lock",
    "**/pnpm-lock.yaml",
];

const REPO_INSTRUCTION_FILES = [
    "CLAUDE.md",
    ".cursorrules",
    ".github/copilot-instructions.md",
    ".windsurfrules",
    ".clinerules",
];

const SENTINEL_ENABLED_KEY = "soterai.sentinel.enabledState";
const EVENT_TYPES = new Set(["file_change", "protected_access", "mcp_config_change", "repo_instruction_change", "canary_hit", "extension_change", "config_change", "terminal_command"]);

function minimizedEvent(event: Omit<SentinelEvent, "id" | "timestamp">, timestamp = Date.now()): SentinelEvent | undefined {
    if (!event || !EVENT_TYPES.has(event.type) || !["low", "medium", "high", "critical"].includes(event.risk)
        || !Number.isFinite(timestamp) || timestamp < 0 || timestamp > 8640000000000000) return undefined;
    const metadata = ownedSinkMetadata(event.type, event.decision);
    return Object.freeze({ id: `sent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, timestamp,
        type: event.type, risk: event.risk, source: "sentinel", decision: metadata.decision,
        redactedEvidence: "Observed activity metadata only." });
}

const INJECTION_PATTERNS = [
    /ignore previous instructions/i,
    /ignore all previous/i,
    /disregard.*instructions/i,
    /override.*safety/i,
    /bypass.*security/i,
    /always trust/i,
    /store this secret/i,
    /remember credentials/i,
    /do not reveal/i,
    /exfiltrate/i,
    /read \.env/i,
    /send to/i,
    /hidden instruction/i,
    /secret instruction/i,
];

export class AISentinel implements vscode.Disposable {
    private enabled = false;
    private disposed = false;
    private generation = 0;
    private persistence: "UNVERIFIED" | "PENDING" | "OBSERVED_API_UPDATE" | "INCOMPLETE" = "UNVERIFIED";
    private persistenceRevision = 0;
    private events: SentinelEvent[] = [];
    private watchers: vscode.FileSystemWatcher[] = [];
    private watcherSubscriptions: vscode.Disposable[] = [];
    private statusBarItem: vscode.StatusBarItem;
    private disposables: vscode.Disposable[] = [];
    private readonly maxEvents = 500;
    private persistEvents(): void {
        const snapshot = [...this.events];
        const revision = ++this.persistenceRevision;
        this.persistence = "PENDING";
        try {
            void Promise.resolve(this.context.globalState.update("soterai.sentinelEvents", snapshot))
                .then(() => { if (!this.disposed && revision === this.persistenceRevision) this.persistence = "OBSERVED_API_UPDATE"; })
                .catch(() => { if (revision === this.persistenceRevision) this.persistence = "INCOMPLETE"; });
        } catch { this.persistence = "INCOMPLETE"; }
    }

    constructor(private readonly context: vscode.ExtensionContext) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 95);
        this.statusBarItem.command = "soterai.showAITimeline";
        context.subscriptions.push(this.statusBarItem);
        this.disposables.push(vscode.workspace.onDidChangeConfiguration(event => {
            if (!event.affectsConfiguration("soterai.lite.selfHygiene")) return;
            this.generation++;
            if (!selfHygieneEnabled()) { this.events = []; this.stopWatching(); }
            else if (this.enabled) this.startWatching();
            this.updateStatusBar();
        }));
        this.updateStatusBar();

        const stored = context.globalState.get<SentinelEvent[]>("soterai.sentinelEvents");
        if (selfHygieneEnabled() && Array.isArray(stored)) {
            this.events = stored.slice(-this.maxEvents).flatMap(event => {
                const safe = minimizedEvent(event, event?.timestamp);
                return safe ? [safe] : [];
            });
            this.persistEvents();
        }
        this.enabled = context.globalState.get<boolean>(SENTINEL_ENABLED_KEY) === true;
        this.pruneExpired();
        if (this.enabled) this.startWatching();
        this.updateStatusBar();
    }

    get isEnabled(): boolean { return !this.disposed && this.enabled && selfHygieneEnabled(); }

    async enable(): Promise<void> {
        if (this.disposed) throw new Error("Owned activity sink is disposed.");
        if (!selfHygieneEnabled()) throw new Error("Owned activity sink is disabled.");
        if (this.enabled) return;
        this.generation++;
        this.enabled = true;
        try { await this.context.globalState.update(SENTINEL_ENABLED_KEY, true); }
        catch {
            this.enabled = false; this.stopWatching(); this.persistence = "INCOMPLETE"; this.updateStatusBar();
            throw new Error("Owned activity preference unavailable.");
        }
        this.startWatching();
        this.updateStatusBar();
    }

    async disable(): Promise<void> {
        if (!this.enabled) return;
        this.generation++;
        this.enabled = false;
        try { await this.context.globalState.update(SENTINEL_ENABLED_KEY, false); }
        catch {
            this.stopWatching(); this.persistence = "INCOMPLETE"; this.updateStatusBar();
            throw new Error("Owned activity preference unavailable.");
        }
        this.stopWatching();
        this.updateStatusBar();
    }

    getEvents(): ReadonlyArray<SentinelEvent> {
        if (this.disposed || !selfHygieneEnabled()) { this.events = []; return []; }
        return [...this.events];
    }

    getHighRiskEvents(): SentinelEvent[] {
        return this.getEvents().filter((e) => e.risk === "high" || e.risk === "critical");
    }

    recordEvent(event: Omit<SentinelEvent, "id" | "timestamp">, options?: { notify?: boolean }): void {
        if (this.disposed || !selfHygieneEnabled()) { this.events = []; return; }
        const full = minimizedEvent(event);
        if (!full) return;
        this.pruneExpired();
        this.events.push(full);
        if (this.events.length > this.maxEvents) this.events.splice(0, this.events.length - this.maxEvents);
        this.persistEvents();

        // `notify: false` is for callers that already told the user themselves.
        // The terminal watcher (Gap 4) shows a modal naming the matched pattern,
        // and a second generic Sentinel toast for the same event would read as
        // two findings.
        if (options?.notify === false) return;
        if (full.risk === "high" || full.risk === "critical") {
            try {
                void Promise.resolve(vscode.window.showWarningMessage(`[SoterAI Sentinel] ${full.risk.toUpperCase()}: ${full.redactedEvidence}`)).catch(() => undefined);
            } catch { /* An unavailable UI must not echo exception text. */ }
        }
    }

    clearEvents(): void {
        this.events = [];
        this.persistEvents();
    }

    exportReport(): string {
        const safe = this.getEvents().map((e) => ({
            timestamp: new Date(e.timestamp).toISOString(),
            type: e.type,
            risk: e.risk,
            source: e.source,
            decision: e.decision,
            redactedEvidence: e.redactedEvidence,
        }));
        return JSON.stringify({ exportedAt: new Date().toISOString(), privacyMode: "metadata_only", persistence: this.persistence, retentionDays: this.retentionDays, eventCount: safe.length, events: safe }, null, 2);
    }

    private get retentionDays(): number {
        return Math.max(1, Math.min(365, vscode.workspace.getConfiguration("soterai").get<number>("sentinel.retentionDays", 30)));
    }

    private pruneExpired(): void {
        const cutoff = Date.now() - this.retentionDays * 86_400_000;
        const retained = this.events.filter((event) => event.timestamp >= cutoff);
        if (retained.length !== this.events.length) {
            this.events = retained;
            this.persistEvents();
        }
    }

    private startWatching(): void {
        if (!this.isEnabled || this.watchers.length > 0) return;
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) return;

        // Canonical secret files (incl. agent configs and every mcp.json form)
        // + the sentinel's own instruction/manifest concern. Deduped so an
        // overlapping entry does not create two watchers for one file.
        const sensitivePatterns = [...new Set([...SENSITIVE_FILE_GLOBS, ...INSTRUCTION_AND_MANIFEST_GLOBS])];

        for (const pattern of sensitivePatterns) {
            const watcher = vscode.workspace.createFileSystemWatcher(pattern);
            watcher.onDidChange((uri) => this.onFileChange(uri, "change"));
            watcher.onDidCreate((uri) => this.onFileChange(uri, "create"));
            watcher.onDidDelete((uri) => this.onFileChange(uri, "delete"));
            this.watchers.push(watcher);
        }

        this.watcherSubscriptions.push(
            vscode.extensions.onDidChange(() => {
                this.recordEvent({
                    type: "extension_change",
                    risk: "medium",
                    source: "sentinel",
                    decision: "monitor",
                    redactedEvidence: "VS Code extensions changed — recheck AI extension risk",
                });
            })
        );
    }

    private stopWatching(): void {
        for (const w of this.watchers) w.dispose();
        this.watchers = [];
        for (const subscription of this.watcherSubscriptions) subscription.dispose();
        this.watcherSubscriptions = [];
    }

    private async onFileChange(uri: vscode.Uri, changeType: string): Promise<void> {
        if (!this.isEnabled) return;
        const generation = this.generation;
        const rel = vscode.workspace.asRelativePath(uri);
        const isRepoInstruction = REPO_INSTRUCTION_FILES.some((f) => rel.endsWith(f) || rel.includes(f));

        let risk: SentinelEvent["risk"] = "low";
        let type: SentinelEvent["type"] = "file_change";

        if (isRepoInstruction) {
            type = "repo_instruction_change";
            risk = "high";
            try {
                const doc = await vscode.workspace.openTextDocument(uri);
                if (!this.isEnabled || generation !== this.generation) return;
                const text = doc.getText();
                const hasInjection = INJECTION_PATTERNS.some((p) => p.test(text));
                if (hasInjection) {
                    risk = "critical";
                    this.recordEvent({ type, risk, source: "sentinel", filePath: rel, decision: "alert", redactedEvidence: `Repo instruction file ${rel} contains prompt injection pattern` });
                    return;
                }
            } catch { /* skip unreadable files */ }
        } else if (/mcp\.json/i.test(rel)) {
            // Checked before the generic sensitive branch so an mcp config keeps
            // its specific event type — several mcp.json forms are now also in
            // the canonical sensitive list.
            type = "mcp_config_change";
            risk = "high";
        } else if (isSensitiveFilePath(rel)) {
            type = "protected_access";
            risk = "high";
        } else if (/package\.json|lockfile/i.test(rel)) {
            type = "config_change";
            risk = "medium";
        }

        if (!this.isEnabled || generation !== this.generation) return;
        this.recordEvent({ type, risk, source: "sentinel", filePath: rel, decision: "monitor", redactedEvidence: `${changeType} on ${rel}` });
    }

    private updateStatusBar(): void {
        // Same rule as WorkspaceGuard: an item that only ever says "Off" is not
        // status, it is clutter. The consolidated item in extension.ts already
        // reports Sentinel state in its tooltip, so this entry appears only
        // while the Sentinel is actually recording.
        if (!this.isEnabled) {
            this.statusBarItem.hide();
            return;
        }
        const highRisk = this.getHighRiskEvents().length;
        this.statusBarItem.text = `$(eye) Sentinel${highRisk > 0 ? ` (${highRisk})` : ""}`;
        this.statusBarItem.tooltip = `AI Activity Sentinel: Active. ${this.events.length} events, ${highRisk} high-risk.`;
        this.statusBarItem.show();
    }

    dispose(): void {
        this.disposed = true;
        this.generation++;
        this.events = [];
        this.stopWatching();
        for (const d of this.disposables) d.dispose();
        this.statusBarItem.dispose();
    }
}
