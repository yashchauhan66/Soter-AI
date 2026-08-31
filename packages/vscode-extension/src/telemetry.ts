import * as vscode from "vscode";
import { RedactedEvent, GuardDecision } from "@soterai/guard-core";
import { shouldRecord, shouldRetainQueuedTelemetry, shouldSend, telemetryHoldReason, type TelemetryGateInput } from "./enterprise/telemetryGate";

/**
 * GAP 3 — telemetry that the user's own editor preference can switch off.
 *
 * Two defects were fixed here, both auditable:
 *
 * 1. `vscode.env.isTelemetryEnabled` was never consulted. A user who turned
 *    telemetry off for the whole editor still had SoterAI events queued, which
 *    for a security product is a compliance finding rather than a preference
 *    mismatch. Events now flow through `env.createTelemetryLogger`, which VS
 *    Code itself silences when telemetry is off — and the gate is checked
 *    explicitly as well, so behaviour is identical on a 1.85 host where the
 *    logger API does not exist.
 * 2. `sendEventsToCloud()` returned `true` without sending anything, so the
 *    queue was trimmed as though delivered. There is no reviewed endpoint client
 *    yet; that is now stated as a *hold*, and the queue is only cleared when a
 *    real sender reports success.
 *
 * The gating logic lives in `enterprise/telemetryGate.ts` — pure, so every
 * branch of "may this leave the machine?" is unit-testable without a host.
 */
export class TelemetryManager {
    private static instance: TelemetryManager;
    private queue: RedactedEvent[] = [];
    private batchInterval: NodeJS.Timeout | undefined;
    private maxQueueSize = 1000;
    private isOffline = false;
    /**
     * The host's own logger, when the API exists (VS Code 1.75+). It is the
     * channel that respects the user's global preference without SoterAI having
     * to re-implement it, and it writes to the editor's telemetry output so a
     * user can read exactly what would be reported.
     */
    private logger: vscode.TelemetryLogger | undefined;

    private constructor() {
        this.logger = TelemetryManager.createLogger();
        this.startBatchTimer();
    }

    /**
     * Feature-detected: `env.createTelemetryLogger` arrived after the `^1.85.0`
     * floor this extension keeps for Cursor/Windsurf/Kiro. On a host without it
     * the explicit gate below is the only control, which is why the gate is not
     * delegated to the logger.
     */
    private static createLogger(): vscode.TelemetryLogger | undefined {
        const api = vscode.env as unknown as {
            createTelemetryLogger?: (sender: vscode.TelemetrySender) => vscode.TelemetryLogger;
        };
        if (typeof api.createTelemetryLogger !== "function") return undefined;
        try {
            return api.createTelemetryLogger({
                // No network sender ships yet. Sending nothing is the honest
                // behaviour; events stay visible to the user through the
                // editor's own telemetry output, which is the point of routing
                // through the logger rather than a private queue.
                sendEventData: () => { /* no reviewed endpoint client yet */ },
                sendErrorData: () => { /* errors are never reported off-machine */ },
            });
        } catch {
            return undefined;
        }
    }

    public static getInstance(): TelemetryManager {
        if (!TelemetryManager.instance) {
            TelemetryManager.instance = new TelemetryManager();
        }
        return TelemetryManager.instance;
    }

    /** True when the editor itself permits telemetry. Absent API ⇒ treat as on. */
    private hostTelemetryEnabled(): boolean {
        const flag = (vscode.env as unknown as { isTelemetryEnabled?: boolean }).isTelemetryEnabled;
        return typeof flag === "boolean" ? flag : true;
    }

    public trackDetection(decision: GuardDecision, textLength: number, context: string): void {
        const config = vscode.workspace.getConfiguration("soterai");
        const telemetryLevel = config.get<string>("telemetry.redactedEvents", "off");
        // Apply every durable privacy choice before constructing an event. A
        // contradictory/stale configuration must not create a queue that merely
        // waits for the next flush to be purged.
        if (!shouldRetainQueuedTelemetry(this.gateInput())) {
            this.queue = [];
            return;
        }
        if (!shouldRecord(telemetryLevel, decision.riskScore)) return;

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

    /**
     * Why the queue is currently held, in one plain sentence, or `undefined`
     * when nothing holds it. Exposed so a diagnostics surface can tell the user
     * the truth instead of leaving a silent queue unexplained.
     */
    public holdReason(): string | undefined {
        return telemetryHoldReason(this.gateInput());
    }

    private gateInput(): TelemetryGateInput {
        const config = vscode.workspace.getConfiguration("soterai");
        return {
            level: config.get<string>("telemetry.redactedEvents", "off"),
            privacyMode: config.get<string>("privacyMode", "local"),
            cloudEnabled: config.get<boolean>("cloud.enabled", false),
            trusted: vscode.workspace.isTrusted,
            hostTelemetryEnabled: this.hostTelemetryEnabled(),
            offline: this.isOffline,
        };
    }

    /** Apply an opt-out immediately; disabled collection must not leave a latent queue. */
    public syncPrivacyBoundary(): void {
        if (!shouldRetainQueuedTelemetry(this.gateInput())) this.queue = [];
    }

    public async flush(): Promise<void> {
        if (this.queue.length === 0) return;
        const gate = this.gateInput();
        if (!shouldRetainQueuedTelemetry(gate)) {
            this.queue = [];
            return;
        }
        const permitted = shouldSend(gate);
        if (!permitted) return; // Hold in queue; holdReason() explains why.

        try {
            const batchToSend = [...this.queue];
            const delivered = await this.sendEventsToCloud(batchToSend);
            if (delivered) {
                this.queue = this.queue.slice(batchToSend.length);
            }
        } catch {
            this.isOffline = true;
            setTimeout(() => { this.isOffline = false; }, 60000); // Retry after 1 min
        }
    }

    /**
     * Hand a batch to the editor's telemetry logger.
     *
     * Returns `false` deliberately: no reviewed network client ships, so nothing
     * left the machine and the queue must not be trimmed as if it had. The old
     * `return true` discarded every event while reporting success — exactly the
     * kind of quiet inaccuracy this product cannot afford.
     */
    private async sendEventsToCloud(events: RedactedEvent[]): Promise<boolean> {
        for (const event of events) {
            // Redacted metadata only — no content, no secrets. The logger is the
            // user-visible record of what SoterAI *would* report, and VS Code
            // silences it entirely when the user's telemetry preference is off.
            this.logger?.logUsage(event.eventType, {
                decision: event.decision,
                severity: event.severity,
                riskScore: event.riskScore,
                contentLength: event.contentLength,
            });
        }
        return false;
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
        this.logger?.dispose();
    }
}
