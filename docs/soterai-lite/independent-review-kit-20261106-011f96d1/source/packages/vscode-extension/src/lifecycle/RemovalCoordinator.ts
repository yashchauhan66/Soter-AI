export const REMOVAL_AUTOMATIC_ACTIONS = [
    "checkedPowerShell", "checkedCmd", "checkedGitBash", "secureEditorAssociation",
    "codexCli", "codexIde", "geminiCli", "preCommit", "prePush", "psReadLine",
] as const;
export const REMOVAL_MANUAL_ACTIONS = ["cline", "claude", "legacyBroker", "legacyAIConfigs"] as const;
export type RemovalAction = typeof REMOVAL_AUTOMATIC_ACTIONS[number] | typeof REMOVAL_MANUAL_ACTIONS[number];
const ACTIONS: readonly RemovalAction[] = [...REMOVAL_AUTOMATIC_ACTIONS, ...REMOVAL_MANUAL_ACTIONS];
export interface RemovalOwner { readonly root: string; readonly local: boolean; readonly trusted: boolean; readonly revision: number }
export interface RemovalDependencies {
    owner(): RemovalOwner | undefined;
    probe(id: RemovalAction, owner: RemovalOwner): Promise<unknown>;
    confirmSummary(items: readonly { id: RemovalAction; status: string }[]): Promise<boolean>;
    restore(id: RemovalAction): Promise<unknown>;
    stopBroker(): Promise<unknown>;
}
export type RemovalActionStatus = "RESTORED" | "NOT_APPLICABLE" | "PENDING" | "CANCELLED" | "MANUAL_RECOVERY";
export interface RemovalReport {
    readonly status: "COMPLETE" | "INCOMPLETE" | "CANCELLED" | "BUSY";
    readonly actions: readonly { readonly id: RemovalAction; readonly status: RemovalActionStatus }[];
    readonly broker: "STOPPED" | "PENDING" | "NOT_REQUESTED";
}
type Probe = { state: "ABSENT" } | { state: "OWNED"; fingerprint: string } | { state: "PENDING" };
function data(value: unknown): Record<string, PropertyDescriptor> | undefined {
    if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(descriptors).some(key => typeof key !== "string" || !Object.hasOwn(descriptors[key], "value"))) return;
    return descriptors;
}
function ownerValue(value: unknown): RemovalOwner | undefined {
    const fields = data(value); if (!fields) return;
    const root = fields.root?.value, revision = fields.revision?.value;
    if (typeof root !== "string" || root.length > 8192 || !root.startsWith("file:///") || /[\x00-\x1f\x7f]/.test(root)
        || fields.local?.value !== true || fields.trusted?.value !== true || !Number.isSafeInteger(revision) || revision < 0) return;
    return Object.freeze({ root, local: true, trusted: true, revision });
}
function probeValue(value: unknown, owner: RemovalOwner): Probe {
    const fields = data(value); if (!fields) return { state: "PENDING" };
    const keys = Object.keys(fields).sort().join(",");
    if (keys === "state" && fields.state.value === "ABSENT") return { state: "ABSENT" };
    if (keys === "receiptFingerprint,root,schemaVersion,state" && fields.state.value === "OWNED"
        && fields.schemaVersion.value === 1 && fields.root.value === owner.root
        && typeof fields.receiptFingerprint.value === "string" && /^[a-f0-9]{64}$/.test(fields.receiptFingerprint.value)) {
        return { state: "OWNED", fingerprint: fields.receiptFingerprint.value };
    }
    return { state: "PENDING" };
}
function resultStatus(value: unknown): unknown { return data(value)?.status?.value; }
/** Fixed metadata/review orchestration. Existing native transactions retain all write authority. */
export class RemovalCoordinator {
    private busy = false;
    private disposed = false;
    constructor(private readonly deps: RemovalDependencies) {}
    dispose(): void { this.disposed = true; }
    private owner(): RemovalOwner | undefined {
        if (this.disposed) return;
        try { return ownerValue(this.deps.owner()); } catch { return; }
    }
    private current(captured: RemovalOwner): boolean {
        const now = this.owner(); return !!now && now.root === captured.root && now.revision === captured.revision;
    }
    async run(..._untrustedCallerArgs: unknown[]): Promise<RemovalReport> {
        const rows: { id: RemovalAction; status: RemovalActionStatus }[] = ACTIONS.map(id => ({ id, status: "PENDING" }));
        const report = (status: RemovalReport["status"], broker: RemovalReport["broker"] = "NOT_REQUESTED"): RemovalReport =>
            Object.freeze({ status, broker, actions: Object.freeze(rows.map(row => Object.freeze({ ...row }))) });
        if (this.busy) return report("BUSY");
        const owner = this.owner(); if (!owner) return report("INCOMPLETE");
        this.busy = true;
        try {
            const snapshots = new Map<RemovalAction, Probe>();
            const probe = async (id: RemovalAction): Promise<Probe> => {
                if (!this.current(owner)) return { state: "PENDING" };
                try { const raw = await this.deps.probe(id, owner); return this.current(owner) ? probeValue(raw, owner) : { state: "PENDING" }; }
                catch { return { state: "PENDING" }; }
            };
            for (const row of rows) {
                if (!this.current(owner)) return report("INCOMPLETE");
                const snapshot = await probe(row.id); snapshots.set(row.id, snapshot);
                if (snapshot.state === "ABSENT") row.status = "NOT_APPLICABLE";
                else if (snapshot.state === "OWNED" && (REMOVAL_MANUAL_ACTIONS as readonly string[]).includes(row.id)) row.status = "MANUAL_RECOVERY";
            }
            if (!this.current(owner)) return report("INCOMPLETE");
            const summary = Object.freeze(rows.map(row => Object.freeze({ ...row })));
            let approved: boolean; try { approved = await this.deps.confirmSummary(summary); } catch { return report("INCOMPLETE"); }
            if (!this.current(owner)) return report("INCOMPLETE");
            if (approved !== true) return report("CANCELLED");
            for (const row of rows) {
                const previous = snapshots.get(row.id);
                if (previous?.state !== "OWNED" || (REMOVAL_MANUAL_ACTIONS as readonly string[]).includes(row.id)) continue;
                if (!this.current(owner)) return report("INCOMPLETE");
                const fresh = await probe(row.id);
                if (fresh.state !== "OWNED" || fresh.fingerprint !== previous.fingerprint || !this.current(owner)) { row.status = "PENDING"; continue; }
                let outcome: unknown; try { outcome = await this.deps.restore(row.id); } catch { row.status = "PENDING"; continue; }
                if (!this.current(owner)) return report("INCOMPLETE");
                const status = resultStatus(outcome);
                if (status === "CANCELLED") { row.status = "CANCELLED"; return report("CANCELLED"); }
                const expected = row.id.startsWith("checked") || row.id === "secureEditorAssociation" ? "SAVED" : "RESTORED";
                if (status !== expected) { row.status = "PENDING"; continue; }
                row.status = (await probe(row.id)).state === "ABSENT" && this.current(owner) ? "RESTORED" : "PENDING";
            }
            if (!this.current(owner) || rows.some(row => !["RESTORED", "NOT_APPLICABLE"].includes(row.status))) return report("INCOMPLETE");
            // A different command could have installed a route while the summary was open.
            // Never infer final absence from the original empty inventory alone.
            for (const row of rows) {
                if ((await probe(row.id)).state !== "ABSENT" || !this.current(owner)) { row.status = "PENDING"; return report("INCOMPLETE"); }
            }
            let stopped: unknown; try { stopped = await this.deps.stopBroker(); } catch { return report("INCOMPLETE", "PENDING"); }
            if (!this.current(owner) || data(stopped)?.state?.value !== "stopped") return report("INCOMPLETE", "PENDING");
            for (const row of rows) {
                if ((await probe(row.id)).state !== "ABSENT" || !this.current(owner)) { row.status = "PENDING"; return report("INCOMPLETE", "STOPPED"); }
            }
            return report("COMPLETE", "STOPPED");
        } catch { return report("INCOMPLETE"); }
        finally { this.busy = false; }
    }
}
