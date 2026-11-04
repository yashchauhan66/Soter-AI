import { centerActionCommand, protectionCenterRows, type CenterFacts, type CenterRows, type CenterTranslator } from "./ProtectionCenterModel";

export interface CenterSessionDependencies {
    enabled(): boolean; trusted(): boolean; load(): Promise<CenterFacts>;
    execute(command: string): Promise<unknown>; publish(rows: CenterRows): void; outcome(status: string): void;
    translate?: CenterTranslator;
}
const OUTCOMES = new Set(["SAVED", "APPLIED", "RESTORED", "REVOKED", "OPENED", "CANCELLED", "UNAVAILABLE", "INCOMPLETE", "FAILED", "UNCHANGED", "ALLOWED_ONCE", "DENIED", "EXPIRED"]);
function resultStatus(value: unknown): string {
    try { if (!value || typeof value !== "object") return "UNVERIFIED"; const d = Object.getOwnPropertyDescriptor(value, "status"); return d && "value" in d && typeof d.value === "string" && OUTCOMES.has(d.value) ? d.value : "UNVERIFIED"; }
    catch { return "UNVERIFIED"; }
}
export class ProtectionCenterSession {
    private disposed = false;
    private pending = false;
    private renderEpoch = 0;
    private revision = 0;
    constructor(private readonly deps: CenterSessionDependencies) {}
    get epoch(): number { return this.revision; }
    private enabled(): boolean { try { return !this.disposed && this.deps.enabled() === true; } catch { return false; } }
    private trusted(): boolean { try { return this.deps.trusted() === true; } catch { return false; } }
    private unavailable(): CenterFacts { return { enabled: this.enabled(), trusted: this.trusted(), workspaceCount: 1, unavailable: true,
        restrictions: [], activity: [], activityEnabled: false, broker: "unavailable", evidence: { state: "UNAVAILABLE", surfaces: [], fullClaim: "BLOCKED" } }; }
    private publish(facts: CenterFacts): void {
        if (this.disposed) return;
        try { this.deps.publish(protectionCenterRows(facts, Date.now(), this.deps.translate)); } catch { /* No caller error text is logged or displayed. */ }
    }
    invalidate(): void {
        if (this.disposed) return;
        this.revision++;this.renderEpoch++;
        this.publish(this.unavailable());
    }
    async refresh(): Promise<void> {
        if (this.disposed) return;
        const generation = ++this.renderEpoch, revision = this.revision;
        if (!this.enabled()) { this.publish(this.unavailable()); return; }
        let facts: CenterFacts;
        try { facts = await this.deps.load(); } catch { facts = this.unavailable(); }
        if (this.disposed || generation !== this.renderEpoch || revision !== this.revision) return;
        this.publish({ ...facts, enabled: this.enabled(), trusted: this.trusted() });
    }
    async run(action: unknown): Promise<{ status: string }> {
        const command = centerActionCommand(action);
        if (!this.enabled() || this.pending || !command || (!this.trusted() && action !== "revoke" && action !== "privacy")) return { status: "UNAVAILABLE" };
        const revision = this.revision;
        this.pending = true;
        let status: string;
        try { status = resultStatus(await this.deps.execute(command)); } catch { status = "FAILED"; }
        finally { this.pending = false; }
        if (!this.enabled() || revision !== this.revision) return { status: "UNAVAILABLE" };
        try { this.deps.outcome(status); } catch { /* Outcome observers cannot escape into command dispatch. */ }
        await this.refresh();
        return { status };
    }
    dispose(): void {
        if (this.disposed) return;
        this.revision++;this.renderEpoch++;this.disposed = true;
    }
}
