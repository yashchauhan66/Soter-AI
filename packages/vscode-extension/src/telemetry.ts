import * as vscode from "vscode";
import { RedactedEvent, GuardDecision } from "@soterai/guard-core";

export class TelemetryManager {
    private static instance: TelemetryManager;
    private queue: RedactedEvent[] = [];
    private batchInterval: NodeJS.Timeout | undefined;
    private maxQueueSize = 1000;
    private isOffline = false;

    private constructor() {
        this.startBatchTimer();
    }

    public static getInstance(): TelemetryManager {
        if (!TelemetryManager.instance) {
            TelemetryManager.instance = new TelemetryManager();
        }
        return TelemetryManager.instance;
    }

    public trackDetection(decision: GuardDecision, textLength: number, context: string): void {
        const config = vscode.workspace.getConfiguration("soterai");
        const telemetryLevel = config.get<string>("telemetry.redactedEvents", "off");

        if (telemetryLevel === "off") return;
        if (telemetryLevel === "high-risk-only" && decision.riskScore < 30) return;

        // Build fully redacted minimized event
        const event: RedactedEvent = {
            eventId: this.generateUUID(),
            workspacePseudoId: this.getWorkspacePseudoId(),
            policyVersion: "1.0.0",
            detectorVersions: decision.detectorVersions,
            eventType: `scan_${context}`,
            decision: decision.decision,
            categories: decision.categories,
            severity: decision.severity,
            riskScore: decision.riskScore,
            redactedEvidencePreview: decision.evidencePreview, // minified & censored
            contentLength: textLength,
            localOnly: true,
            timestamp: new Date().toISOString(),
        };

        this.enqueue(event);
    }

    private enqueue(event: RedactedEvent): void {
        if (this.queue.length >= this.maxQueueSize) {
            // Discard oldest
            this.queue.shift();
        }
        this.queue.push(event);
    }

    public startBatchTimer(): void {
        if (this.batchInterval) clearInterval(this.batchInterval);
        this.batchInterval = setInterval(() => {
            this.flush();
        }, 45000); // 45 seconds batching
    }

    public async flush(): Promise<void> {
        if (this.queue.length === 0) return;
        const config = vscode.workspace.getConfiguration("soterai");
        const privacyMode = config.get<string>("privacyMode", "local");
        const cloudEnabled = config.get<boolean>("cloud.enabled", false);

        if (privacyMode === "local" || !cloudEnabled || this.isOffline || !vscode.workspace.isTrusted) {
            return; // Hold in queue if offline or cloud disabled
        }

        try {
            const batchToSend = [...this.queue];
            const success = await this.sendEventsToCloud(batchToSend);
            if (success) {
                this.queue = this.queue.slice(batchToSend.length);
            }
        } catch {
            this.isOffline = true;
            setTimeout(() => { this.isOffline = false; }, 60000); // Retry after 1 min
        }
    }

    private async sendEventsToCloud(events: RedactedEvent[]): Promise<boolean> {
        void events;
        // Network telemetry is intentionally disabled until a reviewed endpoint
        // client is added. Local mode and untrusted workspaces never call this.
        return true;
    }

    private getWorkspacePseudoId(): string {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) return "adhoc-file";
        const path = folders[0].uri.fsPath;
        // Simple fast deterministically pseudo path hash
        let hash = 0;
        for (let i = 0; i < path.length; i++) {
            hash = (hash << 5) - hash + path.charCodeAt(i);
            hash |= 0;
        }
        return `ws-${Math.abs(hash)}`;
    }

    private generateUUID(): string {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    public dispose(): void {
        if (this.batchInterval) clearInterval(this.batchInterval);
        this.flush();
    }
}
