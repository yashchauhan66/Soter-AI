import * as vscode from "vscode";

export interface SentinelEvent {
    id: string;
    timestamp: number;
    type: "file_change" | "protected_access" | "mcp_config_change" | "repo_instruction_change" | "canary_hit" | "extension_change" | "config_change";
    risk: "low" | "medium" | "high" | "critical";
    source: string;
    filePath?: string;
    decision: string;
    redactedEvidence: string;
}

const HIGH_RISK_PATTERNS = [
    /\.env(\.|$)/i,
    /\.pem$/i,
    /id_rsa/i,
    /\.npmrc$/i,
    /\.pypirc$/i,
    /\.aws[\\/]credentials/i,
    /CLAUDE\.md$/i,
    /\.cursorrules$/i,
    /\.cursor[\\/]rules[\\/]?\*\*/i,
    /\.github[\\/]copilot-instructions\.md$/i,
    /\.vscode[\\/]mcp\.json$/i,
    /mcp\.json$/i,
];

const REPO_INSTRUCTION_FILES = [
    "CLAUDE.md",
    ".cursorrules",
    ".github/copilot-instructions.md",
    ".windsurfrules",
    ".clinerules",
];

const SENTINEL_ENABLED_KEY = "soterai.sentinel.enabledState";

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
    private events: SentinelEvent[] = [];
    private watchers: vscode.FileSystemWatcher[] = [];
    private statusBarItem: vscode.StatusBarItem;
    private disposables: vscode.Disposable[] = [];
    private readonly maxEvents = 500;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 95);
        this.statusBarItem.command = "soterai.showAITimeline";
        context.subscriptions.push(this.statusBarItem);
        this.updateStatusBar();

        const stored = context.globalState.get<SentinelEvent[]>("soterai.sentinelEvents");
        if (stored) this.events = stored;
        this.enabled = context.globalState.get<boolean>(SENTINEL_ENABLED_KEY) ?? false;
        this.pruneExpired();
        if (this.enabled) this.startWatching();
        this.updateStatusBar();
    }

    get isEnabled(): boolean { return this.enabled; }

    async enable(): Promise<void> {
        if (this.enabled) return;
        this.enabled = true;
        await this.context.globalState.update(SENTINEL_ENABLED_KEY, true);
        this.startWatching();
        this.updateStatusBar();
    }

    async disable(): Promise<void> {
        if (!this.enabled) return;
        this.enabled = false;
        await this.context.globalState.update(SENTINEL_ENABLED_KEY, false);
        this.stopWatching();
        this.updateStatusBar();
    }

    getEvents(): ReadonlyArray<SentinelEvent> { return this.events; }

    getHighRiskEvents(): SentinelEvent[] {
        return this.events.filter((e) => e.risk === "high" || e.risk === "critical");
    }

    recordEvent(event: Omit<SentinelEvent, "id" | "timestamp">): void {
        this.pruneExpired();
        const full: SentinelEvent = { ...event, id: `sent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, timestamp: Date.now() };
        this.events.push(full);
        if (this.events.length > this.maxEvents) this.events.splice(0, this.events.length - this.maxEvents);
        void this.context.globalState.update("soterai.sentinelEvents", this.events);

        if (event.risk === "high" || event.risk === "critical") {
            vscode.window.showWarningMessage(`[SoterAI Sentinel] ${event.risk.toUpperCase()}: ${event.redactedEvidence}`);
        }
    }

    clearEvents(): void {
        this.events = [];
        void this.context.globalState.update("soterai.sentinelEvents", this.events);
    }

    exportReport(): string {
        const safe = this.events.map((e) => ({
            timestamp: new Date(e.timestamp).toISOString(),
            type: e.type,
            risk: e.risk,
            source: e.source,
            filePath: e.filePath,
            decision: e.decision,
            redactedEvidence: e.redactedEvidence,
        }));
        return JSON.stringify({ exportedAt: new Date().toISOString(), privacyMode: "metadata_and_redacted_evidence", retentionDays: this.retentionDays, eventCount: safe.length, events: safe }, null, 2);
    }

    private get retentionDays(): number {
        return Math.max(1, Math.min(365, vscode.workspace.getConfiguration("soterai").get<number>("sentinel.retentionDays", 30)));
    }

    private pruneExpired(): void {
        const cutoff = Date.now() - this.retentionDays * 86_400_000;
        const retained = this.events.filter((event) => event.timestamp >= cutoff);
        if (retained.length !== this.events.length) {
            this.events = retained;
            void this.context.globalState.update("soterai.sentinelEvents", this.events);
        }
    }

    private startWatching(): void {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) return;

        const sensitivePatterns = [
            "**/.env*",
            "**/*.pem",
            "**/id_rsa*",
            "**/.npmrc",
            "**/.pypirc",
            "**/.aws/credentials",
            "**/CLAUDE.md",
            "**/.cursorrules",
            "**/.cursor/rules/**",
            "**/.github/copilot-instructions.md",
            "**/.vscode/mcp.json",
            "**/mcp.json",
            "**/package.json",
            "**/package-lock.json",
            "**/yarn.lock",
            "**/pnpm-lock.yaml",
        ];

        for (const pattern of sensitivePatterns) {
            const watcher = vscode.workspace.createFileSystemWatcher(pattern);
            watcher.onDidChange((uri) => this.onFileChange(uri, "change"));
            watcher.onDidCreate((uri) => this.onFileChange(uri, "create"));
            watcher.onDidDelete((uri) => this.onFileChange(uri, "delete"));
            this.watchers.push(watcher);
            this.disposables.push(watcher);
        }

        this.disposables.push(
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
    }

    private async onFileChange(uri: vscode.Uri, changeType: string): Promise<void> {
        const rel = vscode.workspace.asRelativePath(uri);
        const isHighRisk = HIGH_RISK_PATTERNS.some((p) => p.test(rel));
        const isRepoInstruction = REPO_INSTRUCTION_FILES.some((f) => rel.endsWith(f) || rel.includes(f));

        let risk: SentinelEvent["risk"] = "low";
        let type: SentinelEvent["type"] = "file_change";

        if (isRepoInstruction) {
            type = "repo_instruction_change";
            risk = "high";
            try {
                const doc = await vscode.workspace.openTextDocument(uri);
                const text = doc.getText();
                const hasInjection = INJECTION_PATTERNS.some((p) => p.test(text));
                if (hasInjection) {
                    risk = "critical";
                    this.recordEvent({ type, risk, source: "sentinel", filePath: rel, decision: "alert", redactedEvidence: `Repo instruction file ${rel} contains prompt injection pattern` });
                    return;
                }
            } catch { /* skip unreadable files */ }
        } else if (isHighRisk) {
            type = "protected_access";
            risk = "high";
        } else if (/mcp\.json/i.test(rel)) {
            type = "mcp_config_change";
            risk = "high";
        } else if (/package\.json|lockfile/i.test(rel)) {
            type = "config_change";
            risk = "medium";
        }

        this.recordEvent({ type, risk, source: "sentinel", filePath: rel, decision: "monitor", redactedEvidence: `${changeType} on ${rel}` });
    }

    private updateStatusBar(): void {
        if (this.enabled) {
            const highRisk = this.getHighRiskEvents().length;
            this.statusBarItem.text = `$(eye) Sentinel${highRisk > 0 ? ` (${highRisk})` : ""}`;
            this.statusBarItem.tooltip = `AI Activity Sentinel: Active. ${this.events.length} events, ${highRisk} high-risk.`;
        } else {
            this.statusBarItem.text = "$(eye-closed) Sentinel Off";
            this.statusBarItem.tooltip = "AI Activity Sentinel is disabled.";
        }
        this.statusBarItem.show();
    }

    dispose(): void {
        this.stopWatching();
        for (const d of this.disposables) d.dispose();
        this.statusBarItem.dispose();
    }
}
