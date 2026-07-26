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
    /** Throttle file-change events: minimum ms between processing the same file. */
    private readonly fileEventThrottleMs = 200;
    private readonly fileEventThrottleCleanupInterval = 10_000; // cleanup old entries every 10s
    private lastFileEvent = new Map<string, number>();
    private lastThrottleCleanup = 0;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 95);
        this.statusBarItem.command = "soterai.showAITimeline";
        context.subscriptions.push(this.statusBarItem);
        this.updateStatusBar();

        const stored = context.globalState.get<SentinelEvent[]>("soterai.sentinelEvents");
        if (stored) this.events = stored;
    }

    get isEnabled(): boolean { return this.enabled; }

    enable(): void {
        if (this.enabled) return;
        this.enabled = true;
        this.startWatching();
        this.updateStatusBar();
    }

    disable(): void {
        if (!this.enabled) return;
        this.enabled = false;
        this.stopWatching();
        this.updateStatusBar();
    }

    getEvents(): ReadonlyArray<SentinelEvent> { return this.events; }

    getHighRiskEvents(): SentinelEvent[] {
        return this.events.filter((e) => e.risk === "high" || e.risk === "critical");
    }

    async recordEvent(event: Omit<SentinelEvent, "id" | "timestamp">): Promise<void> {
        const full: SentinelEvent = { ...event, id: `sent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, timestamp: Date.now() };
        this.events.push(full);
        if (this.events.length > this.maxEvents) this.events.splice(0, this.events.length - this.maxEvents);
        // Limit globalState writes to prevent storage exhaustion from rapid events
        if (this.events.length % 10 === 0 || this.events.length <= 1) {
            await this.context.globalState.update("soterai.sentinelEvents", this.events);
        }

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
        return JSON.stringify({ exportedAt: new Date().toISOString(), eventCount: safe.length, events: safe }, null, 2);
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

        // Throttle rapid file-change events to prevent storage flooding
        const now = Date.now();
        const last = this.lastFileEvent.get(rel) ?? 0;
        if (now - last < this.fileEventThrottleMs) return;
        this.lastFileEvent.set(rel, now);
        // Periodically prune stale throttle entries to prevent unbounded Map growth
        if (now - this.lastThrottleCleanup > this.fileEventThrottleCleanupInterval) {
            this.lastThrottleCleanup = now;
            for (const [path, ts] of this.lastFileEvent) {
                if (now - ts > this.fileEventThrottleCleanupInterval) this.lastFileEvent.delete(path);
            }
        }

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
